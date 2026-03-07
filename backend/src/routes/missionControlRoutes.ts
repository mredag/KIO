import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, totalmem, freemem } from 'os';
import type { MCSchedulerService } from '../services/MCSchedulerService.js';

let _db: Database.Database | null = null;

export function createMissionControlRoutes(db: Database.Database) {
  _db = db;
  ensureSkillsMarketplaceColumns();
  return router;
}

const router = Router();

function getDb(): Database.Database {
  if (!_db) throw new Error('MC routes not initialized');
  return _db;
}

function generateId(): string {
  return crypto.randomUUID();
}

function emitEvent(entityType: string, entityId: string, eventType: string, message: string, fromState?: string, toState?: string, metadata?: any) {
  const db = getDb();
  db.prepare(`INSERT INTO mc_events (entity_type, entity_id, event_type, from_state, to_state, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    entityType, entityId, eventType, fromState || null, toState || null, message, metadata ? JSON.stringify(metadata) : null
  );
}

// ============================================================
// OPENCLAW CONFIG HELPERS
// ============================================================
const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');
const OPENCLAW_WORKSPACES_DIR = join(homedir(), '.openclaw', 'workspaces');
const OPENCLAW_AGENTS_DIR = join(homedir(), '.openclaw', 'agents');

function readOpenClawConfig(): any {
  if (!existsSync(OPENCLAW_CONFIG_PATH)) return null;
  return JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
}

function writeOpenClawConfig(config: any): void {
  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function expandOpenClawPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/[\\/]+/g, path.sep);
  if (normalized === '~') return homedir();
  if (normalized.startsWith(`~${path.sep}`)) {
    return path.normalize(path.join(homedir(), normalized.slice(2)));
  }
  return path.normalize(normalized);
}

function resolveMissionControlAgentId(agentId: string): string {
  if (agentId === 'instagram') return 'instagram-dm';
  if (agentId === 'whatsapp') return 'whatsapp-dm';
  return agentId;
}

function createAgentWorkspace(agentId: string, name: string, role: string, objective: string): void {
  const wsDir = join(OPENCLAW_WORKSPACES_DIR, agentId);
  if (!existsSync(wsDir)) mkdirSync(wsDir, { recursive: true });
  const apiKey = process.env.N8N_API_KEY || '<N8N_API_KEY>';
  const resolvedObjective = objective || 'Complete the assigned task accurately.';

  const files: Record<string, string> = {
    'AGENTS.md': `# ${name} - ${role}\n\nYou are ${name}, a Mission Control sub-agent for Eform Spor Merkezi.\n\n## Identity\n- Name: ${name}\n- Role: ${role}\n- Objective: ${resolvedObjective}\n\n## Operating Rules\n- Stay focused on the assigned task.\n- Read relevant files before changing them.\n- Use the KIO HTTP API for live operational data.\n- Verify the result before reporting completion.\n`,
    'SOUL.md': `# SOUL.md - ${name}\n\nMission:\n- Protect customer trust and business data.\n- Prefer facts over guesses.\n- Keep changes minimal and reversible.\n`,
    'TOOLS.md': `# TOOLS.md - ${name}\n\nKIO API base: http://localhost:3001\nAuth header: X-API-Key: ${apiKey}\n\nWorkflow:\n1. Read the task and the relevant files first.\n2. Use HTTP API calls for operational data.\n3. Verify the result before marking the task complete.\n`,
    'IDENTITY.md': `# IDENTITY.md - ${name}\n\n- Name: ${name}\n- Role: ${role}\n- Objective: ${resolvedObjective}\n`,
    'BOOTSTRAP.md': `# BOOTSTRAP.md - ${name}\n\nOn startup, read AGENTS.md, TOOLS.md, IDENTITY.md, USER.md, and MEMORY.md before acting.\n`,
    'HEARTBEAT.md': `# HEARTBEAT.md - ${name}\n\nHEARTBEAT_OK\n`,
    'MEMORY.md': `# MEMORY.md - ${name}\n\nNo memories yet.\n`,
    'USER.md': `# USER.md - ${name}\n\nOperator: Eform Spor Merkezi admin team.\n`,
  };

  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(wsDir, filename);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8');
    }
  }
}

function addAgentToOpenClawConfig(agentId: string, name: string, model: string): boolean {
  const config = readOpenClawConfig();
  if (!config) return false;

  const list = config.agents?.list || [];
  if (list.some((a: any) => a.id === agentId)) return false;

  const wsPath = join(OPENCLAW_WORKSPACES_DIR, agentId);
  const agentDirPath = join(OPENCLAW_AGENTS_DIR, agentId, 'agent');

  list.push({
    id: agentId,
    name: agentId,
    workspace: wsPath,
    agentDir: agentDirPath,
    model: model.startsWith('openrouter/') ? model : `openrouter/${model}`,
    identity: { name },
  });

  config.agents.list = list;

  const mainAgent = list.find((a: any) => a.id === 'main');
  if (mainAgent?.subagents?.allowAgents && !mainAgent.subagents.allowAgents.includes(agentId)) {
    mainAgent.subagents.allowAgents.push(agentId);
  }

  writeOpenClawConfig(config);
  return true;
}

function removeAgentFromOpenClawConfig(agentId: string): boolean {
  if (agentId === 'main') return false;
  const config = readOpenClawConfig();
  if (!config) return false;

  const list = config.agents?.list || [];
  const idx = list.findIndex((a: any) => a.id === agentId);
  if (idx === -1) return false;

  list.splice(idx, 1);
  config.agents.list = list;

  const mainAgent = list.find((a: any) => a.id === 'main');
  if (mainAgent?.subagents?.allowAgents) {
    mainAgent.subagents.allowAgents = mainAgent.subagents.allowAgents.filter((id: string) => id !== agentId);
  }

  writeOpenClawConfig(config);
  return true;
}

// ============================================================
// APPROVAL GATE
// ============================================================
export function checkApprovalGate(
  jobId: string,
  agentId: string,
  confidence: number,
  rubricScores: Record<string, number> | null,
  actionType: 'complete' | 'status_change' | 'output_review'
): { approved: boolean; approvalId?: string } {
  const db = getDb();

  // Read threshold from mc_policies
  const policy = db.prepare(
    `SELECT conditions FROM mc_policies WHERE name = 'approval_confidence_threshold' AND type = 'guardrail' AND is_active = 1`
  ).get() as { conditions: string } | undefined;

  let threshold = 0.80;
  if (policy) {
    try {
      const parsed = JSON.parse(policy.conditions);
      if (typeof parsed.threshold === 'number') threshold = parsed.threshold;
    } catch { /* use default */ }
  }

  // If confidence meets threshold, approve
  if (confidence >= threshold) {
    return { approved: true };
  }

  // Check no existing pending approval for this job
  const existing = db.prepare(
    `SELECT id FROM mc_approvals WHERE job_id = ? AND status = 'pending'`
  ).get(jobId) as { id: string } | undefined;

  if (existing) {
    return { approved: false, approvalId: existing.id };
  }

  // Create pending approval
  const approvalId = generateId();
  db.prepare(
    `INSERT INTO mc_approvals (id, job_id, agent_id, action_type, confidence, rubric_scores, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')`
  ).run(
    approvalId, jobId, agentId, actionType, confidence,
    rubricScores ? JSON.stringify(rubricScores) : null
  );

  // Emit event
  emitEvent('approval', approvalId, 'created', `Approval required: confidence ${confidence.toFixed(2)} < threshold ${threshold.toFixed(2)}`, undefined, 'pending', {
    job_id: jobId, agent_id: agentId, confidence, action_type: actionType
  });

  return { approved: false, approvalId };
}

export function extractConfidence(responseText: string): { confidence: number; rubricScores: Record<string, number> | null } | null {
  if (!responseText) return null;

  // Look for JSON block in the response text
  // Supports ```json ... ``` blocks and bare { ... } blocks
  const jsonBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;
  const bareJsonRegex = /\{[^{}]*"confidence"\s*:\s*[\d.]+[^{}]*\}/;

  let jsonStr: string | null = null;

  const blockMatch = responseText.match(jsonBlockRegex);
  if (blockMatch) {
    jsonStr = blockMatch[1];
  } else {
    const bareMatch = responseText.match(bareJsonRegex);
    if (bareMatch) {
      jsonStr = bareMatch[0];
    }
  }

  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed.confidence !== 'number') return null;
    if (parsed.confidence < 0.0 || parsed.confidence > 1.0) return null;

    let rubricScores: Record<string, number> | null = null;
    if (parsed.rubric_scores && typeof parsed.rubric_scores === 'object') {
      rubricScores = {};
      for (const [key, val] of Object.entries(parsed.rubric_scores)) {
        if (typeof val === 'number') rubricScores[key] = val;
      }
      if (Object.keys(rubricScores).length === 0) rubricScores = null;
    }

    return { confidence: parsed.confidence, rubricScores };
  } catch {
    return null;
  }
}

// ============================================================
// DASHBOARD
// ============================================================
router.get('/dashboard', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const usedMemoryMb = Number(((totalmem() - freemem()) / (1024 * 1024)).toFixed(2));
    const agents = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active FROM mc_agents').get('active') as any;
    const jobs = db.prepare(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status IN ('queued','scheduled') THEN 1 ELSE 0 END) as queue_depth,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active_runs,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'dead_letter' THEN 1 ELSE 0 END) as dead_letter
    FROM mc_jobs`).get() as any;
    const conversations = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active FROM mc_conversations`).get() as any;
    const costToday = db.prepare(`SELECT COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(input_tokens + output_tokens), 0) as tokens FROM mc_cost_ledger WHERE date(created_at) = date('now')`).get() as any;
    const costTotal = db.prepare(`SELECT COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(input_tokens + output_tokens), 0) as tokens FROM mc_cost_ledger`).get() as any;
    const recentEvents = db.prepare('SELECT * FROM mc_events ORDER BY created_at DESC LIMIT 30').all();
    const recentInteractions = db.prepare(`SELECT id, instagram_id as customer_id, 'instagram' as channel, direction, message_text, intent, ai_response, created_at FROM instagram_interactions ORDER BY created_at DESC LIMIT 15`).all();
    // Instagram DM stats
    let instagram_dm_stats: any = {
      total_today: 0, avg_response_ms: 0, unique_senders: 0,
      model_distribution: [] as any[], cost_today: 0,
    };
    try {
      const igStats = db.prepare(`
        SELECT COUNT(*) as total_today, AVG(response_time_ms) as avg_response_ms,
          COUNT(DISTINCT instagram_id) as unique_senders
        FROM instagram_interactions WHERE date(created_at) = date('now')
      `).get() as any;
      const igModelDist = db.prepare(`
        SELECT model_used, COUNT(*) as count FROM instagram_interactions
        WHERE date(created_at) = date('now') AND model_used IS NOT NULL GROUP BY model_used
      `).all();
      const igCost = db.prepare(`
        SELECT COALESCE(SUM(cost), 0) as cost FROM mc_cost_ledger
        WHERE job_source = 'instagram' AND date(created_at) = date('now')
      `).get() as any;
      instagram_dm_stats = {
        total_today: igStats?.total_today || 0,
        avg_response_ms: Math.round(igStats?.avg_response_ms || 0),
        unique_senders: igStats?.unique_senders || 0,
        model_distribution: igModelDist || [],
        cost_today: igCost?.cost || 0,
      };
    } catch (igErr: any) {
      console.warn('Instagram DM stats query failed:', igErr.message);
    }

    // Approval metrics
    let approval_metrics: any = { pending_approvals: 0, approval_resolution_rate: null, avg_confidence: null };
    try {
      const pending = db.prepare(`SELECT COUNT(*) as count FROM mc_approvals WHERE status = 'pending'`).get() as any;
      const resolutionStats = db.prepare(`
        SELECT
          SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
        FROM mc_approvals WHERE status != 'pending' AND resolved_at >= datetime('now', '-7 days')
      `).get() as any;
      const avgConf = db.prepare(`
        SELECT AVG(r.confidence) as avg_confidence
        FROM mc_runs r
        JOIN mc_jobs j ON r.job_id = j.id
        WHERE j.status = 'completed' AND r.confidence IS NOT NULL AND r.completed_at >= datetime('now', '-7 days')
      `).get() as any;

      const totalResolved = (resolutionStats?.approved || 0) + (resolutionStats?.rejected || 0);
      approval_metrics = {
        pending_approvals: pending?.count || 0,
        approval_resolution_rate: totalResolved > 0 ? Math.round(((resolutionStats?.approved || 0) / totalResolved) * 100) / 100 : null,
        avg_confidence: avgConf?.avg_confidence != null ? Math.round(avgConf.avg_confidence * 100) / 100 : null,
      };
    } catch (approvalErr: any) {
      console.warn('Approval metrics query failed:', approvalErr.message);
    }

    res.json({ system_status: 'operational', agents, jobs, conversations, cost: { today: costToday, total: costTotal }, recent_events: recentEvents, recent_interactions: recentInteractions, instagram_dm_stats, approval_metrics, totalMemoryUsageMb: usedMemoryMb });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Backward-compatible typo alias used by some clients
router.get('/dam-board', (_req: Request, res: Response) => {
  res.redirect(307, '/api/mc/dashboard');
});

// GET /dashboard/comparison — Comparison metrics (current vs previous period)
router.get('/dashboard/comparison', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const days = parseInt(req.query.days as string) || 7;

    // Current period
    const currentJobs = db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE created_at >= datetime('now', '-${days} days')`).get() as any;
    const currentCompleted = db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE status = 'completed' AND completed_at >= datetime('now', '-${days} days')`).get() as any;
    const currentFailed = db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE status = 'failed' AND updated_at >= datetime('now', '-${days} days')`).get() as any;
    const currentCost = db.prepare(`SELECT COALESCE(SUM(cost), 0) as c FROM mc_cost_ledger WHERE created_at >= datetime('now', '-${days} days')`).get() as any;
    const currentDMs = db.prepare(`SELECT COUNT(*) as c FROM instagram_interactions WHERE created_at >= datetime('now', '-${days} days')`).get() as any;

    // Previous period
    const prevJobs = db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE created_at >= datetime('now', '-${days * 2} days') AND created_at < datetime('now', '-${days} days')`).get() as any;
    const prevCompleted = db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE status = 'completed' AND completed_at >= datetime('now', '-${days * 2} days') AND completed_at < datetime('now', '-${days} days')`).get() as any;
    const prevFailed = db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE status = 'failed' AND updated_at >= datetime('now', '-${days * 2} days') AND updated_at < datetime('now', '-${days} days')`).get() as any;
    const prevCost = db.prepare(`SELECT COALESCE(SUM(cost), 0) as c FROM mc_cost_ledger WHERE created_at >= datetime('now', '-${days * 2} days') AND created_at < datetime('now', '-${days} days')`).get() as any;
    const prevDMs = db.prepare(`SELECT COUNT(*) as c FROM instagram_interactions WHERE created_at >= datetime('now', '-${days * 2} days') AND created_at < datetime('now', '-${days} days')`).get() as any;

    // Daily series for charts
    const dailyJobs = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count FROM mc_jobs
      WHERE created_at >= datetime('now', '-${days} days') GROUP BY date(created_at) ORDER BY day
    `).all();
    const dailyCost = db.prepare(`
      SELECT date(created_at) as day, SUM(cost) as cost FROM mc_cost_ledger
      WHERE created_at >= datetime('now', '-${days} days') GROUP BY date(created_at) ORDER BY day
    `).all();
    const dailyDMs = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count FROM instagram_interactions
      WHERE created_at >= datetime('now', '-${days} days') GROUP BY date(created_at) ORDER BY day
    `).all();

    // Previous period daily series
    const prevDailyJobs = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as count FROM mc_jobs
      WHERE created_at >= datetime('now', '-${days * 2} days') AND created_at < datetime('now', '-${days} days')
      GROUP BY date(created_at) ORDER BY day
    `).all();

    res.json({
      days,
      current: { jobs: currentJobs?.c || 0, completed: currentCompleted?.c || 0, failed: currentFailed?.c || 0, cost: currentCost?.c || 0, dms: currentDMs?.c || 0 },
      previous: { jobs: prevJobs?.c || 0, completed: prevCompleted?.c || 0, failed: prevFailed?.c || 0, cost: prevCost?.c || 0, dms: prevDMs?.c || 0 },
      series: { jobs: dailyJobs, cost: dailyCost, dms: dailyDMs },
      prev_series: { jobs: prevDailyJobs },
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
// ============================================================
// AGENTS
// ============================================================
router.get('/agents', (_req: Request, res: Response) => {
  try { res.json(getDb().prepare('SELECT * FROM mc_agents ORDER BY status DESC, name ASC').all()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Sync agents from OpenClaw config -> mc_agents table
router.post('/agents/sync', (_req: Request, res: Response) => {
  try {
    const config = readOpenClawConfig();
    if (!config?.agents?.list) {
      res.status(404).json({ error: 'OpenClaw config not found or no agents list' });
      return;
    }

    const db = getDb();
    const existing = db.prepare('SELECT id, name FROM mc_agents').all() as { id: string; name: string }[];
    const existingIds = new Set(existing.map(a => a.id));
    const existingNames = new Map(existing.map(a => [a.name.toLowerCase(), a.id]));

    let created = 0;
    let updated = 0;
    const synced: string[] = [];

    for (const ocAgent of config.agents.list) {
      const agentId = ocAgent.id;
      const mcAgentId = resolveMissionControlAgentId(agentId);
      const name = ocAgent.identity?.name || ocAgent.name || agentId;
      const model = (ocAgent.model || config.agents?.defaults?.model?.primary || 'openai/gpt-4.1')
        .replace(/^openrouter\//, '');

      let role = 'agent';
      const identityPath = join(OPENCLAW_WORKSPACES_DIR, agentId, 'IDENTITY.md');
      if (existsSync(identityPath)) {
        const identityContent = readFileSync(identityPath, 'utf-8');
        const roleMatch = identityContent.match(/\*\*Role:\*\*\s*(.+)/i) ||
                          identityContent.match(/\*\*Creature:\*\*\s*(.+)/i);
        if (roleMatch) role = roleMatch[1].trim();
      }
      if (mcAgentId === 'main') role = 'lead_intelligence_orchestrator';

      if (existingIds.has(mcAgentId)) {
        db.prepare('UPDATE mc_agents SET name = ?, role = ?, model = ?, provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(name, role, model, 'openrouter', mcAgentId);
        updated++;
      } else if (agentId !== mcAgentId && existingIds.has(agentId)) {
        db.prepare('UPDATE mc_agents SET id = ?, name = ?, role = ?, model = ?, provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(mcAgentId, name, role, model, 'openrouter', agentId);
        updated++;
      } else if (existingNames.has(name.toLowerCase())) {
        const oldId = existingNames.get(name.toLowerCase())!;
        db.prepare('UPDATE mc_agents SET id = ?, name = ?, role = ?, model = ?, provider = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(mcAgentId, name, role, model, 'openrouter', oldId);
        updated++;
      } else {
        db.prepare(`INSERT INTO mc_agents (id, name, role, model, provider, status) VALUES (?, ?, ?, ?, ?, 'idle')`)
          .run(mcAgentId, name, role, model, 'openrouter');
        emitEvent('agent', mcAgentId, 'synced', `Agent "${name}" synced from OpenClaw`);
        created++;
      }
      synced.push(mcAgentId);
    }

    const syncedSet = new Set(synced);
    const toRemove = existing.filter(a => !syncedSet.has(a.id));
    let removed = 0;
    for (const agent of toRemove) {
      db.prepare('DELETE FROM mc_agents WHERE id = ?').run(agent.id);
      emitEvent('agent', agent.id, 'removed', `Agent "${agent.name}" removed (not in OpenClaw config)`);
      removed++;
    }

    res.json({ synced: synced.length, created, updated, removed });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.get('/agents/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const agent = db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(req.params.id);
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    const recentRuns = db.prepare('SELECT * FROM mc_runs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
    const events = db.prepare('SELECT * FROM mc_events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 30').all('agent', req.params.id);
    res.json({ ...(agent as any), recent_runs: recentRuns, events });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/agents', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, role, objective, model, provider, channel_scope, capabilities, guardrails } = req.body;
    if (!name || !role) {
      res.status(400).json({ error: 'name and role are required' });
      return;
    }

    const agentId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const fullModel = model || 'openai/gpt-4.1';

    db.prepare(`INSERT INTO mc_agents (id, name, role, objective, model, provider, status, channel_scope, capabilities, guardrails) VALUES (?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)`).run(
      agentId, name, role, objective || null, fullModel, provider || 'openrouter',
      channel_scope ? JSON.stringify(channel_scope) : null, capabilities ? JSON.stringify(capabilities) : null, guardrails || null
    );

    createAgentWorkspace(agentId, name, role, objective || '');
    const ocModel = provider === 'openrouter' ? `openrouter/${fullModel}` : fullModel;
    const addedToConfig = addAgentToOpenClawConfig(agentId, name, ocModel);

    emitEvent('agent', agentId, 'created', `Agent "${name}" created${addedToConfig ? ' + added to OpenClaw config' : ''}`);
    res.status(201).json({ id: agentId, name, status: 'idle', openclaw_synced: addedToConfig });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});
router.patch('/agents/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, role, objective, model, provider, status, channel_scope, capabilities, guardrails } = req.body;
    const agent = db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(req.params.id) as any;
    if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
    db.prepare(`UPDATE mc_agents SET name=COALESCE(?,name), role=COALESCE(?,role), objective=COALESCE(?,objective), model=COALESCE(?,model), provider=COALESCE(?,provider), status=COALESCE(?,status), channel_scope=COALESCE(?,channel_scope), capabilities=COALESCE(?,capabilities), guardrails=COALESCE(?,guardrails), updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      name||null, role||null, objective||null, model||null, provider||null, status||null,
      channel_scope ? JSON.stringify(channel_scope) : null, capabilities ? JSON.stringify(capabilities) : null, guardrails||null, req.params.id
    );

    if (model) {
      const config = readOpenClawConfig();
      if (config?.agents?.list) {
        const resolvedAgentId = resolveOpenClawAgentId(req.params.id);
        const ocAgent = config.agents.list.find((a: any) => a.id === resolvedAgentId);
        if (ocAgent) {
          ocAgent.model = model.startsWith('openrouter/') ? model : `openrouter/${model}`;
          if (name) ocAgent.identity = { ...ocAgent.identity, name };
          writeOpenClawConfig(config);
        }
      }
    }

    if (status && status !== agent.status) emitEvent('agent', req.params.id, 'status_change', `Agent status: ${agent.status} -> ${status}`, agent.status, status);
    res.json({ id: req.params.id, updated: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/agents/:id', (req: Request, res: Response) => {
  try {
    const agentId = req.params.id;
    if (agentId === 'main') {
      res.status(400).json({ error: 'Cannot delete the main agent (Jarvis)' });
      return;
    }

    const db = getDb();
    const agent = db.prepare('SELECT name FROM mc_agents WHERE id = ?').get(agentId) as any;

    db.prepare('DELETE FROM mc_agents WHERE id = ?').run(agentId);
    const removedFromConfig = removeAgentFromOpenClawConfig(resolveOpenClawAgentId(agentId));

    emitEvent('agent', agentId, 'deleted', `Agent "${agent?.name || agentId}" deleted${removedFromConfig ? ' + removed from OpenClaw config' : ''}`);
    res.json({ deleted: true, openclaw_synced: removedFromConfig });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// AGENT LIFECYCLE
// ============================================================
router.post('/agents/:id/provision', async (req: Request, res: Response) => {
  try {
    const mod = await import('../services/AgentLifecycleService.js');
    const lifecycle = mod.AgentLifecycleService.getInstance();
    if (!lifecycle) return res.status(503).json({ error: 'Lifecycle service not initialized' });
    const agent = lifecycle.provision(req.params.id);
    res.json(agent);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/agents/:id/checkin', async (req: Request, res: Response) => {
  try {
    const mod = await import('../services/AgentLifecycleService.js');
    const lifecycle = mod.AgentLifecycleService.getInstance();
    if (!lifecycle) return res.status(503).json({ error: 'Lifecycle service not initialized' });
    const agent = lifecycle.checkin(req.params.id);
    res.json(agent);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/agents/lifecycle/summary', async (_req: Request, res: Response) => {
  try {
    const mod = await import('../services/AgentLifecycleService.js');
    const lifecycle = mod.AgentLifecycleService.getInstance();
    if (!lifecycle) return res.json({ idle: 0, provisioning: 0, online: 0, offline: 0, error: 0 });
    res.json(lifecycle.getSummary());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// AGENT CORE FILES (OpenClaw workspace files)
// ============================================================
const CORE_FILES = ['AGENTS.md', 'SOUL.md', 'TOOLS.md', 'IDENTITY.md', 'USER.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'MEMORY.md'];

function resolveOpenClawAgentId(agentId: string): string {
  const config = readOpenClawConfig();
  const configuredIds = new Set((config?.agents?.list || []).map((agent: any) => agent.id));
  if (configuredIds.has(agentId)) {
    return agentId;
  }

  const unsuffixedId = agentId.replace(/-dm$/, '');
  if (configuredIds.has(unsuffixedId)) {
    return unsuffixedId;
  }

  return unsuffixedId;
}

function getAgentWorkspacePath(agentId: string): string {
  const resolvedAgentId = resolveOpenClawAgentId(agentId);
  const config = readOpenClawConfig();
  const configuredAgent = config?.agents?.list?.find((agent: any) => agent.id === resolvedAgentId);
  const configuredPath = expandOpenClawPath(configuredAgent?.workspace)
    || (resolvedAgentId === 'main' ? expandOpenClawPath(config?.agents?.defaults?.workspace) : null);

  if (configuredPath) {
    return configuredPath;
  }

  if (resolvedAgentId === 'main') {
    return path.join(homedir(), '.openclaw', 'workspace');
  }
  if (resolvedAgentId === 'whatsapp') {
    return path.join(homedir(), '.openclaw', 'workspace-whatsapp');
  }
  return path.join(homedir(), '.openclaw', 'workspaces', resolvedAgentId);
}

function getRepoRootPath(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'openclaw-config'))) {
    return cwd;
  }

  const parent = path.resolve(cwd, '..');
  if (fs.existsSync(path.join(parent, 'openclaw-config'))) {
    return parent;
  }

  return cwd;
}

function getAgentRepoWorkspacePath(agentId: string): string {
  const resolvedAgentId = resolveOpenClawAgentId(agentId);
  const repoRoot = getRepoRootPath();
  if (resolvedAgentId === 'main') {
    return path.join(repoRoot, 'openclaw-config', 'workspace');
  }
  if (resolvedAgentId === 'whatsapp') {
    return path.join(repoRoot, 'openclaw-config', 'workspace-whatsapp');
  }
  return path.join(repoRoot, 'openclaw-config', 'workspaces', resolvedAgentId);
}

function getCoreFileState(workspacePath: string, repoPath: string, filename: string) {
  const workspaceFilePath = path.join(workspacePath, filename);
  const repoFilePath = path.join(repoPath, filename);
  const exists = fs.existsSync(workspaceFilePath);
  const templateExists = fs.existsSync(repoFilePath);
  const size = exists
    ? fs.statSync(workspaceFilePath).size
    : templateExists
      ? fs.statSync(repoFilePath).size
      : 0;

  return {
    workspaceFilePath,
    repoFilePath,
    exists,
    templateExists,
    size,
  };
}

router.get('/agents/:id/files', (req: Request, res: Response) => {
  try {
    const wsPath = getAgentWorkspacePath(req.params.id);
    const repoPath = getAgentRepoWorkspacePath(req.params.id);
    const files: { name: string; size: number; exists: boolean; templateExists: boolean }[] = [];
    for (const f of CORE_FILES) {
      const fileState = getCoreFileState(wsPath, repoPath, f);
      files.push({
        name: f,
        size: fileState.size,
        exists: fileState.exists,
        templateExists: fileState.templateExists,
      });
    }
    res.json({ agentId: req.params.id, workspacePath: wsPath, repoPath, files });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/agents/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const { id, filename } = req.params;
    if (!CORE_FILES.includes(filename)) {
      res.status(400).json({ error: `Invalid core file. Allowed: ${CORE_FILES.join(', ')}` });
      return;
    }
    const wsPath = getAgentWorkspacePath(id);
    const repoPath = getAgentRepoWorkspacePath(id);
    const fileState = getCoreFileState(wsPath, repoPath, filename);
    if (fileState.exists) {
      const content = fs.readFileSync(fileState.workspaceFilePath, 'utf-8');
      res.json({ agentId: id, filename, content, exists: true, templateExists: fileState.templateExists, workspacePath: wsPath, repoPath });
      return;
    }
    if (fileState.templateExists) {
      const content = fs.readFileSync(fileState.repoFilePath, 'utf-8');
      res.json({ agentId: id, filename, content, exists: false, templateExists: true, workspacePath: wsPath, repoPath });
      return;
    }
    res.json({ agentId: id, filename, content: '', exists: false, templateExists: false, workspacePath: wsPath, repoPath });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/agents/:id/files/:filename', (req: Request, res: Response) => {
  try {
    const { id, filename } = req.params;
    const { content } = req.body;
    if (!CORE_FILES.includes(filename)) {
      res.status(400).json({ error: `Invalid core file. Allowed: ${CORE_FILES.join(', ')}` });
      return;
    }
    if (typeof content !== 'string') {
      res.status(400).json({ error: 'content (string) is required' });
      return;
    }
    const wsPath = getAgentWorkspacePath(id);
    if (!fs.existsSync(wsPath)) {
      fs.mkdirSync(wsPath, { recursive: true });
    }
    const filePath = path.join(wsPath, filename);
    fs.writeFileSync(filePath, content, 'utf-8');

    const repoPath = getAgentRepoWorkspacePath(id);
    const repoFilePath = path.join(repoPath, filename);
    try {
      if (!fs.existsSync(repoPath)) fs.mkdirSync(repoPath, { recursive: true });
      fs.writeFileSync(repoFilePath, content, 'utf-8');
    } catch { /* ignore */ }

    emitEvent('agent', id, 'file_updated', `Core file "${filename}" updated for agent "${id}"`);
    res.json({ saved: true, agentId: id, filename, size: content.length });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// JOBS (Workshop)
// ============================================================
router.get('/jobs', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, source, agent_id, limit } = req.query;
    let sql = 'SELECT j.*, a.name as agent_name FROM mc_jobs j LEFT JOIN mc_agents a ON j.agent_id = a.id WHERE 1=1';
    const params: any[] = [];
    if (status) { sql += ' AND j.status = ?'; params.push(status); }
    if (source) { sql += ' AND j.source = ?'; params.push(source); }
    if (agent_id) { sql += ' AND j.agent_id = ?'; params.push(agent_id); }
    sql += ' ORDER BY j.created_at DESC LIMIT ?';
    params.push(Number(limit) || 50);
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/jobs/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const job = db.prepare('SELECT j.*, a.name as agent_name FROM mc_jobs j LEFT JOIN mc_agents a ON j.agent_id = a.id WHERE j.id = ?').get(req.params.id);
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    const runs = db.prepare('SELECT * FROM mc_runs WHERE job_id = ? ORDER BY created_at DESC').all(req.params.id);
    const events = db.prepare('SELECT * FROM mc_events WHERE entity_id = ? AND entity_type = ? ORDER BY created_at DESC').all(req.params.id, 'job');
    res.json({ ...(job as any), runs, events });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/jobs', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { title, source, priority, agent_id, payload, tags, sla_deadline, conversation_id, max_retries } = req.body;
    const id = generateId();
    db.prepare(`INSERT INTO mc_jobs (id, title, source, priority, status, agent_id, payload, tags, sla_deadline, conversation_id, max_retries) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?)`).run(
      id, title, source || 'manual', priority || 'medium', agent_id || null,
      payload ? JSON.stringify(payload) : null, tags ? JSON.stringify(tags) : null,
      sla_deadline || null, conversation_id || null, max_retries || 3
    );
    emitEvent('job', id, 'created', `Job "${title}" created`, undefined, 'queued', { source, priority });
    res.status(201).json({ id, title, status: 'queued' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/jobs/:id/status', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, error: errorMsg } = req.body;
    const job = db.prepare('SELECT * FROM mc_jobs WHERE id = ?').get(req.params.id) as any;
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    const validTransitions: Record<string, string[]> = {
      queued: ['scheduled', 'running', 'cancelled'],
      scheduled: ['running', 'cancelled'],
      running: ['waiting_input', 'completed', 'failed', 'cancelled'],
      waiting_input: ['running', 'completed', 'failed', 'cancelled'],
      failed: ['queued', 'dead_letter', 'cancelled'],
      dead_letter: ['queued'],
    };
    if (validTransitions[job.status] && !validTransitions[job.status].includes(status)) {
      res.status(400).json({ error: `Invalid transition: ${job.status} -> ${status}` }); return;
    }

    // Check approval gate when transitioning to completed
    if (status === 'completed') {
      const pendingApproval = db.prepare(
        `SELECT id FROM mc_approvals WHERE job_id = ? AND status = 'pending'`
      ).get(req.params.id) as { id: string } | undefined;
      if (pendingApproval) {
        emitEvent('job', req.params.id, 'approval_blocked', 'Job completion blocked by pending approval', job.status, undefined, { approval_id: pendingApproval.id });
        res.status(409).json({ error: 'Cannot complete job: pending approval exists', approvalId: pendingApproval.id });
        return;
      }
    }

    if (status === 'failed' && job.retry_count < job.max_retries) {
      db.prepare(`UPDATE mc_jobs SET retry_count = retry_count + 1, status = 'queued', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(req.params.id);
      emitEvent('job', req.params.id, 'retry', `Auto-retry ${job.retry_count + 1}/${job.max_retries}`, 'failed', 'queued');
      res.json({ id: req.params.id, status: 'queued', retried: true, retry_count: job.retry_count + 1 }); return;
    }
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];
    if (status === 'running') updates.push('started_at = CURRENT_TIMESTAMP');
    if (['completed', 'failed', 'cancelled'].includes(status)) updates.push('completed_at = CURRENT_TIMESTAMP');
    if (errorMsg) { updates.push('error = ?'); params.push(errorMsg); }
    params.push(req.params.id);
    db.prepare(`UPDATE mc_jobs SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    emitEvent('job', req.params.id, 'status_change', `Job: ${job.status} -> ${status}`, job.status, status);
    if (status === 'completed' && job.agent_id) {
      db.prepare('UPDATE mc_agents SET total_runs = total_runs + 1, last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(job.agent_id);
    }
    res.json({ id: req.params.id, status });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// RUNS
// ============================================================
router.post('/runs', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { job_id, agent_id, model } = req.body;
    const id = generateId();
    db.prepare(`INSERT INTO mc_runs (id, job_id, agent_id, status, model) VALUES (?, ?, ?, 'running', ?)`).run(id, job_id, agent_id, model || 'openai/gpt-4.1');
    db.prepare(`UPDATE mc_jobs SET status = 'running', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(job_id);
    emitEvent('run', id, 'started', `Run started for job ${job_id}`, undefined, 'running', { agent_id, model });
    res.status(201).json({ id, status: 'running' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/runs/:id/complete', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, response_text, error: errorMsg, input_tokens, output_tokens, cost, duration_ms, confidence, rubric_scores } = req.body;
    const run = db.prepare('SELECT * FROM mc_runs WHERE id = ?').get(req.params.id) as any;
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }

    // Validate confidence range if provided
    if (confidence !== undefined && confidence !== null) {
      if (typeof confidence !== 'number' || confidence < 0.0 || confidence > 1.0) {
        res.status(400).json({ error: 'Confidence must be between 0.0 and 1.0' });
        return;
      }
    }

    db.prepare(`UPDATE mc_runs SET status=?, response_text=?, error=?, input_tokens=?, output_tokens=?, cost=?, duration_ms=?, confidence=?, rubric_scores=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      status || 'completed', response_text || null, errorMsg || null, input_tokens || 0, output_tokens || 0, cost || 0, duration_ms || 0,
      confidence ?? null, rubric_scores ? (typeof rubric_scores === 'string' ? rubric_scores : JSON.stringify(rubric_scores)) : null,
      req.params.id
    );
    if ((input_tokens || 0) > 0 || (output_tokens || 0) > 0) {
      db.prepare(`INSERT INTO mc_cost_ledger (run_id, agent_id, model, provider, input_tokens, output_tokens, cost, job_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        req.params.id, run.agent_id, run.model || 'unknown', 'openai', input_tokens || 0, output_tokens || 0, cost || 0,
        db.prepare('SELECT source FROM mc_jobs WHERE id = ?').pluck().get(run.job_id) || 'unknown'
      );
    }
    db.prepare(`UPDATE mc_agents SET total_runs = total_runs + 1, total_tokens = total_tokens + ?, total_cost = total_cost + ?, last_active_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
      (input_tokens || 0) + (output_tokens || 0), cost || 0, run.agent_id
    );
    emitEvent('run', req.params.id, 'completed', `Run ${status || 'completed'}`, 'running', status || 'completed', { duration_ms, cost });

    // Check approval gate if confidence provided
    let approvalResult: { approved: boolean; approvalId?: string } | undefined;
    if (confidence !== undefined && confidence !== null) {
      const parsedRubric = rubric_scores
        ? (typeof rubric_scores === 'string' ? JSON.parse(rubric_scores) : rubric_scores)
        : null;
      approvalResult = checkApprovalGate(run.job_id, run.agent_id, confidence, parsedRubric, 'complete');
      if (!approvalResult.approved) {
        db.prepare(`UPDATE mc_jobs SET status = 'waiting_input', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(run.job_id);
        emitEvent('job', run.job_id, 'status_change', 'Job awaiting approval', 'running', 'waiting_input');
      }
    }

    res.json({ id: req.params.id, status: status || 'completed', approval: approvalResult });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// CONVERSATIONS
// ============================================================
router.get('/conversations', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { channel, status, limit } = req.query;
    let sql = 'SELECT c.*, a.name as agent_name FROM mc_conversations c LEFT JOIN mc_agents a ON c.assigned_agent_id = a.id WHERE 1=1';
    const params: any[] = [];
    if (channel) { sql += ' AND c.channel = ?'; params.push(channel); }
    if (status) { sql += ' AND c.status = ?'; params.push(status); }
    sql += ' ORDER BY c.last_message_at DESC LIMIT ?';
    params.push(Number(limit) || 50);
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/conversations', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { channel, customer_id, customer_name, assigned_agent_id, tags } = req.body;
    const id = generateId();
    db.prepare(`INSERT INTO mc_conversations (id, channel, customer_id, customer_name, status, assigned_agent_id, last_message_at, tags) VALUES (?, ?, ?, ?, 'active', ?, CURRENT_TIMESTAMP, ?)`).run(
      id, channel, customer_id, customer_name || null, assigned_agent_id || null, tags ? JSON.stringify(tags) : null
    );
    emitEvent('conversation', id, 'created', `New ${channel} conversation from ${customer_id}`);
    res.status(201).json({ id, channel, customer_id, status: 'active' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/conversations/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, assigned_agent_id, context_summary, tags } = req.body;
    const conv = db.prepare('SELECT * FROM mc_conversations WHERE id = ?').get(req.params.id) as any;
    if (!conv) { res.status(404).json({ error: 'Conversation not found' }); return; }
    db.prepare(`UPDATE mc_conversations SET status=COALESCE(?,status), assigned_agent_id=COALESCE(?,assigned_agent_id), context_summary=COALESCE(?,context_summary), tags=COALESCE(?,tags), updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      status||null, assigned_agent_id||null, context_summary||null, tags ? JSON.stringify(tags) : null, req.params.id
    );
    if (status && status !== conv.status) emitEvent('conversation', req.params.id, 'status_change', `Conversation: ${conv.status} -> ${status}`, conv.status, status);
    res.json({ id: req.params.id, updated: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// EVENTS
// ============================================================
router.get('/events', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { entity_type, entity_id, limit } = req.query;
    let sql = 'SELECT * FROM mc_events WHERE 1=1';
    const params: any[] = [];
    if (entity_type) { sql += ' AND entity_type = ?'; params.push(entity_type); }
    if (entity_id) { sql += ' AND entity_id = ?'; params.push(entity_id); }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit) || 50);
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// COSTS (all columns prefixed with cl. to avoid ambiguous column name in JOINs)
// ============================================================
router.get('/costs', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { period, agent_id } = req.query;
    let dateFilter = '';
    if (period === 'today') dateFilter = "AND date(cl.created_at) = date('now')";
    else if (period === 'week') dateFilter = "AND cl.created_at >= datetime('now', '-7 days')";
    else if (period === 'month') dateFilter = "AND cl.created_at >= datetime('now', '-30 days')";
    let agentFilter = '';
    const params: any[] = [];
    if (agent_id) { agentFilter = 'AND cl.agent_id = ?'; params.push(agent_id); }
    const summary = db.prepare(`SELECT COALESCE(SUM(cl.cost), 0) as total_cost, COALESCE(SUM(cl.input_tokens), 0) as total_input_tokens, COALESCE(SUM(cl.output_tokens), 0) as total_output_tokens, COUNT(*) as total_runs FROM mc_cost_ledger cl WHERE 1=1 ${dateFilter} ${agentFilter}`).get(...params) as any;
    const byModel = db.prepare(`SELECT cl.model, cl.provider, SUM(cl.cost) as cost, SUM(cl.input_tokens) as input_tokens, SUM(cl.output_tokens) as output_tokens, COUNT(*) as runs FROM mc_cost_ledger cl WHERE 1=1 ${dateFilter} ${agentFilter} GROUP BY cl.model, cl.provider`).all(...params);
    const byAgent = db.prepare(`SELECT cl.agent_id, a.name as agent_name, SUM(cl.cost) as cost, SUM(cl.input_tokens) as input_tokens, SUM(cl.output_tokens) as output_tokens, COUNT(*) as runs FROM mc_cost_ledger cl LEFT JOIN mc_agents a ON cl.agent_id = a.id WHERE 1=1 ${dateFilter} ${agentFilter} GROUP BY cl.agent_id`).all(...params);
    const recent = db.prepare(`SELECT cl.* FROM mc_cost_ledger cl WHERE 1=1 ${dateFilter} ${agentFilter} ORDER BY cl.created_at DESC LIMIT 20`).all(...params);
    res.json({ summary, by_model: byModel, by_agent: byAgent, recent });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// DOCUMENTS
// ============================================================
router.get('/documents', (_req: Request, res: Response) => {
  try { res.json(getDb().prepare('SELECT * FROM mc_documents ORDER BY created_at DESC').all()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/documents/ingest', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { title, content, content_type, tags } = req.body;
    if (!title || !content) { res.status(400).json({ error: 'title and content required' }); return; }
    const id = generateId();
    const uri = `doc://${id}`;
    db.prepare(`INSERT INTO mc_documents (id, title, content_type, status, tags) VALUES (?, ?, ?, 'parsing', ?)`).run(id, title, content_type || 'markdown', tags ? JSON.stringify(tags) : null);
    const vsModule = await import('../services/VectorStoreService.js');
    await vsModule.ingestDocument(uri, content, content_type || 'md');
    db.prepare(`UPDATE mc_documents SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    emitEvent('document', id, 'ingested', `Document "${title}" ingested into vector store`);
    res.status(201).json({ id, title, status: 'available', uri });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/documents/query', async (req: Request, res: Response) => {
  try {
    const { query, max_documents, max_tokens } = req.body;
    if (!query) { res.status(400).json({ error: 'query required' }); return; }
    const vsModule = await import('../services/VectorStoreService.js');
    const results = await vsModule.queryContext(query, max_documents || 5, 20, max_tokens || 2000);
    res.json({ query, results });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/documents/sync-kb', async (_req: Request, res: Response) => {
  try {
    const vsModule = await import('../services/VectorStoreService.js');
    const result = await vsModule.syncKnowledgeBase();
    emitEvent('system', 'knowledge-base', 'sync', `Synced ${result.synced} KB entries to vector store`);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// POLICIES
// ============================================================
router.get('/policies', (_req: Request, res: Response) => {
  try { res.json(getDb().prepare('SELECT * FROM mc_policies ORDER BY priority DESC, type ASC').all()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/policies', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, type, conditions, actions, priority } = req.body;
    const id = generateId();
    db.prepare(`INSERT INTO mc_policies (id, name, type, conditions, actions, priority) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, name, type, JSON.stringify(conditions), JSON.stringify(actions), priority || 0
    );
    emitEvent('system', id, 'policy_created', `Policy "${name}" (${type}) created`);
    res.status(201).json({ id, name, type });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// MOMENTUM
// ============================================================
router.get('/momentum', (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const lastCompleted = db.prepare(
      `SELECT tags FROM mc_jobs WHERE status = 'completed' AND tags IS NOT NULL ORDER BY completed_at DESC LIMIT 1`
    ).get() as { tags: string } | undefined;

    if (!lastCompleted || !lastCompleted.tags) {
      res.json({ score: 50, task_similarities: [] }); return;
    }

    let completedTags: string[];
    try { completedTags = JSON.parse(lastCompleted.tags); } catch { completedTags = []; }
    if (!Array.isArray(completedTags) || completedTags.length === 0) {
      res.json({ score: 50, task_similarities: [] }); return;
    }

    const queuedJobs = db.prepare(
      `SELECT id, tags FROM mc_jobs WHERE status = 'queued' AND tags IS NOT NULL`
    ).all() as { id: string; tags: string }[];

    if (queuedJobs.length === 0) {
      res.json({ score: 50, task_similarities: [] }); return;
    }

    const completedSet = new Set(completedTags.map((t: string) => t.toLowerCase()));
    const similarities: { job_id: string; similarity: number; reason: string }[] = [];

    for (const job of queuedJobs) {
      let jobTags: string[];
      try { jobTags = JSON.parse(job.tags); } catch { jobTags = []; }
      if (!Array.isArray(jobTags) || jobTags.length === 0) {
        similarities.push({ job_id: job.id, similarity: 0, reason: 'No tags' });
        continue;
      }
      const jobSet = new Set(jobTags.map((t: string) => t.toLowerCase()));
      const intersection = [...jobSet].filter(t => completedSet.has(t)).length;
      const union = new Set([...completedSet, ...jobSet]).size;
      const jaccard = union > 0 ? Math.round((intersection / union) * 100) : 0;
      const shared = [...jobSet].filter(t => completedSet.has(t));
      similarities.push({
        job_id: job.id,
        similarity: jaccard,
        reason: shared.length > 0 ? `Shared tags: ${shared.join(', ')}` : 'No shared tags',
      });
    }

    const avgScore = similarities.length > 0
      ? Math.round(similarities.reduce((sum, s) => sum + s.similarity, 0) / similarities.length)
      : 50;

    res.json({ score: Math.min(100, Math.max(0, avgScore)), task_similarities: similarities });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// APPROVALS (quality gates)
// ============================================================
router.get('/approvals', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, job_id, agent_id } = req.query;
    let sql = `SELECT a.*, j.title as job_title, j.status as job_status, j.result as job_result, ag.name as agent_name, ag.role as agent_role
      FROM mc_approvals a
      LEFT JOIN mc_jobs j ON a.job_id = j.id
      LEFT JOIN mc_agents ag ON a.agent_id = ag.id
      WHERE 1=1`;
    const params: any[] = [];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (job_id) { sql += ' AND a.job_id = ?'; params.push(job_id); }
    if (agent_id) { sql += ' AND a.agent_id = ?'; params.push(agent_id); }
    sql += ' ORDER BY a.created_at DESC';
    res.json(db.prepare(sql).all(...params));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/approvals/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const approval = db.prepare(
      `SELECT a.*, j.title as job_title, j.status as job_status, j.result as job_result, ag.name as agent_name, ag.role as agent_role
       FROM mc_approvals a
       LEFT JOIN mc_jobs j ON a.job_id = j.id
       LEFT JOIN mc_agents ag ON a.agent_id = ag.id
       WHERE a.id = ?`
    ).get(req.params.id);
    if (!approval) { res.status(404).json({ error: 'Approval not found' }); return; }
    res.json(approval);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/approvals/:id/resolve', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, reviewer_note } = req.body;

    // Validate status
    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'status must be approved or rejected' });
      return;
    }

    // Get approval
    const approval = db.prepare('SELECT * FROM mc_approvals WHERE id = ?').get(req.params.id) as any;
    if (!approval) { res.status(404).json({ error: 'Approval not found' }); return; }

    // Check not already resolved
    if (approval.status !== 'pending') {
      res.status(409).json({ error: 'Approval is already resolved', status: approval.status });
      return;
    }

    // Update approval
    db.prepare(
      `UPDATE mc_approvals SET status = ?, reviewer_note = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(status, reviewer_note || null, req.params.id);

    // Update job status based on resolution
    const job = db.prepare('SELECT * FROM mc_jobs WHERE id = ?').get(approval.job_id) as any;
    if (job) {
      if (status === 'approved') {
        db.prepare(`UPDATE mc_jobs SET status = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(approval.job_id);
        emitEvent('job', approval.job_id, 'status_change', `Job approved and completed`, job.status, 'completed');
        if (job.agent_id) {
          db.prepare('UPDATE mc_agents SET total_runs = total_runs + 1, last_active_at = CURRENT_TIMESTAMP WHERE id = ?').run(job.agent_id);
        }
      } else {
        db.prepare(`UPDATE mc_jobs SET status = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
          reviewer_note || 'Rejected by reviewer', approval.job_id
        );
        emitEvent('job', approval.job_id, 'status_change', `Job rejected: ${reviewer_note || 'No reason given'}`, job.status, 'failed');
      }
    }

    // Emit approval resolved event
    emitEvent('approval', req.params.id, 'resolved', `Approval ${status}`, 'pending', status, {
      reviewer_note: reviewer_note || null
    });

    // Update Jarvis session if linked
    try {
      const jarvisSession = db.prepare(
        `SELECT id FROM mc_jarvis_sessions WHERE job_id = ?`
      ).get(approval.job_id) as any;
      if (jarvisSession) {
        const sessionStatus = status === 'approved' ? 'completed' : 'failed';
        db.prepare(`UPDATE mc_jarvis_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(
          sessionStatus, jarvisSession.id
        );
        // Try to push SSE event (best-effort)
        try {
          const { JarvisSSEManager } = await import('../services/JarvisSSEManager.js');
          JarvisSSEManager.getInstance().pushEvent(jarvisSession.id, {
            type: 'status',
            data: { status: sessionStatus, approvalId: req.params.id, reviewerNote: reviewer_note || null }
          });
        } catch { /* SSE push is best-effort */ }
      }
    } catch { /* Jarvis session update is best-effort */ }

    res.json({ id: req.params.id, status, resolved: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// SKILLS (Intelligence page)
// ============================================================
router.get('/skills', (_req: Request, res: Response) => {
  try {
    res.json(getDb().prepare('SELECT * FROM mc_skills ORDER BY status ASC, name ASC').all());
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/skills', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, prompt, test_case, prerequisites, status, agent_id } = req.body;
    if (!name || !prompt || !test_case) {
      res.status(400).json({ error: 'name, prompt, and test_case are required' }); return;
    }
    const existing = db.prepare('SELECT id FROM mc_skills WHERE name = ?').get(name);
    if (existing) {
      res.status(400).json({ error: `Skill with name "${name}" already exists` }); return;
    }
    const id = generateId();
    db.prepare(`INSERT INTO mc_skills (id, name, prerequisites, prompt, test_case, status, agent_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, name, prerequisites ? JSON.stringify(prerequisites) : '[]', prompt, test_case,
      status || 'candidate', agent_id || null
    );
    emitEvent('system', id, 'skill_created', `Skill "${name}" created`);
    res.status(201).json({ id, name, status: status || 'candidate' });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.patch('/skills/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const skill = db.prepare('SELECT * FROM mc_skills WHERE id = ?').get(req.params.id);
    if (!skill) { res.status(404).json({ error: 'Skill not found' }); return; }
    const { name, prompt, test_case, prerequisites, status, agent_id, fit_score, fit_reason } = req.body;
    db.prepare(`UPDATE mc_skills SET name=COALESCE(?,name), prompt=COALESCE(?,prompt), test_case=COALESCE(?,test_case), prerequisites=COALESCE(?,prerequisites), status=COALESCE(?,status), agent_id=COALESCE(?,agent_id), fit_score=COALESCE(?,fit_score), fit_reason=COALESCE(?,fit_reason), updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
      name || null, prompt || null, test_case || null,
      prerequisites ? JSON.stringify(prerequisites) : null,
      status || null, agent_id || null, fit_score ?? null, fit_reason || null, req.params.id
    );
    res.json({ id: req.params.id, updated: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/skills/:id', (req: Request, res: Response) => {
  try {
    getDb().prepare('DELETE FROM mc_skills WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// Skills marketplace columns (ALTER TABLE if missing) — runs when factory is called
function ensureSkillsMarketplaceColumns() {
  try {
    const db = getDb();
    const skillCols = db.prepare("PRAGMA table_info(mc_skills)").all() as any[];
    const skillColNames = new Set(skillCols.map((c: any) => c.name));
    if (!skillColNames.has('source_url')) db.exec("ALTER TABLE mc_skills ADD COLUMN source_url TEXT");
    if (!skillColNames.has('category')) db.exec("ALTER TABLE mc_skills ADD COLUMN category TEXT DEFAULT 'general'");
    if (!skillColNames.has('risk_level')) db.exec("ALTER TABLE mc_skills ADD COLUMN risk_level TEXT DEFAULT 'low'");
    if (!skillColNames.has('installed')) db.exec("ALTER TABLE mc_skills ADD COLUMN installed INTEGER DEFAULT 1");
    if (!skillColNames.has('install_path')) db.exec("ALTER TABLE mc_skills ADD COLUMN install_path TEXT");
    if (!skillColNames.has('description')) db.exec("ALTER TABLE mc_skills ADD COLUMN description TEXT");
  } catch { /* columns may already exist */ }
}

// GET /skills/local — Scan local skills directory
router.get('/skills/local', (_req: Request, res: Response) => {
  try {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const skillsDir = path.join(home, '.openclaw', 'workspace', 'skills');
    if (!existsSync(skillsDir)) return res.json([]);
    const dirs = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter((d: any) => d.isDirectory())
      .map((d: any) => {
        const indexPath = path.join(skillsDir, d.name, 'index.js');
        const hasIndex = existsSync(indexPath);
        return { name: d.name, path: path.join(skillsDir, d.name), has_index: hasIndex };
      });
    res.json(dirs);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});


// ============================================================
// WEBHOOK - OpenClaw lifecycle events
// ============================================================
router.post('/webhook/openclaw', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { runId, action, sessionKey, prompt, source, response, error: errorMsg } = req.body;
    if (action === 'start' && prompt) {
      const jobId = generateId();
      db.prepare(`INSERT INTO mc_jobs (id, title, source, priority, status, payload, created_at, started_at, updated_at) VALUES (?, ?, ?, 'medium', 'running', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(
        jobId, prompt.substring(0, 100), source || 'webhook', JSON.stringify({ runId, sessionKey, prompt })
      );
      const runDbId = generateId();
      db.prepare(`INSERT INTO mc_runs (id, job_id, agent_id, status, model, metadata) VALUES (?, ?, 'instagram-dm', 'running', 'openai/gpt-4o-mini', ?)`).run(
        runDbId, jobId, JSON.stringify({ openclaw_run_id: runId, sessionKey })
      );
      emitEvent('job', jobId, 'openclaw_start', `OpenClaw run started: ${prompt.substring(0, 60)}`, undefined, 'running');
    } else if (action === 'end' && runId) {
      const run = db.prepare(`SELECT r.id, r.job_id FROM mc_runs r WHERE r.metadata LIKE ?`).get(`%${runId}%`) as any;
      if (run) {
        db.prepare(`UPDATE mc_runs SET status='completed', response_text=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`).run(response || null, run.id);
        db.prepare(`UPDATE mc_jobs SET status='completed', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(run.job_id);
        emitEvent('job', run.job_id, 'openclaw_end', 'OpenClaw run completed', 'running', 'completed');
      }
    } else if (action === 'error' && runId) {
      const run = db.prepare(`SELECT r.id, r.job_id FROM mc_runs r WHERE r.metadata LIKE ?`).get(`%${runId}%`) as any;
      if (run) {
        db.prepare(`UPDATE mc_runs SET status='failed', error=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`).run(errorMsg || 'Unknown error', run.id);
        db.prepare(`UPDATE mc_jobs SET status='failed', error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(errorMsg || 'Unknown error', run.job_id);
        emitEvent('job', run.job_id, 'openclaw_error', `OpenClaw run failed: ${errorMsg}`, 'running', 'failed');
      }
    }
    res.json({ received: true, action });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});


// ============================================================
// METRICS (time-series dashboard charts)
// ============================================================
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const range = (req.query.range as string) || '7d';

    // Resolve range to SQLite date offset
    const rangeMap: Record<string, { offset: string; bucket: string; format: string }> = {
      '24h': { offset: '-24 hours', bucket: 'hour', format: '%Y-%m-%dT%H:00:00' },
      '3d':  { offset: '-3 days',   bucket: 'day',  format: '%Y-%m-%d' },
      '7d':  { offset: '-7 days',   bucket: 'day',  format: '%Y-%m-%d' },
      '14d': { offset: '-14 days',  bucket: 'day',  format: '%Y-%m-%d' },
      '1m':  { offset: '-30 days',  bucket: 'day',  format: '%Y-%m-%d' },
      '3m':  { offset: '-90 days',  bucket: 'week', format: '%Y-W%W' },
    };
    const spec = rangeMap[range] || rangeMap['7d'];

    // Throughput: completed jobs per bucket
    const throughput = db.prepare(`
      SELECT strftime('${spec.format}', completed_at) as period, COUNT(*) as value
      FROM mc_jobs WHERE status = 'completed' AND completed_at >= datetime('now', '${spec.offset}')
      GROUP BY period ORDER BY period
    `).all();

    // Error rate: failed / total events per bucket
    const errorRate = db.prepare(`
      SELECT strftime('${spec.format}', created_at) as period,
        SUM(CASE WHEN event_type LIKE '%error%' OR event_type LIKE '%fail%' THEN 1 ELSE 0 END) as errors,
        COUNT(*) as total
      FROM mc_events WHERE created_at >= datetime('now', '${spec.offset}')
      GROUP BY period ORDER BY period
    `).all().map((row: any) => ({
      period: row.period,
      value: row.total > 0 ? Math.round((row.errors / row.total) * 1000) / 10 : 0,
    }));

    // Cost per bucket
    const costSeries = db.prepare(`
      SELECT strftime('${spec.format}', created_at) as period,
        COALESCE(SUM(cost), 0) as value,
        COALESCE(SUM(input_tokens + output_tokens), 0) as tokens
      FROM mc_cost_ledger WHERE created_at >= datetime('now', '${spec.offset}')
      GROUP BY period ORDER BY period
    `).all();

    // WIP: job status distribution per bucket (based on created_at)
    const wip = db.prepare(`
      SELECT strftime('${spec.format}', created_at) as period,
        SUM(CASE WHEN status IN ('queued','scheduled') THEN 1 ELSE 0 END) as queued,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('failed','dead_letter') THEN 1 ELSE 0 END) as failed
      FROM mc_jobs WHERE created_at >= datetime('now', '${spec.offset}')
      GROUP BY period ORDER BY period
    `).all();

    // Avg cycle time per bucket (started_at → completed_at in hours)
    const cycleTime = db.prepare(`
      SELECT strftime('${spec.format}', completed_at) as period,
        AVG((julianday(completed_at) - julianday(started_at)) * 24) as value
      FROM mc_jobs
      WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
        AND completed_at >= datetime('now', '${spec.offset}')
      GROUP BY period ORDER BY period
    `).all().map((row: any) => ({
      period: row.period,
      value: Math.round((row.value || 0) * 10) / 10,
    }));

    // KPIs
    const activeAgents = (db.prepare(`SELECT COUNT(*) as c FROM mc_agents WHERE status = 'active'`).get() as any)?.c || 0;
    const jobsInProgress = (db.prepare(`SELECT COUNT(*) as c FROM mc_jobs WHERE status = 'running'`).get() as any)?.c || 0;
    const totalErrorRate = (() => {
      const r = db.prepare(`
        SELECT SUM(CASE WHEN event_type LIKE '%error%' OR event_type LIKE '%fail%' THEN 1 ELSE 0 END) as errors, COUNT(*) as total
        FROM mc_events WHERE created_at >= datetime('now', '${spec.offset}')
      `).get() as any;
      return r?.total > 0 ? Math.round((r.errors / r.total) * 1000) / 10 : 0;
    })();
    const medianCycleTime = (() => {
      const rows = db.prepare(`
        SELECT (julianday(completed_at) - julianday(started_at)) * 24 as hours
        FROM mc_jobs WHERE status = 'completed' AND started_at IS NOT NULL AND completed_at IS NOT NULL
          AND completed_at >= datetime('now', '${spec.offset}')
        ORDER BY hours
      `).all() as any[];
      if (rows.length === 0) return null;
      const mid = Math.floor(rows.length / 2);
      return Math.round((rows.length % 2 ? rows[mid].hours : (rows[mid - 1].hours + rows[mid].hours) / 2) * 10) / 10;
    })();

    res.json({
      range,
      bucket: spec.bucket,
      kpis: { active_agents: activeAgents, jobs_in_progress: jobsInProgress, error_rate_pct: totalErrorRate, median_cycle_time_hours: medianCycleTime },
      throughput,
      error_rate: errorRate,
      cost_series: costSeries,
      wip,
      cycle_time: cycleTime,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ============================================================
// SCHEDULER
// ============================================================
let _scheduler: MCSchedulerService | null = null;

export function setSchedulerService(scheduler: MCSchedulerService): void {
  _scheduler = scheduler;
}

router.get('/scheduler/status', (_req: Request, res: Response) => {
  if (!_scheduler) { res.status(503).json({ error: 'Scheduler not initialized' }); return; }
  res.json(_scheduler.getStatus());
});

router.post('/scheduler/dispatch-now', (_req: Request, res: Response) => {
  if (!_scheduler) { res.status(503).json({ error: 'Scheduler not initialized' }); return; }
  try {
    _scheduler.dispatchNow();
    res.json({ dispatched: true, status: _scheduler.getStatus() });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
