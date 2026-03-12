import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { DMResponseCacheService } from '../services/DMResponseCacheService.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';
import { WhatsAppPipelineConfigService } from '../services/WhatsAppPipelineConfigService.js';

let _db: Database.Database | null = null;
let _pipelineConfig: PipelineConfigService | null = null;
let _waPipelineConfig: WhatsAppPipelineConfigService | null = null;
let _responseCache: DMResponseCacheService | null = null;

function getDb(): Database.Database {
  if (!_db) throw new Error('DM Kontrol routes not initialized');
  return _db;
}

/**
 * Idempotent migration: adds pipeline_trace, pipeline_error, and model_tier
 * columns to instagram_interactions if they don't already exist.
 * Called when the DM Kontrol route factory initialises.
 */
export function runDmKontrolMigration(db: Database.Database): void {
  const columns = db.pragma('table_info(instagram_interactions)') as { name: string }[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('pipeline_trace')) {
    db.exec('ALTER TABLE instagram_interactions ADD COLUMN pipeline_trace TEXT');
  }
  if (!columnNames.includes('pipeline_error')) {
    db.exec('ALTER TABLE instagram_interactions ADD COLUMN pipeline_error TEXT');
  }
  if (!columnNames.includes('model_tier')) {
    db.exec('ALTER TABLE instagram_interactions ADD COLUMN model_tier TEXT');
  }
}

// --- Helper functions ---

function safeJsonParse(str: string | null): any {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function getDateFilter(period: string): string {
  switch (period) {
    case '7d': return "created_at >= datetime('now', '-7 days')";
    case '30d': return "created_at >= datetime('now', '-30 days')";
    case 'today':
    default: return "created_at >= date('now')";
  }
}

function mapRowToItem(row: any) {
  return {
    id: row.id,
    customerId: row.customer_id || row.instagram_id || row.phone,
    channel: row.channel || 'instagram',
    direction: row.direction,
    messageText: row.message_text,
    intent: row.intent,
    aiResponse: row.ai_response,
    responseTimeMs: row.response_time_ms,
    modelUsed: row.model_used,
    modelTier: row.model_tier,
    tokensEstimated: row.tokens_estimated,
    pipelineTrace: safeJsonParse(row.pipeline_trace),
    pipelineError: safeJsonParse(row.pipeline_error),
    mediaType: row.media_type || null,
    executionId: row.execution_id || null,
    createdAt: row.created_at,
    // Keep backward compat for Instagram-only consumers
    instagramId: row.channel === 'instagram' ? (row.customer_id || row.instagram_id) : undefined,
  };
}

// --- Router ---

const router = Router();

// 1. GET /stream — SSE endpoint
router.get('/stream', (req: Request, res: Response) => {
  const dmSSE = DmSSEManager.getInstance();
  dmSSE.addClient(res);
});

// 2. GET /feed — Paginated recent DMs (unified: Instagram + WhatsApp)
router.get('/feed', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const channel = req.query.channel as string | undefined;

    if (channel === 'instagram') {
      // Instagram only
      const total = db.prepare('SELECT COUNT(*) as count FROM instagram_interactions').get() as any;
      const rows = db.prepare(`
        SELECT id, instagram_id as customer_id, 'instagram' as channel, direction, message_text, intent, sentiment, ai_response,
               response_time_ms, model_used, tokens_estimated, model_tier, pipeline_trace, pipeline_error, execution_id, NULL as media_type, created_at
        FROM instagram_interactions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset) as any[];
      res.json({ items: rows.map(mapRowToItem), total: total.count, offset, limit });
    } else if (channel === 'whatsapp') {
      // WhatsApp only
      const total = db.prepare('SELECT COUNT(*) as count FROM whatsapp_interactions').get() as any;
      const rows = db.prepare(`
        SELECT id, phone as customer_id, 'whatsapp' as channel, direction, message_text, intent, sentiment, ai_response,
               response_time_ms, model_used, tokens_estimated, model_tier, pipeline_trace, pipeline_error, execution_id, media_type, created_at
        FROM whatsapp_interactions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset) as any[];
      res.json({ items: rows.map(mapRowToItem), total: total.count, offset, limit });
    } else {
      // Unified feed — both channels
      const totalIg = db.prepare('SELECT COUNT(*) as count FROM instagram_interactions').get() as any;
      const totalWa = db.prepare('SELECT COUNT(*) as count FROM whatsapp_interactions').get() as any;
      const total = totalIg.count + totalWa.count;

      const rows = db.prepare(`
        SELECT id, phone as customer_id, 'whatsapp' as channel, direction, message_text, intent, sentiment, ai_response,
               response_time_ms, model_used, tokens_estimated, model_tier, pipeline_trace, pipeline_error, execution_id, media_type, created_at
        FROM whatsapp_interactions
        UNION ALL
        SELECT id, instagram_id as customer_id, 'instagram' as channel, direction, message_text, intent, sentiment, ai_response,
               response_time_ms, model_used, tokens_estimated, model_tier, pipeline_trace, pipeline_error, execution_id, NULL as media_type, created_at
        FROM instagram_interactions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset) as any[];
      res.json({ items: rows.map(mapRowToItem), total, offset, limit });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2.5. GET /execution/:executionId — Execution detail for debugging
router.get('/execution/:executionId', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { executionId } = req.params;

    // Fetch all messages (inbound + outbound) with this execution_id from both channels
    const igRows = db.prepare(`
      SELECT id, instagram_id as customer_id, 'instagram' as channel, direction, message_text, intent, sentiment, ai_response,
             response_time_ms, model_used, tokens_estimated, model_tier, pipeline_trace, pipeline_error, execution_id, created_at
      FROM instagram_interactions
      WHERE execution_id = ?
      ORDER BY created_at ASC
    `).all(executionId) as any[];

    const waRows = db.prepare(`
      SELECT id, phone as customer_id, 'whatsapp' as channel, direction, message_text, intent, sentiment, ai_response,
             response_time_ms, model_used, tokens_estimated, model_tier, pipeline_trace, pipeline_error, execution_id, created_at
      FROM whatsapp_interactions
      WHERE execution_id = ?
      ORDER BY created_at ASC
    `).all(executionId) as any[];

    const allRows = [...igRows, ...waRows].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    if (allRows.length === 0) {
      res.status(404).json({ error: 'Execution not found' });
      return;
    }

    // Parse pipeline_trace and pipeline_error
    const messages = allRows.map(row => ({
      id: row.id,
      customerId: row.customer_id,
      channel: row.channel,
      direction: row.direction,
      messageText: row.message_text,
      intent: row.intent,
      sentiment: row.sentiment,
      aiResponse: row.ai_response,
      responseTimeMs: row.response_time_ms,
      modelUsed: row.model_used,
      tokensEstimated: row.tokens_estimated,
      modelTier: row.model_tier,
      pipelineTrace: safeJsonParse(row.pipeline_trace),
      pipelineError: safeJsonParse(row.pipeline_error),
      executionId: row.execution_id,
      createdAt: row.created_at,
    }));

    // Extract key info from the outbound message (if exists)
    const outbound = messages.find(m => m.direction === 'outbound');
    const inbound = messages.find(m => m.direction === 'inbound');

    res.json({
      executionId,
      channel: messages[0].channel,
      customerId: messages[0].customerId,
      inboundMessage: inbound?.messageText || null,
      outboundMessage: outbound?.aiResponse || null,
      modelUsed: outbound?.modelUsed || null,
      modelTier: outbound?.modelTier || null,
      responseTimeMs: outbound?.responseTimeMs || null,
      tokensEstimated: outbound?.tokensEstimated || null,
      pipelineTrace: outbound?.pipelineTrace || null,
      pipelineError: outbound?.pipelineError || null,
      messages,
      createdAt: inbound?.createdAt || messages[0].createdAt,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /conversations/:instagramId — Customer thread
router.get('/conversations/:instagramId', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { instagramId } = req.params;
    const rows = db.prepare(`
      SELECT id, instagram_id, direction, message_text, intent, ai_response,
             response_time_ms, model_used, model_tier, tokens_estimated,
             pipeline_trace, pipeline_error, created_at
      FROM instagram_interactions
      WHERE instagram_id = ?
      ORDER BY created_at ASC
    `).all(instagramId) as any[];

    const messages = rows.map(mapRowToItem);

    res.json({ instagramId, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: compute health metrics for a single table
function computeHealthMetrics(db: Database.Database, table: string, dateFilter: string) {
  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM ${table} WHERE ${dateFilter}`).get() as any;
  const totalDMs: number = totalRow.count;

  const successRow = db.prepare(
    `SELECT COUNT(*) as count FROM ${table} WHERE ${dateFilter} AND (pipeline_error IS NULL OR pipeline_error = '')`
  ).get() as any;
  const successRate = totalDMs > 0 ? (successRow.count / totalDMs) * 100 : 0;

  const avgRow = db.prepare(
    `SELECT AVG(response_time_ms) as avg FROM ${table} WHERE ${dateFilter} AND response_time_ms IS NOT NULL`
  ).get() as any;
  const avgResponseTimeMs = avgRow.avg || 0;

  const costRow = db.prepare(
    `SELECT SUM(tokens_estimated) as total FROM ${table} WHERE ${dateFilter} AND tokens_estimated IS NOT NULL`
  ).get() as any;
  const totalEstimatedCost = (costRow.total || 0) * 0.000001;

  const modelRows = db.prepare(`
    SELECT model_used, model_tier, COUNT(*) as count
    FROM ${table}
    WHERE ${dateFilter} AND model_used IS NOT NULL
    GROUP BY model_used
  `).all() as any[];
  const totalWithModel = modelRows.reduce((sum: number, r: any) => sum + r.count, 0);
  const modelDistribution = modelRows.map((r: any) => ({
    tier: r.model_tier || 'unknown',
    model: r.model_used,
    count: r.count,
    percentage: totalWithModel > 0 ? Math.round((r.count / totalWithModel) * 100 * 10) / 10 : 0,
  }));

  const greenRow = db.prepare(
    `SELECT COUNT(*) as count FROM ${table} WHERE ${dateFilter} AND response_time_ms IS NOT NULL AND response_time_ms < 5000`
  ).get() as any;
  const yellowRow = db.prepare(
    `SELECT COUNT(*) as count FROM ${table} WHERE ${dateFilter} AND response_time_ms IS NOT NULL AND response_time_ms >= 5000 AND response_time_ms <= 15000`
  ).get() as any;
  const redRow = db.prepare(
    `SELECT COUNT(*) as count FROM ${table} WHERE ${dateFilter} AND response_time_ms IS NOT NULL AND response_time_ms > 15000`
  ).get() as any;

  return {
    totalDMs,
    successRate: Math.round(successRate * 10) / 10,
    avgResponseTimeMs: Math.round(avgResponseTimeMs),
    totalEstimatedCost: Math.round(totalEstimatedCost * 1000000) / 1000000,
    modelDistribution,
    responseTimeDistribution: {
      green: greenRow.count,
      yellow: yellowRow.count,
      red: redRow.count,
    },
  };
}

// 4. GET /health — Pipeline health metrics (combined + per-channel)
router.get('/health', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const period = (req.query.period as string) || 'today';
    const dateFilter = getDateFilter(period);

    const instagram = computeHealthMetrics(db, 'instagram_interactions', dateFilter);
    const whatsapp = computeHealthMetrics(db, 'whatsapp_interactions', dateFilter);

    // Combined metrics
    const totalDMs = instagram.totalDMs + whatsapp.totalDMs;
    const successCount = Math.round(instagram.totalDMs * instagram.successRate / 100) + Math.round(whatsapp.totalDMs * whatsapp.successRate / 100);
    const successRate = totalDMs > 0 ? Math.round((successCount / totalDMs) * 100 * 10) / 10 : 0;

    // Weighted average response time
    const igResponseTotal = instagram.avgResponseTimeMs * instagram.totalDMs;
    const waResponseTotal = whatsapp.avgResponseTimeMs * whatsapp.totalDMs;
    const avgResponseTimeMs = totalDMs > 0 ? Math.round((igResponseTotal + waResponseTotal) / totalDMs) : 0;

    const totalEstimatedCost = Math.round((instagram.totalEstimatedCost + whatsapp.totalEstimatedCost) * 1000000) / 1000000;

    // Merge model distributions
    const modelDistribution = [...instagram.modelDistribution, ...whatsapp.modelDistribution];

    // Merge response time distributions
    const responseTimeDistribution = {
      green: instagram.responseTimeDistribution.green + whatsapp.responseTimeDistribution.green,
      yellow: instagram.responseTimeDistribution.yellow + whatsapp.responseTimeDistribution.yellow,
      red: instagram.responseTimeDistribution.red + whatsapp.responseTimeDistribution.red,
    };

    res.json({
      // Combined (backward compatible — same shape as before)
      totalDMs,
      successRate,
      avgResponseTimeMs,
      totalEstimatedCost,
      modelDistribution,
      responseTimeDistribution,
      period,
      // Per-channel breakdown
      instagram,
      whatsapp,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET /errors — Pipeline errors
router.get('/errors', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { stage, startDate, endDate } = req.query;
    let sql = `SELECT id, instagram_id, pipeline_error, created_at FROM instagram_interactions WHERE pipeline_error IS NOT NULL AND pipeline_error != ''`;
    const params: any[] = [];

    if (stage) {
      sql += ` AND json_extract(pipeline_error, '$.stage') = ?`;
      params.push(stage);
    }
    if (startDate) {
      sql += ` AND created_at >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND created_at <= ?`;
      params.push(endDate + 'T23:59:59');
    }
    sql += ` ORDER BY created_at DESC`;

    const rows = db.prepare(sql).all(...params) as any[];
    const errors = rows.map((row: any) => {
      const parsed = safeJsonParse(row.pipeline_error);
      return {
        id: row.id,
        instagramId: row.instagram_id,
        stage: parsed?.stage || 'unknown',
        message: parsed?.message || '',
        pipelineError: parsed,
        createdAt: row.created_at,
      };
    });

    res.json({ errors, total: errors.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. GET /model-stats — Model routing statistics (unified: Instagram + WhatsApp)
router.get('/model-stats', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const period = (req.query.period as string) || 'today';
    const dateFilter = getDateFilter(period);

    const rows = db.prepare(`
      SELECT
        model_used as modelId,
        model_tier as modelTier,
        channel,
        COUNT(*) as messageCount,
        AVG(response_time_ms) as avgResponseTimeMs,
        AVG(tokens_estimated) as avgTokens,
        SUM(tokens_estimated) as totalTokens
      FROM (
        SELECT model_used, model_tier, response_time_ms, tokens_estimated, created_at, 'instagram' as channel
        FROM instagram_interactions
        WHERE ${dateFilter} AND model_used IS NOT NULL
        UNION ALL
        SELECT model_used, model_tier, response_time_ms, tokens_estimated, created_at, 'whatsapp' as channel
        FROM whatsapp_interactions
        WHERE ${dateFilter} AND model_used IS NOT NULL
      )
      GROUP BY model_used, channel
    `).all() as any[];

    const models = rows.map((r: any) => ({
      modelId: r.modelId,
      modelTier: r.modelTier || 'unknown',
      channel: r.channel,
      messageCount: r.messageCount,
      avgResponseTimeMs: Math.round(r.avgResponseTimeMs || 0),
      avgTokens: Math.round(r.avgTokens || 0),
      estimatedCost: Math.round((r.totalTokens || 0) * 0.000001 * 1000000) / 1000000,
    }));

    res.json({ models, period });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. GET /test-mode — Current test mode config
router.get('/test-mode', (_req: Request, res: Response) => {
  res.json({
    enabled: process.env.INSTAGRAM_TEST_MODE === 'true',
    senderIds: (process.env.INSTAGRAM_TEST_SENDER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
  });
});

// 8. PATCH /test-mode — Toggle test mode on/off and update sender IDs
// Persists to .env file so changes survive restarts
router.patch('/test-mode', (req: Request, res: Response) => {
  try {
    const { enabled, senderIds } = req.body;
    if (typeof enabled === 'boolean') {
      process.env.INSTAGRAM_TEST_MODE = enabled ? 'true' : 'false';
    }
    if (Array.isArray(senderIds)) {
      process.env.INSTAGRAM_TEST_SENDER_IDS = senderIds.filter(Boolean).join(',');
    }

    // Persist to .env file
    try {
      const envPath = join(process.cwd(), '.env');
      let envContent = readFileSync(envPath, 'utf-8');

      // Update INSTAGRAM_TEST_MODE
      const testModeValue = process.env.INSTAGRAM_TEST_MODE || 'false';
      if (envContent.match(/^INSTAGRAM_TEST_MODE=.*/m)) {
        envContent = envContent.replace(/^INSTAGRAM_TEST_MODE=.*/m, `INSTAGRAM_TEST_MODE=${testModeValue}`);
      } else {
        envContent += `\nINSTAGRAM_TEST_MODE=${testModeValue}`;
      }

      // Update INSTAGRAM_TEST_SENDER_IDS
      const senderIdsValue = process.env.INSTAGRAM_TEST_SENDER_IDS || '';
      if (envContent.match(/^INSTAGRAM_TEST_SENDER_IDS=.*/m)) {
        envContent = envContent.replace(/^INSTAGRAM_TEST_SENDER_IDS=.*/m, `INSTAGRAM_TEST_SENDER_IDS=${senderIdsValue}`);
      } else {
        envContent += `\nINSTAGRAM_TEST_SENDER_IDS=${senderIdsValue}`;
      }

      writeFileSync(envPath, envContent, 'utf-8');
      console.log('[DM Kontrol] Test mode persisted to .env: enabled=%s', testModeValue);
    } catch (envErr) {
      console.error('[DM Kontrol] Failed to persist test mode to .env (non-fatal):', envErr);
    }

    res.json({
      enabled: process.env.INSTAGRAM_TEST_MODE === 'true',
      senderIds: (process.env.INSTAGRAM_TEST_SENDER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. POST /preview-routing — Preview how a message would be routed (no API calls)
router.post('/preview-routing', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!_pipelineConfig) {
      return res.status(500).json({ error: 'Pipeline config not initialized' });
    }
    const { message, senderId = 'preview' } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Use InstagramContextService for analysis (dynamic import for ESM compat)
    const { InstagramContextService } = await import('../services/InstagramContextService.js');
    const contextService = new InstagramContextService(db);
    const analysis = await contextService.analyzeMessage(senderId, message);

    const config = _pipelineConfig.getConfig();
    const wouldUseDirect = _pipelineConfig.shouldUseDirectResponse(analysis.modelTier);
    const wouldSkipPolicy = _pipelineConfig.shouldSkipPolicy(analysis.modelTier);
    const tierConfig = config.directResponse.tiers[analysis.modelTier as keyof typeof config.directResponse.tiers];

    res.json({
      message: message.substring(0, 200),
      routing: {
        tier: analysis.modelTier,
        tierReason: analysis.tierReason,
        modelId: wouldUseDirect ? tierConfig.modelId : analysis.modelId,
        intentCategories: analysis.intentCategories,
        matchedKeywords: analysis.matchedKeywords,
        isNewCustomer: analysis.isNewCustomer,
        conversationHistoryLength: analysis.conversationHistory.length,
        totalInteractions: analysis.totalInteractions,
      },
      pipeline: {
        useDirectResponse: wouldUseDirect,
        skipPolicyValidation: wouldSkipPolicy,
        estimatedTimeMs: wouldUseDirect ? '1500-3000' : '8000-15000',
        path: wouldUseDirect ? 'Direct OpenRouter → (Policy?) → Meta Send' : 'OpenClaw Gateway → Poll JSONL → Policy → Meta Send',
      },
      config: {
        directResponseEnabled: config.directResponse.enabled,
        tierEnabled: tierConfig.enabled,
        tierModel: tierConfig.modelId,
        tierMaxTokens: tierConfig.maxTokens,
        tierTemperature: tierConfig.temperature,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. GET /pipeline-config — Current pipeline optimization config
router.get('/pipeline-config', (_req: Request, res: Response) => {
  try {
    if (!_pipelineConfig) {
      return res.status(500).json({ error: 'Pipeline config not initialized' });
    }
    const config = _pipelineConfig.getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. PATCH /pipeline-config — Update pipeline config (partial merge)
router.patch('/pipeline-config', (req: Request, res: Response) => {
  try {
    if (!_pipelineConfig) {
      return res.status(500).json({ error: 'Pipeline config not initialized' });
    }
    const updated = _pipelineConfig.updateConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. POST /pipeline-config/reset — Reset to defaults
router.post('/pipeline-config/reset', (_req: Request, res: Response) => {
  try {
    if (!_pipelineConfig) {
      return res.status(500).json({ error: 'Pipeline config not initialized' });
    }
    const config = _pipelineConfig.resetConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 12. GET /wa-pipeline-config — Current WhatsApp pipeline config
router.get('/wa-pipeline-config', (_req: Request, res: Response) => {
  try {
    if (!_waPipelineConfig) {
      return res.status(500).json({ error: 'WhatsApp pipeline config not initialized' });
    }
    const config = _waPipelineConfig.getConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 13. PATCH /wa-pipeline-config — Update WhatsApp pipeline config (partial merge)
router.patch('/wa-pipeline-config', (req: Request, res: Response) => {
  try {
    if (!_waPipelineConfig) {
      return res.status(500).json({ error: 'WhatsApp pipeline config not initialized' });
    }
    const updated = _waPipelineConfig.updateConfig(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. POST /wa-pipeline-config/reset — Reset WhatsApp pipeline config to defaults
router.post('/wa-pipeline-config/reset', (_req: Request, res: Response) => {
  try {
    if (!_waPipelineConfig) {
      return res.status(500).json({ error: 'WhatsApp pipeline config not initialized' });
    }
    const config = _waPipelineConfig.resetConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. GET /response-cache/stats — Exact-match DM response cache stats
router.get('/response-cache/stats', (_req: Request, res: Response) => {
  try {
    if (!_responseCache) {
      return res.status(500).json({ error: 'Response cache not initialized' });
    }
    res.json(_responseCache.getStats());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. GET /response-cache/entries — List current exact-match DM response cache rows
router.get('/response-cache/entries', (req: Request, res: Response) => {
  try {
    if (!_responseCache) {
      return res.status(500).json({ error: 'Response cache not initialized' });
    }

    const status = req.query.status === 'active' || req.query.status === 'candidate'
      ? req.query.status
      : 'all';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;

    res.json({
      status,
      items: _responseCache.listEntries({ status, limit }),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. POST /response-cache/clear — Clear exact-match DM response cache
router.post('/response-cache/clear', (_req: Request, res: Response) => {
  try {
    if (!_responseCache) {
      return res.status(500).json({ error: 'Response cache not initialized' });
    }
    res.json(_responseCache.clear());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 18. POST /response-cache/seed — Seed exact-match DM response cache from recent safe Instagram history
router.post('/response-cache/seed', (req: Request, res: Response) => {
  try {
    if (!_responseCache || !_pipelineConfig) {
      return res.status(500).json({ error: 'Response cache not initialized' });
    }

    const config = _pipelineConfig.getConfig();
    const result = _responseCache.seedFromInstagramHistory({
      configSignature: _pipelineConfig.getConfigSignature(config),
      days: typeof req.body?.days === 'number' ? req.body.days : undefined,
      dryRun: req.body?.dryRun === true,
      directOnly: req.body?.directOnly !== false,
      limit: typeof req.body?.limit === 'number' ? req.body.limit : undefined,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- Factory export ---

export function createDmKontrolRoutes(db: Database.Database): Router {
  _db = db;
  _pipelineConfig = new PipelineConfigService(db);
  _waPipelineConfig = new WhatsAppPipelineConfigService(db);
  _responseCache = new DMResponseCacheService(db);
  runDmKontrolMigration(db);
  return router;
}
