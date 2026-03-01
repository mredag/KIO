/**
 * Morning Briefing API Routes — Status, config, manual trigger, preview.
 * Factory pattern: createBriefingRoutes(db)
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { MorningBriefingService } from '../services/MorningBriefingService.js';

let _service: MorningBriefingService | null = null;

export function setBriefingService(service: MorningBriefingService): void {
  _service = service;
}

export function createBriefingRoutes(_db: Database.Database): Router {
  const router = Router();

  // GET /status
  router.get('/status', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Briefing service not initialized' });
    res.json(_service.getStatus());
  });

  // GET /config
  router.get('/config', (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Briefing service not initialized' });
    res.json(_service.getConfig());
  });

  // PATCH /config
  router.patch('/config', (req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Briefing service not initialized' });
    const updated = _service.saveConfig(req.body);
    res.json({ ok: true, config: updated });
  });

  // POST /send — Manual trigger
  router.post('/send', async (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Briefing service not initialized' });
    try {
      const result = await _service.sendBriefing();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /preview — Preview HTML without sending
  router.get('/preview', async (_req: Request, res: Response) => {
    if (!_service) return res.status(503).json({ error: 'Briefing service not initialized' });
    try {
      const html = await _service.generateBriefingHtml();
      res.json({ html });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
