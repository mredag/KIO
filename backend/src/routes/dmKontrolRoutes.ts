import { Router, Request, Response } from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type Database from 'better-sqlite3';
import { DmSSEManager } from '../services/DmSSEManager.js';
import { PipelineConfigService } from '../services/PipelineConfigService.js';

let _db: Database.Database | null = null;
let _pipelineConfig: PipelineConfigService | null = null;

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
    instagramId: row.instagram_id,
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
    createdAt: row.created_at,
  };
}

// --- Router ---

const router = Router();

// 1. GET /stream — SSE endpoint
router.get('/stream', (req: Request, res: Response) => {
  const dmSSE = DmSSEManager.getInstance();
  dmSSE.addClient(res);
});

// 2. GET /feed — Paginated recent DMs
router.get('/feed', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const total = db.prepare('SELECT COUNT(*) as count FROM instagram_interactions').get() as any;
    const rows = db.prepare(`
      SELECT id, instagram_id, direction, message_text, intent, ai_response,
             response_time_ms, model_used, model_tier, tokens_estimated,
             pipeline_trace, pipeline_error, created_at
      FROM instagram_interactions
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const items = rows.map(mapRowToItem);

    res.json({ items, total: total.count, offset, limit });
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

// 4. GET /health — Pipeline health metrics
router.get('/health', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const period = (req.query.period as string) || 'today';
    const dateFilter = getDateFilter(period);

    // Total DMs
    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM instagram_interactions WHERE ${dateFilter}`).get() as any;
    const totalDMs: number = totalRow.count;

    // Success rate (DMs without pipeline_error)
    const successRow = db.prepare(
      `SELECT COUNT(*) as count FROM instagram_interactions WHERE ${dateFilter} AND (pipeline_error IS NULL OR pipeline_error = '')`
    ).get() as any;
    const successRate = totalDMs > 0 ? (successRow.count / totalDMs) * 100 : 0;

    // Avg response time
    const avgRow = db.prepare(
      `SELECT AVG(response_time_ms) as avg FROM instagram_interactions WHERE ${dateFilter} AND response_time_ms IS NOT NULL`
    ).get() as any;
    const avgResponseTimeMs = avgRow.avg || 0;

    // Total estimated cost
    const costRow = db.prepare(
      `SELECT SUM(tokens_estimated) as total FROM instagram_interactions WHERE ${dateFilter} AND tokens_estimated IS NOT NULL`
    ).get() as any;
    const totalEstimatedCost = (costRow.total || 0) * 0.000001;

    // Model distribution
    const modelRows = db.prepare(`
      SELECT model_used, model_tier, COUNT(*) as count
      FROM instagram_interactions
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

    // Response time distribution
    const greenRow = db.prepare(
      `SELECT COUNT(*) as count FROM instagram_interactions WHERE ${dateFilter} AND response_time_ms IS NOT NULL AND response_time_ms < 5000`
    ).get() as any;
    const yellowRow = db.prepare(
      `SELECT COUNT(*) as count FROM instagram_interactions WHERE ${dateFilter} AND response_time_ms IS NOT NULL AND response_time_ms >= 5000 AND response_time_ms <= 15000`
    ).get() as any;
    const redRow = db.prepare(
      `SELECT COUNT(*) as count FROM instagram_interactions WHERE ${dateFilter} AND response_time_ms IS NOT NULL AND response_time_ms > 15000`
    ).get() as any;

    res.json({
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
      period,
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

// 6. GET /model-stats — Model routing statistics
router.get('/model-stats', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const period = (req.query.period as string) || 'today';
    const dateFilter = getDateFilter(period);

    const rows = db.prepare(`
      SELECT
        model_used as modelId,
        model_tier as modelTier,
        COUNT(*) as messageCount,
        AVG(response_time_ms) as avgResponseTimeMs,
        AVG(tokens_estimated) as avgTokens,
        SUM(tokens_estimated) as totalTokens
      FROM instagram_interactions
      WHERE ${dateFilter} AND model_used IS NOT NULL
      GROUP BY model_used
    `).all() as any[];

    const models = rows.map((r: any) => ({
      modelId: r.modelId,
      modelTier: r.modelTier || 'unknown',
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
    const analysis = contextService.analyzeMessage(senderId, message);

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

// --- Factory export ---

export function createDmKontrolRoutes(db: Database.Database): Router {
  _db = db;
  _pipelineConfig = new PipelineConfigService(db);
  runDmKontrolMigration(db);
  return router;
}
