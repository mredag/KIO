/**
 * Nightly Audit API Routes — View audit history, trigger manual runs, manage config.
 * Factory pattern: createAuditRoutes(db) — same as all MC routes.
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { NightlyAuditService } from '../services/NightlyAuditService.js';

let _service: NightlyAuditService | null = null;

export function setAuditService(service: NightlyAuditService): void {
  _service = service;
}

export function createAuditRoutes(_db: Database.Database): Router {
  const router = Router();

  // GET /status — Current audit service status
  router.get('/status', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    res.json(_service.getStatus());
  });

  // GET /config — Current config
  router.get('/config', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    res.json(_service.getConfig());
  });

  // PATCH /config — Update config (partial merge)
  router.patch('/config', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    const updated = _service.saveConfig(req.body);
    res.json({ ok: true, config: updated });
  });

  // POST /run — Manual trigger
  router.post('/run', async (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    try {
      const result = await _service.runAudit();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /history — Past audit runs
  router.get('/history', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const history = _service.getAuditHistory(limit);
    res.json(history);
  });

  // GET /latest — Most recent audit detail
  router.get('/latest', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    const history = _service.getAuditHistory(1);
    if (history.length === 0) return res.json(null);
    const detail = _service.getAuditDetail(history[0].run_id);
    res.json(detail);
  });

  // GET /:runId — Specific audit run detail
  router.get('/:runId', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Audit service not initialized' });
    const detail = _service.getAuditDetail(req.params.runId);
    if (!detail) return res.status(404).json({ error: 'Audit run not found' });
    res.json(detail);
  });

  return router;
}
