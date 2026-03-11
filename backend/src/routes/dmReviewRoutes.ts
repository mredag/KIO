import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { DMConversationReviewService, getDMConversationReviewService } from '../services/DMConversationReviewService.js';

let _service: DMConversationReviewService | null = null;

export function setDMReviewService(service: DMConversationReviewService): void {
  _service = service;
}

function getService(): DMConversationReviewService | null {
  return _service || getDMConversationReviewService();
}

export function createDMReviewRoutes(_db: Database.Database): Router {
  const router = Router();

  router.get('/config', (_req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    res.json(service.getConfig());
  });

  router.patch('/config', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const config = service.saveConfig(req.body || {});
    res.json({ ok: true, config });
  });

  router.post('/prompt-preview', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const preview = service.getPromptPreview(req.body || {});
    res.json({ ok: true, preview });
  });

  router.post('/runs', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const run = service.startRun(req.body || {});
    res.status(202).json({ ok: true, runId: run.id, run });
  });

  router.get('/runs', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    res.json({ runs: service.listRuns(limit) });
  });

  router.get('/runs/:runId', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const run = service.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  });

  router.get('/runs/:runId/findings', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const findings = service.listFindings(req.params.runId, {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
      flag: typeof req.query.flag === 'string' ? req.query.flag : undefined,
      unresolvedOnly: req.query.unresolvedOnly === 'true',
      hallucinationOnly: req.query.hallucinationOnly === 'true',
      repetitiveOnly: req.query.repetitiveOnly === 'true',
      limit: typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined,
    });
    res.json({ findings });
  });

  router.get('/runs/:runId/findings/:findingId', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    const finding = service.getFinding(req.params.runId, req.params.findingId);
    if (!finding) return res.status(404).json({ error: 'Finding not found' });
    res.json(finding);
  });

  router.post('/findings/:findingId/jobs', (req: Request, res: Response) => {
    const service = getService();
    if (!service) return res.status(503).json({ error: 'DM review service not initialized' });
    try {
      const job = service.createJobFromFinding(req.params.findingId, {
        priority: typeof req.body?.priority === 'string' ? req.body.priority : undefined,
        agentId: typeof req.body?.agentId === 'string' ? req.body.agentId : undefined,
      });
      res.status(201).json({ ok: true, job });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to create job' });
    }
  });

  return router;
}
