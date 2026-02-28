import cron from 'node-cron';
import type Database from 'better-sqlite3';

/**
 * MCSchedulerService - Cron-based job scheduler for Mission Control
 *
 * Responsibilities:
 * - Auto-dispatch queued jobs to available agents (every 30s)
 * - Monitor SLA deadlines and flag overdue jobs (every 60s)
 * - Move exhausted-retry jobs to dead_letter (every 5m)
 * - Expose scheduler status for dashboard widget
 */
export class MCSchedulerService {
  private db: Database.Database;
  private tasks: cron.ScheduledTask[] = [];
  private stats = {
    dispatched: 0,
    slaBreaches: 0,
    deadLettered: 0,
    lastRunAt: null as string | null,
    isRunning: false,
  };

  constructor(db: Database.Database) {
    this.db = db;
  }

  start(): void {
    if (this.stats.isRunning) return;
    this.stats.isRunning = true;

    // Auto-dispatch queued jobs every 30 seconds
    this.tasks.push(
      cron.schedule('*/30 * * * * *', () => {
        try { this.dispatchQueuedJobs(); }
        catch (err: any) { console.error('[MCScheduler] dispatch error:', err.message); }
      })
    );

    // SLA deadline monitor every 60 seconds
    this.tasks.push(
      cron.schedule('* * * * *', () => {
        try { this.checkSLADeadlines(); }
        catch (err: any) { console.error('[MCScheduler] SLA check error:', err.message); }
      })
    );

    // Dead letter cleanup every 5 minutes
    this.tasks.push(
      cron.schedule('*/5 * * * *', () => {
        try { this.processDeadLetters(); }
        catch (err: any) { console.error('[MCScheduler] dead letter error:', err.message); }
      })
    );

    console.log('[MCScheduler] Started with 3 cron tasks');
  }

  stop(): void {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    this.stats.isRunning = false;
    console.log('[MCScheduler] Stopped');
  }

  getStatus() {
    return { ...this.stats };
  }

  /** Manual trigger for dispatch cycle */
  dispatchNow(): void {
    this.dispatchQueuedJobs();
  }

  /**
   * Auto-dispatch: find queued jobs with assigned agents, move to 'scheduled'
   * Priority ordering: critical > high > medium > low, then by created_at ASC
   */
  private dispatchQueuedJobs(): void {
    const priorityOrder = `CASE priority
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      ELSE 5 END`;

    const queuedJobs = this.db.prepare(`
      SELECT j.id, j.title, j.agent_id, j.priority
      FROM mc_jobs j
      WHERE j.status = 'queued' AND j.agent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM mc_task_deps td
          JOIN mc_jobs dep ON dep.id = td.depends_on_job_id
          WHERE td.job_id = j.id AND dep.status != 'completed'
        )
        AND (j.board_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM mc_boards b WHERE b.id = j.board_id AND b.status = 'paused'
        ))
      ORDER BY ${priorityOrder}, j.created_at ASC
      LIMIT 5
    `).all() as any[];

    if (queuedJobs.length === 0) return;

    // Get idle agents
    const idleAgents = new Set(
      (this.db.prepare(`SELECT id FROM mc_agents WHERE status IN ('idle', 'active')`).all() as any[])
        .map(a => a.id)
    );

    // Check which agents already have running jobs
    const busyAgents = new Set(
      (this.db.prepare(`SELECT DISTINCT agent_id FROM mc_jobs WHERE status = 'running' AND agent_id IS NOT NULL`).all() as any[])
        .map(j => j.agent_id)
    );

    let dispatched = 0;
    for (const job of queuedJobs) {
      if (!idleAgents.has(job.agent_id) || busyAgents.has(job.agent_id)) continue;

      this.db.prepare(`
        UPDATE mc_jobs SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(job.id);

      this.emitEvent('job', job.id, 'auto_dispatched',
        `Job "${job.title}" auto-dispatched (${job.priority})`, 'queued', 'scheduled');

      busyAgents.add(job.agent_id);
      dispatched++;
    }

    if (dispatched > 0) {
      this.stats.dispatched += dispatched;
      this.stats.lastRunAt = new Date().toISOString();
    }
  }

  /**
   * SLA monitor: flag jobs past their sla_deadline
   */
  private checkSLADeadlines(): void {
    const overdueJobs = this.db.prepare(`
      SELECT id, title, sla_deadline, status
      FROM mc_jobs
      WHERE sla_deadline IS NOT NULL
        AND sla_deadline < datetime('now')
        AND status IN ('queued', 'scheduled', 'running', 'waiting_input')
    `).all() as any[];

    for (const job of overdueJobs) {
      // Check if we already emitted an SLA breach event for this job
      const existing = this.db.prepare(`
        SELECT id FROM mc_events
        WHERE entity_id = ? AND event_type = 'sla_breach'
        LIMIT 1
      `).get(job.id);

      if (!existing) {
        this.emitEvent('job', job.id, 'sla_breach',
          `SLA deadline breached for "${job.title}" (deadline: ${job.sla_deadline})`,
          undefined, undefined, { sla_deadline: job.sla_deadline, current_status: job.status });
        this.stats.slaBreaches++;
      }
    }
  }

  /**
   * Dead letter: move failed jobs that exhausted retries
   */
  private processDeadLetters(): void {
    const exhausted = this.db.prepare(`
      SELECT id, title, retry_count, max_retries
      FROM mc_jobs
      WHERE status = 'failed' AND retry_count >= max_retries
    `).all() as any[];

    for (const job of exhausted) {
      this.db.prepare(`
        UPDATE mc_jobs SET status = 'dead_letter', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(job.id);

      this.emitEvent('job', job.id, 'dead_lettered',
        `Job "${job.title}" moved to dead letter (${job.retry_count}/${job.max_retries} retries)`,
        'failed', 'dead_letter');
      this.stats.deadLettered++;
    }
  }

  private emitEvent(
    entityType: string, entityId: string, eventType: string,
    message: string, fromState?: string, toState?: string, metadata?: any
  ): void {
    this.db.prepare(`
      INSERT INTO mc_events (entity_type, entity_id, event_type, from_state, to_state, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entityType, entityId, eventType,
      fromState || null, toState || null, message,
      metadata ? JSON.stringify(metadata) : null
    );
  }
}
