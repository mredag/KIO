/**
 * AgentDispatchService — Spawns OpenClaw agents for mc_jobs and polls for results.
 * 
 * This is the missing link between MCSchedulerService (which moves jobs to 'scheduled')
 * and actual agent execution. It:
 * 1. Takes a mc_job → determines which OpenClaw agent to use
 * 2. Builds enriched prompt with DataBridgeService + knowledge context
 * 3. Spawns via sessions.patch + chat.send (same as jarvisRoutes.ts)
 * 4. Polls JSONL for response (proven pattern)
 * 5. Returns result + updates mc_jobs/mc_runs
 */
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync } from 'fs';
import { OpenClawClientService } from './OpenClawClientService.js';

const OPENCLAW_SESSIONS_DIR = join(homedir(), '.openclaw', 'agents', 'main', 'sessions');

export interface DispatchResult {
  success: boolean;
  response: string | null;
  usedTools: boolean;
  durationMs: number;
  error?: string;
}

interface AgentMapping {
  agentId: string;
  openclawAgent: string;  // OpenClaw agent id (main, forge, nexus, etc.)
  model?: string;
  role: string;
}

// Map MC agent roles to OpenClaw agent IDs
const ROLE_TO_OPENCLAW: Record<string, string> = {
  'coder': 'forge',
  'developer': 'forge',
  'builder': 'forge',
  'analyst': 'nexus',
  'data': 'nexus',
  'finance': 'ledger',
  'cost': 'ledger',
  'project': 'atlas',
  'planner': 'atlas',
  'instagram': 'instagram',
  'dm': 'instagram',
  'default': 'main',
};

export class AgentDispatchService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Dispatch a job to an OpenClaw agent and wait for completion.
   */
  async dispatchJob(jobId: string, maxWaitMs = 120000): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      // 1. Load job details
      const job = this.db.prepare(`
        SELECT j.*, a.name as agent_name, a.role as agent_role, a.model as agent_model
        FROM mc_jobs j
        LEFT JOIN mc_agents a ON j.agent_id = a.id
        WHERE j.id = ?
      `).get(jobId) as any;

      if (!job) {
        return { success: false, response: null, usedTools: false, durationMs: 0, error: 'Job not found' };
      }

      // 2. Update job status to running
      this.db.prepare(`UPDATE mc_jobs SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
      this.emitEvent('job', jobId, 'autopilot_started', `AutoPilot started job "${job.title}"`, 'scheduled', 'running');

      // 3. Create execution run
      const runId = randomUUID();
      this.db.prepare(`
        INSERT INTO mc_runs (id, job_id, agent_id, status, created_at)
        VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP)
      `).run(runId, jobId, job.agent_id);

      // 4. Determine OpenClaw agent
      const openclawAgent = this.resolveOpenClawAgent(job.agent_role || 'default');

      // 5. Build enriched prompt
      const prompt = this.buildDispatchPrompt(job);

      // 6. Connect to OpenClaw and dispatch
      const ocClient = OpenClawClientService.getInstance();
      if (!ocClient.isConnected()) {
        await ocClient.connect();
      }

      const sessionKey = `agent:main:autopilot:${jobId}`;
      await ocClient.createSession('autopilot', jobId);
      await ocClient.sendMessage(sessionKey, prompt);

      // 7. Poll JSONL for response
      const result = await this.pollResponse(sessionKey, maxWaitMs);

      // 8. Update run and job
      const durationMs = Date.now() - startTime;
      const tokensEstimated = result.response ? Math.ceil(result.response.length / 4) : 0;

      this.db.prepare(`
        UPDATE mc_runs SET status = ?, completed_at = CURRENT_TIMESTAMP,
          response_text = ?, duration_ms = ?
        WHERE id = ?
      `).run(
        result.success ? 'completed' : 'failed',
        result.response?.substring(0, 2000) || result.error || 'No response',
        durationMs, runId
      );

      if (result.success) {
        this.db.prepare(`UPDATE mc_jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
        this.emitEvent('job', jobId, 'autopilot_completed',
          `AutoPilot completed "${job.title}" in ${Math.round(durationMs / 1000)}s`, 'running', 'completed');

        // Track cost
        this.db.prepare(`
          INSERT INTO mc_cost_ledger (run_id, agent_id, model, input_tokens, output_tokens, cost, job_source)
          VALUES (?, ?, ?, ?, ?, ?, 'autopilot')
        `).run(runId, job.agent_id, job.agent_model || 'unknown', tokensEstimated, 0, 0);
      } else {
        // Increment retry count
        this.db.prepare(`
          UPDATE mc_jobs SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(jobId);
        this.emitEvent('job', jobId, 'autopilot_failed',
          `AutoPilot failed "${job.title}": ${result.error || 'timeout'}`, 'running', 'failed');
      }

      return { ...result, durationMs };

    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      this.emitEvent('job', jobId, 'autopilot_error', `AutoPilot error: ${err.message}`, 'running', 'failed');
      this.db.prepare(`
        UPDATE mc_jobs SET status = 'failed', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(jobId);
      return { success: false, response: null, usedTools: false, durationMs, error: err.message };
    }
  }


  /**
   * Resolve which OpenClaw agent to use based on MC agent role.
   */
  private resolveOpenClawAgent(role: string): string {
    const normalized = (role || '').toLowerCase();
    for (const [keyword, agent] of Object.entries(ROLE_TO_OPENCLAW)) {
      if (normalized.includes(keyword)) return agent;
    }
    return 'main';
  }

  /**
   * Build enriched prompt for the agent, including job context and project info.
   */
  private buildDispatchPrompt(job: any): string {
    const parts: string[] = [];

    parts.push(`# AutoPilot Görev Yürütme`);
    parts.push(`Bu görev otomatik olarak atandı. Gerçek değişiklikler yapmalısın.`);
    parts.push('');
    parts.push(`## Görev: ${job.title}`);
    if (job.description) parts.push(job.description);
    parts.push('');
    parts.push(`Öncelik: ${job.priority || 'medium'}`);
    parts.push(`Kaynak: ${job.source || 'autopilot'}`);
    if (job.agent_name) parts.push(`Atanan Ajan: ${job.agent_name} (${job.agent_role || 'genel'})`);
    parts.push('');

    // Parse metadata for extra context
    if (job.metadata) {
      try {
        const meta = JSON.parse(job.metadata);
        if (meta.context) parts.push(`## Bağlam\n${meta.context}`);
        if (meta.targetFiles?.length) {
          parts.push(`## Hedef Dosyalar`);
          meta.targetFiles.forEach((f: string) => parts.push(`- ${f}`));
        }
        if (meta.actionRequired) parts.push(`## Gerekli Aksiyon\n${meta.actionRequired}`);
      } catch { /* metadata not JSON */ }
    }

    // Inject project map if available
    try {
      const projectMapPath = join(homedir(), '.openclaw', 'workspace', 'PROJECT_MAP.md');
      if (existsSync(projectMapPath)) {
        const projectMap = readFileSync(projectMapPath, 'utf-8');
        if (projectMap.length < 8000) {
          parts.push(`\n# Proje Haritası\n${projectMap}`);
        }
      }
    } catch { /* not critical */ }

    parts.push(`\n# Ortam`);
    parts.push(`- OS: Windows + PowerShell`);
    parts.push(`- Codebase: D:\\\\PERSONEL\\\\Eform-Resepsion-Kiosk-ClawBot`);
    parts.push(`- Backend API: http://localhost:3001`);
    parts.push(`- API Key: ${process.env.KIO_API_KEY || '<KIO_API_KEY>'}`);
    parts.push('');
    parts.push(`İşin bitince ne yaptığını kısaca özetle.`);

    return parts.join('\n');
  }

  /**
   * Poll JSONL files for agent response — proven pattern from jarvisRoutes.ts
   */
  private async pollResponse(sessionKey: string, maxWaitMs: number): Promise<{ success: boolean; response: string | null; usedTools: boolean; error?: string }> {
    const pollInterval = 2500;
    const startTime = Date.now();
    let lastLineCount = 0;
    let stableAt = 0;
    let sawToolUse = false;

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const sessionsFile = join(OPENCLAW_SESSIONS_DIR, 'sessions.json');
        if (!existsSync(sessionsFile)) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        const sessionsData = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
        const sessionInfo = sessionsData[sessionKey];
        if (!sessionInfo?.sessionId) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        const jsonlFile = join(OPENCLAW_SESSIONS_DIR, `${sessionInfo.sessionId}.jsonl`);
        if (!existsSync(jsonlFile)) {
          await new Promise(r => setTimeout(r, pollInterval));
          continue;
        }

        const lines = readFileSync(jsonlFile, 'utf-8').trim().split('\n');

        if (lines.length !== lastLineCount) {
          lastLineCount = lines.length;
          stableAt = Date.now();
        }

        // Track tool usage
        if (!sawToolUse) {
          for (const line of lines) {
            try {
              const e = JSON.parse(line);
              if (e.type === 'message' && e.message?.role === 'assistant' && e.message?.stopReason === 'toolUse') {
                sawToolUse = true;
                break;
              }
            } catch { /* skip */ }
          }
        }

        // Look for clean stopReason=stop
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.type === 'message' && entry.message?.role === 'assistant' && entry.message?.stopReason === 'stop') {
              const content = entry.message.content;
              let text = '';
              if (Array.isArray(content)) {
                const textPart = content.find((c: { type: string }) => c.type === 'text');
                text = textPart?.text || '';
              } else if (typeof content === 'string') {
                text = content.trim();
              }
              // Filter heartbeat
              if (text && !this.isHeartbeatResponse(text)) {
                return { success: true, response: text, usedTools: sawToolUse };
              }
            }
          } catch { /* skip */ }
        }

        // Fallback: stable for 10s
        if (stableAt > 0 && Date.now() - stableAt > 10000) {
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              const entry = JSON.parse(lines[i]);
              if (entry.type === 'message' && entry.message?.role === 'assistant') {
                const content = entry.message.content;
                if (Array.isArray(content)) {
                  const textPart = content.find((c: { type: string }) => c.type === 'text');
                  if (textPart?.text && textPart.text.length > 20 && !this.isHeartbeatResponse(textPart.text)) {
                    return { success: true, response: textPart.text, usedTools: sawToolUse };
                  }
                }
              }
            } catch { /* skip */ }
          }
        }
      } catch (err: any) {
        console.error('[AgentDispatch] Poll error:', err.message);
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }

    return { success: false, response: null, usedTools: sawToolUse, error: 'Polling timeout' };
  }

  private isHeartbeatResponse(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (t === 'heartbeat_ok' || t === 'heartbeat_ok.') return true;
    if (t.includes('heartbeat_ok') && t.length < 100) return true;
    return false;
  }

  private emitEvent(entityType: string, entityId: string, eventType: string, message: string, fromState?: string, toState?: string, metadata?: any): void {
    this.db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, from_state, to_state, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entityType, entityId, eventType, fromState || null, toState || null, message, metadata ? JSON.stringify(metadata) : null);
  }
}
