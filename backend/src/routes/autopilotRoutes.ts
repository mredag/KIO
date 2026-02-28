/**
 * AutoPilot API Routes — Control and monitor the autonomous agent engine.
 * Factory pattern: createAutoPilotRoutes(db) — same as all MC routes.
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { AutoPilotService } from '../services/AutoPilotService.js';
import { AutoPilotSSEManager } from '../services/AutoPilotSSEManager.js';

let _service: AutoPilotService | null = null;

export function setAutoPilotService(service: AutoPilotService): void {
  _service = service;
}

export function createAutoPilotRoutes(db: Database.Database): Router {
  const router = Router();
  const sse = AutoPilotSSEManager.getInstance();

  // GET /status — Current AutoPilot status + stats
  router.get('/status', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'AutoPilot not initialized' });
    res.json(_service.getStatus());
  });

  // GET /config — Current config
  router.get('/config', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'AutoPilot not initialized' });
    res.json(_service.getConfig());
  });

  // PATCH /config — Update config (partial merge)
  router.patch('/config', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'AutoPilot not initialized' });
    _service.saveConfig(req.body);
    sse.broadcast({ type: 'config_updated', data: { config: _service.getConfig() } });
    res.json({ ok: true, config: _service.getConfig() });
  });

  // POST /start — Start the engine
  router.post('/start', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'AutoPilot not initialized' });
    _service.start();
    res.json({ ok: true, status: 'running' });
  });

  // POST /stop — Stop the engine
  router.post('/stop', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'AutoPilot not initialized' });
    _service.stop();
    res.json({ ok: true, status: 'stopped' });
  });

  // POST /dispatch/:jobId — Manual dispatch a specific job
  router.post('/dispatch/:jobId', async (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'AutoPilot not initialized' });
    const result = await _service.manualDispatch(req.params.jobId);
    res.json(result);
  });

  // GET /stream — SSE stream for real-time updates
  router.get('/stream', (req: Request, res: Response) => {
    sse.addClient(res);
    // Send initial status
    if (_service) {
      const payload = `data: ${JSON.stringify({ type: 'status', data: _service.getStatus() })}\n\n`;
      res.write(payload);
    }
  });

  // GET /history — Recent AutoPilot events from mc_events
  router.get('/history', (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const events = db.prepare(`
      SELECT * FROM mc_events
      WHERE event_type LIKE 'autopilot_%' OR event_type IN ('auto_approved', 'needs_review')
      ORDER BY created_at DESC LIMIT ?
    `).all(limit);
    res.json(events);
  });

  return router;
}
