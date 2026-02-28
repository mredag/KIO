/**
 * AgentLifecycleService — State machine for agent provisioning, wake, check-in, reconciliation.
 * Inspired by reference lifecycle_orchestrator.py but adapted for our SQLite + cron approach.
 */
import Database from 'better-sqlite3';

const MAX_WAKE_ATTEMPTS = 3;
const CHECKIN_DEADLINE_SECONDS = 120; // 2 minutes

export class AgentLifecycleService {
  private static instance: AgentLifecycleService | null = null;
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureColumns();
  }

  static init(db: Database.Database): AgentLifecycleService {
    if (!AgentLifecycleService.instance) {
      AgentLifecycleService.instance = new AgentLifecycleService(db);
    }
    return AgentLifecycleService.instance;
  }

  static getInstance(): AgentLifecycleService | null {
    return AgentLifecycleService.instance;
  }

  /** Add lifecycle columns to mc_agents if missing */
  private ensureColumns(): void {
    const cols = this.db.prepare("PRAGMA table_info(mc_agents)").all() as any[];
    const colNames = new Set(cols.map((c: any) => c.name));
    const additions: [string, string][] = [
      ['lifecycle_status', "TEXT DEFAULT 'idle'"],
      ['lifecycle_generation', 'INTEGER DEFAULT 0'],
      ['wake_attempts', 'INTEGER DEFAULT 0'],
      ['last_wake_at', 'TEXT'],
      ['checkin_deadline_at', 'TEXT'],
      ['last_provision_error', 'TEXT'],
      ['last_seen_at', 'TEXT'],
    ];
    for (const [name, def] of additions) {
      if (!colNames.has(name)) {
        this.db.exec(`ALTER TABLE mc_agents ADD COLUMN ${name} ${def}`);
      }
    }
  }

  /** Start provisioning an agent */
  provision(agentId: string): any {
    const agent = this.db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(agentId) as any;
    if (!agent) throw new Error('Agent not found');

    const gen = (agent.lifecycle_generation || 0) + 1;
    const deadline = new Date(Date.now() + CHECKIN_DEADLINE_SECONDS * 1000).toISOString();

    this.db.prepare(`
      UPDATE mc_agents SET
        lifecycle_status = 'provisioning',
        lifecycle_generation = ?,
        wake_attempts = COALESCE(wake_attempts, 0) + 1,
        last_wake_at = datetime('now'),
        checkin_deadline_at = ?,
        last_provision_error = NULL,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(gen, deadline, agentId);

    this.logEvent(agentId, 'lifecycle_provision', `Agent provisioning started (gen ${gen})`);
    return this.db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(agentId);
  }

  /** Agent checked in successfully */
  checkin(agentId: string): any {
    this.db.prepare(`
      UPDATE mc_agents SET
        lifecycle_status = 'online',
        last_seen_at = datetime('now'),
        checkin_deadline_at = NULL,
        last_provision_error = NULL,
        status = 'active',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(agentId);

    this.logEvent(agentId, 'lifecycle_checkin', 'Agent checked in, now online');
    return this.db.prepare('SELECT * FROM mc_agents WHERE id = ?').get(agentId);
  }

  /** Mark agent offline */
  markOffline(agentId: string, error?: string): void {
    this.db.prepare(`
      UPDATE mc_agents SET
        lifecycle_status = 'offline',
        last_provision_error = ?,
        status = 'idle',
        updated_at = datetime('now')
      WHERE id = ?
    `).run(error || 'Check-in deadline exceeded', agentId);

    this.logEvent(agentId, 'lifecycle_offline', error || 'Agent marked offline');
  }

  /** Mark provision error */
  markError(agentId: string, error: string): void {
    this.db.prepare(`
      UPDATE mc_agents SET
        lifecycle_status = 'error',
        last_provision_error = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(error, agentId);

    this.logEvent(agentId, 'lifecycle_error', error);
  }

  /** Reconcile stuck agents — called by AutoPilot cron */
  reconcile(): { checked: number; woken: number; offlined: number } {
    const now = new Date().toISOString();
    const stuck = this.db.prepare(`
      SELECT * FROM mc_agents
      WHERE lifecycle_status IN ('provisioning', 'online')
        AND checkin_deadline_at IS NOT NULL
        AND checkin_deadline_at < ?
    `).all(now) as any[];

    let woken = 0;
    let offlined = 0;

    for (const agent of stuck) {
      if ((agent.wake_attempts || 0) < MAX_WAKE_ATTEMPTS) {
        // Retry wake
        this.provision(agent.id);
        woken++;
      } else {
        // Max attempts exceeded — mark offline
        this.markOffline(agent.id, `Max wake attempts (${MAX_WAKE_ATTEMPTS}) exceeded`);
        offlined++;
      }
    }

    return { checked: stuck.length, woken, offlined };
  }

  /** Update last_seen_at for heartbeat tracking */
  heartbeat(agentId: string): void {
    this.db.prepare(`
      UPDATE mc_agents SET last_seen_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(agentId);
  }

  /** Get lifecycle summary for all agents */
  getSummary(): Record<string, number> {
    const rows = this.db.prepare(`
      SELECT lifecycle_status, COUNT(*) as count FROM mc_agents
      GROUP BY lifecycle_status
    `).all() as any[];
    const summary: Record<string, number> = { idle: 0, provisioning: 0, online: 0, offline: 0, error: 0 };
    for (const r of rows) {
      summary[r.lifecycle_status || 'idle'] = r.count;
    }
    return summary;
  }

  private logEvent(agentId: string, eventType: string, message: string): void {
    try {
      this.db.prepare(`
        INSERT INTO mc_events (entity_type, entity_id, event_type, message, created_at)
        VALUES ('agent', ?, ?, ?, datetime('now'))
      `).run(agentId, eventType, message);
    } catch { /* non-critical */ }
  }
}
