/**
 * Cron Overview API — Unified view of all scheduled tasks in the system.
 * Aggregates cron jobs from AutoPilot, NightlyAudit, MCScheduler, Backup, etc.
 * Provides detail, toggle, and manual trigger endpoints.
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

interface CronJobInfo {
  id: string;
  name: string;
  schedule: string;
  timezone: string;
  category: 'ai' | 'system' | 'scheduler' | 'data';
  status: 'active' | 'stopped' | 'unknown';
  description: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | 'unknown';
  lastRunDetail: string | null;
  nextRunAt: string | null;
  manualTrigger: string | null;
  configEndpoint: string | null;
  canToggle: boolean;
  canTrigger: boolean;
}

// Simple next-run calculator for common cron patterns
function getNextRun(schedule: string, _tz: string): string | null {
  try {
    const now = new Date();
    const parts = schedule.split(/\s+/);
    if (parts.length < 5) return null;

    const [min, hour, dom, mon, dow] = parts;

    if (dom === '*' && mon === '*' && dow === '*' && !hour.includes('/') && !min.includes('/')) {
      const h = parseInt(hour);
      const m = parseInt(min);
      if (isNaN(h) || isNaN(m)) return null;
      const next = new Date(now);
      next.setHours(h, m, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toISOString();
    }

    if (parts.length === 6 && parts[0].startsWith('*/')) {
      const secs = parseInt(parts[0].replace('*/', ''));
      return new Date(now.getTime() + secs * 1000).toISOString();
    }
    if (min.startsWith('*/')) {
      const mins = parseInt(min.replace('*/', ''));
      return new Date(now.getTime() + mins * 60000).toISOString();
    }
    if (min === '*' && hour === '*') {
      return new Date(now.getTime() + 60000).toISOString();
    }
    return null;
  } catch { return null; }
}

// Providers
type JobProvider = () => CronJobInfo[];
type ToggleHandler = (jobId: string, enabled: boolean) => { ok: boolean; status: string };
type TriggerHandler = (jobId: string) => Promise<{ ok: boolean; message: string; detail?: any }>;

let _providers: JobProvider[] = [];
const _toggleHandlers: Record<string, ToggleHandler> = {};
const _triggerHandlers: Record<string, TriggerHandler> = {};

export function registerCronProvider(provider: JobProvider): void {
  _providers.push(provider);
}

export function registerCronToggle(jobId: string, handler: ToggleHandler): void {
  _toggleHandlers[jobId] = handler;
}

export function registerCronTrigger(jobId: string, handler: TriggerHandler): void {
  _triggerHandlers[jobId] = handler;
}

function getAllJobs(): CronJobInfo[] {
  const allJobs: CronJobInfo[] = [];
  for (const provider of _providers) {
    try { allJobs.push(...provider()); } catch {}
  }
  const order: Record<string, number> = { ai: 0, scheduler: 1, system: 2, data: 3 };
  allJobs.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9));
  return allJobs;
}

export function createCronRoutes(db: Database.Database): Router {
  const router = Router();

  // ── Static providers (system cron jobs from index.ts) ──
  registerCronProvider(() => [
    {
      id: 'token-cleanup', name: 'Token Temizliği', schedule: '0 3 * * *',
      timezone: 'Europe/Istanbul', category: 'data', status: 'active',
      description: 'Süresi dolmuş kupon tokenlarını temizler',
      lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
      nextRunAt: getNextRun('0 3 * * *', 'Europe/Istanbul'),
      manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
    },
    {
      id: 'redemption-expiry', name: 'Kupon Süresi Dolumu', schedule: '0 3 * * *',
      timezone: 'Europe/Istanbul', category: 'data', status: 'active',
      description: 'Bekleyen kupon kullanımlarını süre dolumu ile iptal eder',
      lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
      nextRunAt: getNextRun('0 3 * * *', 'Europe/Istanbul'),
      manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
    },
    {
      id: 'rate-limit-reset', name: 'Rate Limit Sıfırlama', schedule: '1 0 * * *',
      timezone: 'Europe/Istanbul', category: 'system', status: 'active',
      description: 'Süresi dolmuş rate limit sayaçlarını sıfırlar',
      lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
      nextRunAt: getNextRun('1 0 * * *', 'Europe/Istanbul'),
      manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
    },
    {
      id: 'daily-backup', name: 'Günlük Yedekleme', schedule: '0 2 * * *',
      timezone: 'Europe/Istanbul', category: 'system', status: 'active',
      description: 'Veritabanı günlük otomatik yedekleme',
      lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
      nextRunAt: getNextRun('0 2 * * *', 'Europe/Istanbul'),
      manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
    },
    {
      id: 'log-rotation', name: 'Log Rotasyonu', schedule: '0 2 * * *',
      timezone: 'Europe/Istanbul', category: 'system', status: 'active',
      description: 'Eski logları temizler (30 gün saklama)',
      lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
      nextRunAt: getNextRun('0 2 * * *', 'Europe/Istanbul'),
      manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
    },
    {
      id: 'sync-queue', name: 'Google Sheets Senkronizasyon', schedule: '*/5 * * * *',
      timezone: 'system', category: 'data', status: 'active',
      description: 'Yanıtları Google Sheets ile senkronize eder (5dk)',
      lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
      nextRunAt: getNextRun('*/5 * * * *', 'system'),
      manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
    },
  ]);

  // ── Dynamic providers ──

  // AutoPilot provider
  registerCronProvider(() => {
    const apConfig = db.prepare(`SELECT conditions FROM mc_policies WHERE id = 'autopilot_config'`).get() as any;
    const apCfg = apConfig?.conditions ? JSON.parse(apConfig.conditions) : {};
    const apInterval = Math.max(apCfg.scanIntervalSeconds || 60, 30);

    const lastApEvent = db.prepare(`
      SELECT message, created_at FROM mc_events
      WHERE event_type LIKE 'autopilot_%' ORDER BY created_at DESC LIMIT 1
    `).get() as any;

    return [{
      id: 'autopilot', name: 'AutoPilot Tarama',
      schedule: `*/${apInterval} * * * * *`, timezone: 'system', category: 'ai',
      status: apCfg.enabled !== false ? 'active' : 'stopped',
      description: `Otonom ajan motoru — ${apInterval}s aralıkla tarama (4 tetikleyici)`,
      lastRunAt: lastApEvent?.created_at || null,
      lastRunStatus: lastApEvent ? 'success' : 'unknown',
      lastRunDetail: lastApEvent?.message || null,
      nextRunAt: getNextRun(`*/${apInterval} * * * * *`, 'system'),
      manualTrigger: '/api/mc/autopilot/start',
      configEndpoint: '/api/mc/autopilot/config',
      canToggle: true, canTrigger: true,
    }];
  });

  // NightlyAudit provider
  registerCronProvider(() => {
    const auditConfig = db.prepare(`SELECT conditions FROM mc_policies WHERE id = 'nightly_audit_config'`).get() as any;
    const auditCfg = auditConfig?.conditions ? JSON.parse(auditConfig.conditions) : {};

    const lastAudit = db.prepare(`
      SELECT message, metadata, created_at FROM mc_events
      WHERE event_type = 'audit_completed' AND entity_type = 'system'
      ORDER BY created_at DESC LIMIT 1
    `).get() as any;

    let lastDetail = lastAudit?.message || null;
    if (lastAudit?.metadata) {
      try {
        const m = JSON.parse(lastAudit.metadata);
        lastDetail = `${m.audited} incelendi, ${m.grounded} doğru, ${m.hallucinated} uydurma`;
      } catch {}
    }

    return [{
      id: 'nightly-audit', name: 'Gece DM Denetimi',
      schedule: auditCfg.cronSchedule || '0 2 * * *',
      timezone: auditCfg.timezone || 'Europe/Istanbul', category: 'ai',
      status: auditCfg.enabled !== false ? 'active' : 'stopped',
      description: 'Tüm DM yanıtlarını KB ile karşılaştırarak doğruluk denetimi yapar',
      lastRunAt: lastAudit?.created_at || null,
      lastRunStatus: lastAudit ? 'success' : 'unknown',
      lastRunDetail: lastDetail,
      nextRunAt: getNextRun(auditCfg.cronSchedule || '0 2 * * *', auditCfg.timezone || 'Europe/Istanbul'),
      manualTrigger: '/api/mc/audit/run',
      configEndpoint: '/api/mc/audit/config',
      canToggle: true, canTrigger: true,
    }];
  });

  // MCScheduler provider
  registerCronProvider(() => [{
    id: 'mc-scheduler-dispatch', name: 'İş Dağıtıcı',
    schedule: '*/30 * * * * *', timezone: 'system', category: 'scheduler',
    status: 'active',
    description: 'Kuyruktaki görevleri zamanlanmış duruma taşır (30s)',
    lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
    nextRunAt: getNextRun('*/30 * * * * *', 'system'),
    manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
  },
  {
    id: 'mc-sla-monitor', name: 'SLA İzleyici',
    schedule: '* * * * *', timezone: 'system', category: 'scheduler',
    status: 'active',
    description: 'SLA süresi dolan görevleri tespit eder (60s)',
    lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
    nextRunAt: getNextRun('* * * * *', 'system'),
    manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
  },
  {
    id: 'mc-dead-letter', name: 'Dead Letter İşleyici',
    schedule: '*/5 * * * *', timezone: 'system', category: 'scheduler',
    status: 'active',
    description: 'Başarısız görevleri yeniden dener veya arşivler (5dk)',
    lastRunAt: null, lastRunStatus: 'unknown', lastRunDetail: null,
    nextRunAt: getNextRun('*/5 * * * *', 'system'),
    manualTrigger: null, configEndpoint: null, canToggle: false, canTrigger: false,
  }]);

  // ── GET /jobs — All cron jobs ──
  router.get('/jobs', (_req: Request, res: Response) => {
    res.json(getAllJobs());
  });

  // ── GET /jobs/:id — Job detail with recent events ──
  router.get('/jobs/:id', (req: Request, res: Response) => {
    const job = getAllJobs().find(j => j.id === req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Fetch recent events related to this job
    let recentEvents: any[] = [];
    try {
      if (job.id === 'autopilot') {
        recentEvents = db.prepare(`
          SELECT id, event_type, message, metadata, created_at FROM mc_events
          WHERE event_type LIKE 'autopilot_%'
          ORDER BY created_at DESC LIMIT 20
        `).all();
      } else if (job.id === 'nightly-audit') {
        recentEvents = db.prepare(`
          SELECT id, event_type, message, metadata, created_at FROM mc_events
          WHERE (event_type = 'audit_completed' OR event_type = 'audit_started') AND entity_type = 'system'
          ORDER BY created_at DESC LIMIT 20
        `).all();
      } else if (job.id === 'mc-scheduler-dispatch') {
        recentEvents = db.prepare(`
          SELECT id, event_type, message, metadata, created_at FROM mc_events
          WHERE event_type = 'auto_dispatched'
          ORDER BY created_at DESC LIMIT 20
        `).all();
      } else if (job.id === 'mc-sla-monitor') {
        recentEvents = db.prepare(`
          SELECT id, event_type, message, metadata, created_at FROM mc_events
          WHERE event_type = 'sla_breach'
          ORDER BY created_at DESC LIMIT 20
        `).all();
      } else if (job.id === 'mc-dead-letter') {
        recentEvents = db.prepare(`
          SELECT id, event_type, message, metadata, created_at FROM mc_events
          WHERE event_type = 'dead_lettered'
          ORDER BY created_at DESC LIMIT 20
        `).all();
      }
    } catch {}

    res.json({ ...job, recentEvents });
  });

  // ── POST /jobs/:id/trigger — Manual trigger ──
  router.post('/jobs/:id/trigger', async (req: Request, res: Response) => {
    const jobId = req.params.id;
    const handler = _triggerHandlers[jobId];
    if (!handler) {
      return res.status(400).json({ error: 'Bu görev manuel tetiklenemiyor', jobId });
    }
    try {
      const result = await handler(jobId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── PATCH /jobs/:id/toggle — Enable/disable ──
  router.patch('/jobs/:id/toggle', (req: Request, res: Response) => {
    const jobId = req.params.id;
    const handler = _toggleHandlers[jobId];
    if (!handler) {
      return res.status(400).json({ error: 'Bu görev açılıp kapatılamıyor', jobId });
    }
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled (boolean) gerekli' });
    }
    try {
      const result = handler(jobId, enabled);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
