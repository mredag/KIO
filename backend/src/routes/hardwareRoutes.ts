/**
 * Hardware Watchdog API Routes — System health monitoring for Pi 5.
 * Factory pattern: createHardwareRoutes(db)
 *
 * Endpoints:
 *   GET  /health    — Current snapshot (live collection)
 *   GET  /status    — Service status + last snapshot
 *   GET  /history   — Historical snapshots from mc_events
 *   GET  /alerts    — Alert history
 *   GET  /config    — Current thresholds + schedule
 *   PATCH /config   — Update config (partial merge)
 *   POST /check     — Manual trigger (collect + evaluate)
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { HardwareWatchdogService } from '../services/HardwareWatchdogService.js';

let _service: HardwareWatchdogService | null = null;

export function setHardwareWatchdogService(service: HardwareWatchdogService): void {
  _service = service;
}

export function createHardwareRoutes(_db: Database.Database): Router {
  const router = Router();

  // GET /health — Live snapshot (collects right now)
  router.get('/health', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    try {
      const snapshot = _service.collectSnapshot();
      res.json(snapshot);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /status — Service status + cached last snapshot
  router.get('/status', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    res.json(_service.getStatus());
  });

  // GET /history — Historical snapshots
  router.get('/history', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const history = _service.getHistory(limit);
    // Parse metadata JSON for convenience
    const parsed = history.map((h: any) => ({
      ...h,
      snapshot: h.metadata ? (() => { try { return JSON.parse(h.metadata); } catch { return null; } })() : null,
    }));
    res.json(parsed);
  });

  // GET /alerts — Alert history only
  router.get('/alerts', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    res.json(_service.getAlertHistory(limit));
  });

  // GET /config
  router.get('/config', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    res.json(_service.getConfig());
  });

  // PATCH /config — Partial update
  router.patch('/config', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    try {
      const updated = _service.saveConfig(req.body);
      res.json({ ok: true, config: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /check — Manual trigger
  router.post('/check', async (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Hardware watchdog not initialized' });
    try {
      const result = await _service.runCheck();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
