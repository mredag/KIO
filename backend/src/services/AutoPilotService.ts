/**
 * AutoPilotService — The autonomous brain of Mission Control.
 *
 * Periodically scans for actionable events and dispatches agents without human intervention:
 * - Picks up 'scheduled' jobs and dispatches them to OpenClaw agents
 * - Detects DM pipeline failures and creates fix jobs
 * - Detects policy violations and creates review jobs
 * - Monitors cost spikes and creates analysis jobs
 * - Auto-approves high-confidence completions, escalates low-confidence ones
 *
 * Runs alongside MCSchedulerService:
 *   MCScheduler: queued → scheduled (DB status changes)
 *   AutoPilot:   scheduled → running → completed (actual agent execution)
 */
import cron from 'node-cron';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { AgentDispatchService } from './AgentDispatchService.js';
import { AutoPilotSSEManager } from './AutoPilotSSEManager.js';
import { EscalationService } from './EscalationService.js';

export interface AutoPilotConfig {
  enabled: boolean;
  scanIntervalSeconds: number;
  maxConcurrentJobs: number;
  autoApproveThreshold: number;  // confidence score 0-1
  dmFailureThreshold: number;    // consecutive failures before creating fix job
  costSpikeMultiplier: number;   // e.g. 3x average = spike
  enabledTriggers: {
    scheduledJobs: boolean;
    dmFailures: boolean;
    policyViolations: boolean;
    costSpikes: boolean;
  };
}

const DEFAULT_CONFIG: AutoPilotConfig = {
  enabled: true,
  scanIntervalSeconds: 60,
  maxConcurrentJobs: 2,
  autoApproveThreshold: 0.8,
  dmFailureThreshold: 3,
  costSpikeMultiplier: 3,
  enabledTriggers: {
    scheduledJobs: true,
    dmFailures: true,
    policyViolations: true,
    costSpikes: true,
  },
};

interface ScanResult {
  trigger: string;
  jobsCreated: number;
  jobsDispatched: number;
  details: string;
}

export class AutoPilotService {
  private db: Database.Database;
  private dispatch: AgentDispatchService;
  private sse: AutoPilotSSEManager;
  private config: AutoPilotConfig;
  private task: cron.ScheduledTask | null = null;
  private activeDispatches = new Map<string, Promise<any>>();
  private escalation: EscalationService | null = null;
  private stats = {
    isRunning: false,
    totalScans: 0,
    totalDispatched: 0,
    totalCompleted: 0,
    totalFailed: 0,
    lastScanAt: null as string | null,
    lastDispatchAt: null as string | null,
    activeJobs: 0,
    scanResults: [] as ScanResult[],
  };

  constructor(db: Database.Database) {
    this.db = db;
    this.dispatch = new AgentDispatchService(db);
    this.sse = AutoPilotSSEManager.getInstance();
    this.config = { ...DEFAULT_CONFIG };
    this.loadConfig();
  }

  setEscalationService(svc: EscalationService): void {
    this.escalation = svc;
  }

  /**
   * Load config from mc_policies table (same pattern as PipelineConfigService).
   */
  private loadConfig(): void {
    try {
      const row = this.db.prepare(`SELECT conditions FROM mc_policies WHERE id = 'autopilot_config'`).get() as any;
      if (row?.conditions) {
        const saved = JSON.parse(row.conditions);
        this.config = { ...DEFAULT_CONFIG, ...saved, enabledTriggers: { ...DEFAULT_CONFIG.enabledTriggers, ...saved.enabledTriggers } };
      }
    } catch { /* use defaults */ }
  }

  /**
   * Save config to mc_policies table.
   */
  saveConfig(partial: Partial<AutoPilotConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
      enabledTriggers: { ...this.config.enabledTriggers, ...(partial.enabledTriggers || {}) },
    };
    const existing = this.db.prepare(`SELECT id FROM mc_policies WHERE id = 'autopilot_config'`).get();
    if (existing) {
      this.db.prepare(`UPDATE mc_policies SET conditions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'autopilot_config'`).run(JSON.stringify(this.config));
    } else {
      this.db.prepare(`INSERT INTO mc_policies (id, name, type, conditions, actions, is_active) VALUES (?, ?, ?, ?, ?, 1)`).run(
        'autopilot_config', 'AutoPilot Configuration', 'guardrail', JSON.stringify(this.config), '{}'
      );
    }
  }

  getConfig(): AutoPilotConfig {
    return { ...this.config };
  }

  start(): void {
    if (this.stats.isRunning) return;
    if (!this.config.enabled) {
      console.log('[AutoPilot] Disabled in config, not starting');
      return;
    }
    this.stats.isRunning = true;

    const interval = Math.max(this.config.scanIntervalSeconds, 30);
    // Use cron for the scan cycle
    this.task = cron.schedule(`*/${interval} * * * * *`, () => {
      this.runScanCycle().catch(err => console.error('[AutoPilot] Scan error:', err.message));
    });

    console.log(`[AutoPilot] Started — scanning every ${interval}s, max ${this.config.maxConcurrentJobs} concurrent`);
    this.emitEvent('system', 'autopilot', 'autopilot_started', 'AutoPilot engine started');
    this.sse.broadcast({ type: 'status', data: { status: 'running', config: this.config } });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.stats.isRunning = false;
    console.log('[AutoPilot] Stopped');
    this.sse.broadcast({ type: 'status', data: { status: 'stopped' } });
  }

  getStatus() {
    return {
      ...this.stats,
      config: this.config,
      activeJobs: this.activeDispatches.size,
      recentResults: this.stats.scanResults.slice(-10),
    };
  }


  /**
   * Main scan cycle — runs every N seconds.
   * Checks all enabled triggers and dispatches work.
   */
  private async runScanCycle(): Promise<void> {
    this.stats.totalScans++;
    this.stats.lastScanAt = new Date().toISOString();
    const results: ScanResult[] = [];

    try {
      // 1. Dispatch scheduled jobs (highest priority)
      if (this.config.enabledTriggers.scheduledJobs) {
        const r = await this.scanScheduledJobs();
        if (r) results.push(r);
      }

      // 2. Detect DM pipeline failures
      if (this.config.enabledTriggers.dmFailures) {
        const r = this.scanDmFailures();
        if (r) results.push(r);
      }

      // 3. Detect policy violations needing review
      if (this.config.enabledTriggers.policyViolations) {
        const r = this.scanPolicyViolations();
        if (r) results.push(r);
      }

      // 4. Detect cost spikes
      if (this.config.enabledTriggers.costSpikes) {
        const r = this.scanCostSpikes();
        if (r) results.push(r);
      }

      // Store results
      if (results.length > 0) {
        this.stats.scanResults.push(...results);
        // Keep only last 50
        if (this.stats.scanResults.length > 50) {
          this.stats.scanResults = this.stats.scanResults.slice(-50);
        }
        this.sse.broadcast({ type: 'scan_complete', data: { results, timestamp: this.stats.lastScanAt } });
      }
    } catch (err: any) {
      console.error('[AutoPilot] Scan cycle error:', err.message);
    }
  }

  /**
   * Trigger 1: Pick up 'scheduled' jobs and dispatch to OpenClaw agents.
   */
  private async scanScheduledJobs(): Promise<ScanResult | null> {
    // Check capacity
    if (this.activeDispatches.size >= this.config.maxConcurrentJobs) return null;

    const available = this.config.maxConcurrentJobs - this.activeDispatches.size;
    const scheduledJobs = this.db.prepare(`
      SELECT id, title, agent_id, priority
      FROM mc_jobs
      WHERE status = 'scheduled' AND agent_id IS NOT NULL
      ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        created_at ASC
      LIMIT ?
    `).all(available) as any[];

    if (scheduledJobs.length === 0) return null;

    let dispatched = 0;
    for (const job of scheduledJobs) {
      if (this.activeDispatches.has(job.id)) continue;

      // Fire-and-forget dispatch (tracked via promise map)
      const promise = this.executeDispatch(job.id, job.title);
      this.activeDispatches.set(job.id, promise);
      dispatched++;

      this.sse.broadcast({
        type: 'job_dispatched',
        data: { jobId: job.id, title: job.title, priority: job.priority },
      });
    }

    if (dispatched > 0) {
      this.stats.totalDispatched += dispatched;
      this.stats.lastDispatchAt = new Date().toISOString();
      return { trigger: 'scheduled_jobs', jobsCreated: 0, jobsDispatched: dispatched, details: `Dispatched ${dispatched} scheduled job(s)` };
    }
    return null;
  }

  /**
   * Execute a dispatch and handle completion/failure.
   */
  private async executeDispatch(jobId: string, title: string): Promise<void> {
    try {
      console.log(`[AutoPilot] Dispatching job "${title}" (${jobId})`);
      const result = await this.dispatch.dispatchJob(jobId);

      if (result.success) {
        this.stats.totalCompleted++;
        console.log(`[AutoPilot] ✅ Job "${title}" completed in ${Math.round(result.durationMs / 1000)}s`);

        // Check approval gate
        this.checkAutoApproval(jobId, result.response || '');

        this.sse.broadcast({
          type: 'job_completed',
          data: { jobId, title, durationMs: result.durationMs, usedTools: result.usedTools },
        });
      } else {
        this.stats.totalFailed++;
        console.log(`[AutoPilot] ❌ Job "${title}" failed: ${result.error}`);
        this.sse.broadcast({
          type: 'job_failed',
          data: { jobId, title, error: result.error },
        });
      }
    } catch (err: any) {
      this.stats.totalFailed++;
      console.error(`[AutoPilot] Dispatch error for "${title}":`, err.message);
    } finally {
      this.activeDispatches.delete(jobId);
    }
  }

  /**
   * Auto-approve if confidence is above threshold.
   */
  private checkAutoApproval(jobId: string, response: string): void {
    // Extract confidence from response (same pattern as missionControlRoutes)
    const confidenceMatch = response.match(/(?:confidence|güven)[:\s]*(\d+(?:\.\d+)?)/i);
    const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : null;
    const normalizedConfidence = confidence !== null ? (confidence > 1 ? confidence / 100 : confidence) : null;

    if (normalizedConfidence !== null && normalizedConfidence >= this.config.autoApproveThreshold) {
      // Auto-approve
      this.emitEvent('job', jobId, 'auto_approved',
        `AutoPilot auto-approved (confidence: ${(normalizedConfidence * 100).toFixed(0)}% >= ${(this.config.autoApproveThreshold * 100).toFixed(0)}%)`);
      this.sse.broadcast({ type: 'auto_approved', data: { jobId, confidence: normalizedConfidence } });
    } else if (normalizedConfidence !== null) {
      // Low confidence — flag for human review
      this.emitEvent('job', jobId, 'needs_review',
        `AutoPilot flagged for review (confidence: ${(normalizedConfidence * 100).toFixed(0)}% < ${(this.config.autoApproveThreshold * 100).toFixed(0)}%)`);
      this.sse.broadcast({ type: 'needs_review', data: { jobId, confidence: normalizedConfidence } });
    }
  }


  /**
   * Trigger 2: Detect DM pipeline failures and create fix jobs.
   * Looks for consecutive failures in instagram_interactions.
   */
  private scanDmFailures(): ScanResult | null {
    try {
      const recentErrors = this.db.prepare(`
        SELECT COUNT(*) as count FROM instagram_interactions
        WHERE pipeline_error IS NOT NULL
          AND created_at >= datetime('now', '-1 hour')
      `).get() as any;

      if (!recentErrors || recentErrors.count < this.config.dmFailureThreshold) return null;

      // Check if we already created a job for this in the last hour
      const existingJob = this.db.prepare(`
        SELECT id FROM mc_jobs
        WHERE source = 'cron' AND title LIKE '%DM Pipeline%'
          AND created_at >= datetime('now', '-1 hour')
        LIMIT 1
      `).get();

      if (existingJob) return null;

      // Get the actual errors for context
      const errors = this.db.prepare(`
        SELECT pipeline_error, model_tier, created_at
        FROM instagram_interactions
        WHERE pipeline_error IS NOT NULL
          AND created_at >= datetime('now', '-1 hour')
        ORDER BY created_at DESC LIMIT 5
      `).all() as any[];

      const errorSummary = errors.map((e: any) => `[${e.model_tier}] ${e.pipeline_error}`).join('\n');

      // Find the best agent for this (instagram or main)
      const agent = this.findAgentByRole('instagram') || this.findAgentByRole('default');
      if (!agent) return null;

      const jobId = randomUUID();
      this.db.prepare(`
        INSERT INTO mc_jobs (id, title, status, priority, source, agent_id, payload)
        VALUES (?, ?, 'queued', 'high', 'cron', ?, ?)
      `).run(
        jobId,
        `DM Pipeline Hata Analizi (${recentErrors.count} hata/saat)`,
        agent.id,
        JSON.stringify({ description: `Son 1 saatte ${recentErrors.count} DM pipeline hatası tespit edildi. Hataları analiz et ve çözüm öner.`, context: errorSummary, actionRequired: 'Analyze DM pipeline errors and suggest fixes', trigger: 'dm_failures' })
      );

      this.emitEvent('job', jobId, 'autopilot_created', `AutoPilot created DM failure analysis job (${recentErrors.count} errors)`);
      
      // Escalate via EscalationService (Telegram notification for infra issues)
      if (this.escalation) {
        this.escalation.escalate({
          source: 'dm_pipeline',
          type: 'dm_failures',
          severity: 'high',
          title: `DM Pipeline Hata (${recentErrors.count}/saat)`,
          details: `Son 1 saatte ${recentErrors.count} DM pipeline hatası.\n${errorSummary}`,
          jobId,
          metadata: { errorCount: recentErrors.count },
        }).catch(() => {});
      }

      return { trigger: 'dm_failures', jobsCreated: 1, jobsDispatched: 0, details: `${recentErrors.count} DM errors in last hour` };
    } catch (err: any) {
      console.error('[AutoPilot] DM failure scan error:', err.message);
      return null;
    }
  }

  /**
   * Trigger 3: Detect unreviewed policy violations.
   */
  private scanPolicyViolations(): ScanResult | null {
    try {
      const violations = this.db.prepare(`
        SELECT COUNT(*) as count FROM mc_events
        WHERE event_type = 'policy_violation'
          AND created_at >= datetime('now', '-2 hours')
      `).get() as any;

      if (!violations || violations.count < 2) return null;

      // Check if we already created a review job
      const existingJob = this.db.prepare(`
        SELECT id FROM mc_jobs
        WHERE source = 'cron' AND title LIKE '%Politika İhlal%'
          AND created_at >= datetime('now', '-2 hours')
        LIMIT 1
      `).get();

      if (existingJob) return null;

      const agent = this.findAgentByRole('analyst') || this.findAgentByRole('default');
      if (!agent) return null;

      const jobId = randomUUID();
      this.db.prepare(`
        INSERT INTO mc_jobs (id, title, status, priority, source, agent_id, payload)
        VALUES (?, ?, 'queued', 'medium', 'cron', ?, ?)
      `).run(
        jobId,
        `Politika İhlal İncelemesi (${violations.count} ihlal)`,
        agent.id,
        JSON.stringify({ description: `Son 2 saatte ${violations.count} politika ihlali tespit edildi. İhlalleri incele ve pattern analizi yap.`, trigger: 'policy_violations', violationCount: violations.count })
      );

      this.emitEvent('job', jobId, 'autopilot_created', `AutoPilot created policy violation review (${violations.count} violations)`);
      return { trigger: 'policy_violations', jobsCreated: 1, jobsDispatched: 0, details: `${violations.count} violations in 2h` };
    } catch (err: any) {
      console.error('[AutoPilot] Policy scan error:', err.message);
      return null;
    }
  }

  /**
   * Trigger 4: Detect cost spikes.
   */
  private scanCostSpikes(): ScanResult | null {
      try {
        // Compare today's cost to 7-day average
        const todayCost = this.db.prepare(`
          SELECT COALESCE(SUM(cost), 0) as total FROM mc_cost_ledger
          WHERE created_at >= date('now')
        `).get() as any;

        const avgCost = this.db.prepare(`
          SELECT COALESCE(AVG(daily_total), 0) as avg FROM (
            SELECT SUM(cost) as daily_total
            FROM mc_cost_ledger
            WHERE created_at >= date('now', '-7 days') AND created_at < date('now')
            GROUP BY date(created_at)
          )
        `).get() as any;

        if (!avgCost?.avg || avgCost.avg === 0 || !todayCost?.total) return null;
        if (todayCost.total < avgCost.avg * this.config.costSpikeMultiplier) return null;

        // Check if we already flagged today
        const existingJob = this.db.prepare(`
          SELECT id FROM mc_jobs
          WHERE source = 'cron' AND title LIKE '%Maliyet Artış%'
            AND created_at >= date('now')
          LIMIT 1
        `).get();

        if (existingJob) return null;

        const agent = this.findAgentByRole('finance') || this.findAgentByRole('default');
        if (!agent) return null;

        const jobId = randomUUID();
        const title = `Maliyet Artış Analizi (${todayCost.total.toFixed(3)} vs avg ${avgCost.avg.toFixed(3)})`;
        const desc = `Bugünkü maliyet (${todayCost.total.toFixed(3)}) 7 günlük ortalamanın (${avgCost.avg.toFixed(3)}) ${this.config.costSpikeMultiplier}x üzerinde. Analiz et.`;
        this.db.prepare(`
          INSERT INTO mc_jobs (id, title, status, priority, source, agent_id, payload)
          VALUES (?, ?, 'queued', 'medium', 'cron', ?, ?)
        `).run(
          jobId,
          title,
          agent.id,
          JSON.stringify({ description: desc, trigger: 'cost_spike', todayCost: todayCost.total, avgCost: avgCost.avg })
        );

        this.emitEvent('job', jobId, 'autopilot_created', `AutoPilot created cost spike analysis`);
        
        // Escalate via EscalationService (Telegram notification)
        if (this.escalation) {
          this.escalation.escalate({
            source: 'autopilot',
            type: 'cost_spike',
            severity: 'medium',
            title: `Maliyet Artışı (${todayCost.total.toFixed(3)} vs avg ${avgCost.avg.toFixed(3)})`,
            details: desc,
            jobId,
            metadata: { todayCost: todayCost.total, avgCost: avgCost.avg },
          }).catch(() => {});
        }

        return { trigger: 'cost_spikes', jobsCreated: 1, jobsDispatched: 0, details: `${todayCost.total.toFixed(3)} today vs ${avgCost.avg.toFixed(3)} avg` };
      } catch (err: any) {
        console.error('[AutoPilot] Cost scan error:', err.message);
        return null;
      }
    }


  /**
   * Find an MC agent by role keyword.
   */
  private findAgentByRole(role: string): { id: string; name: string } | null {
    const agent = this.db.prepare(`
      SELECT id, name FROM mc_agents
      WHERE LOWER(role) LIKE ? AND status IN ('idle', 'active')
      LIMIT 1
    `).get(`%${role}%`) as any;
    return agent || null;
  }

  /**
   * Manual trigger — dispatch a specific job immediately.
   */
  async manualDispatch(jobId: string): Promise<{ success: boolean; message: string }> {
    if (this.activeDispatches.has(jobId)) {
      return { success: false, message: 'Job already being dispatched' };
    }

    const job = this.db.prepare(`SELECT id, title, status FROM mc_jobs WHERE id = ?`).get(jobId) as any;
    if (!job) return { success: false, message: 'Job not found' };

    // Allow dispatching from queued or scheduled
    if (!['queued', 'scheduled', 'failed'].includes(job.status)) {
      return { success: false, message: `Cannot dispatch job in '${job.status}' status` };
    }

    // Move to scheduled first if queued
    if (job.status === 'queued' || job.status === 'failed') {
      this.db.prepare(`UPDATE mc_jobs SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(jobId);
    }

    const promise = this.executeDispatch(jobId, job.title);
    this.activeDispatches.set(jobId, promise);
    return { success: true, message: `Dispatching "${job.title}"` };
  }

  private emitEvent(entityType: string, entityId: string, eventType: string, message: string, fromState?: string, toState?: string): void {
    this.db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, from_state, to_state, message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entityType, entityId, eventType, fromState || null, toState || null, message);
  }
}
