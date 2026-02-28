/**
 * Escalation Action Routes — Quick action endpoints for Telegram notification links.
 *
 * When admin clicks a link in a Telegram notification, it opens the browser
 * to one of these endpoints which executes the action and returns a simple HTML result.
 *
 * Endpoints:
 *   GET /api/mc/escalation/action?job=<id>&action=approve|reject|assign_analyst
 *   GET /api/mc/escalation/stats
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { EscalationService } from '../services/EscalationService.js';

let _escalationService: EscalationService | null = null;
export function setEscalationActionService(svc: EscalationService): void {
  _escalationService = svc;
}

export function createEscalationRoutes(db: Database.Database): Router {
  const router = Router();

  /**
   * GET /action — Execute a quick action from Telegram notification link.
   * Returns a simple HTML page so the admin sees feedback in Telegram's in-app browser.
   */
  router.get('/action', async (req: Request, res: Response) => {
    const jobId = req.query.job as string;
    const action = req.query.action as string;

    if (!jobId || !action) {
      return res.status(400).send(htmlPage('❌ Hata', 'Eksik parametre: job ve action gerekli.'));
    }

    if (!_escalationService) {
      return res.status(500).send(htmlPage('❌ Hata', 'Escalation servisi hazır değil.'));
    }

    const validActions = ['approve', 'reject', 'assign_analyst'];
    if (!validActions.includes(action)) {
      return res.status(400).send(htmlPage('❌ Hata', `Geçersiz aksiyon: ${action}`));
    }

    try {
      const result = await _escalationService.handleAdminDecision(
        jobId,
        action as 'approve' | 'reject' | 'detail'
      );
      const emoji = action === 'approve' ? '✅' : action === 'reject' ? '❌' : '📊';
      res.send(htmlPage(`${emoji} İşlem Tamamlandı`, result));
    } catch (err: any) {
      res.status(500).send(htmlPage('❌ Hata', err.message || 'Bilinmeyen hata'));
    }
  });

  /**
   * GET /stats — Escalation statistics for today.
   */
  router.get('/stats', (_req: Request, res: Response) => {
    if (!_escalationService) {
      return res.json({ error: 'Escalation service not initialized' });
    }
    res.json(_escalationService.getStats());
  });

  /**
   * POST /test — Trigger a test Telegram notification for a given sender.
   * Body: { senderId?: string, type?: string }
   * Uses the sender's stored name from instagram_customers if available.
   */
  router.post('/test', async (req: Request, res: Response) => {
    if (!_escalationService) {
      return res.status(500).json({ error: 'Escalation service not initialized' });
    }
    const senderId = req.body.senderId || 'test_sender_001';
    const source = (req.body.source || 'policy_agent') as 'policy_agent' | 'nightly_audit' | 'autopilot' | 'dm_pipeline';
    const type = req.body.type || 'policy_violation_critical';
    const severity = req.body.severity || 'critical';

    // Create a job first so buttons have a jobId to reference
    const { randomUUID } = await import('crypto');
    const jobId = randomUUID();
    try {
      db.prepare(`
        INSERT INTO mc_jobs (id, title, status, priority, source, payload)
        VALUES (?, ?, 'queued', ?, 'system', ?)
      `).run(jobId, `Test: ${type}`, severity, JSON.stringify({
        trigger: 'escalation_test', source, type,
        description: `Test notification for sender ${senderId}`,
      }));
    } catch { /* ignore if table issue */ }

    try {
      const result = await _escalationService.escalate({
        source,
        type,
        severity: severity as 'critical' | 'high' | 'medium' | 'low',
        title: `Test Bildirimi — ${senderId}`,
        details: [
          `Müşteri: "masaj fiyatları ne kadar?"`,
          `Yanıt (reddedilen): "Masaj fiyatlarımız 500₺'den başlamaktadır. Randevunuzu hemen oluşturuyorum!"`,
          `İhlaller: Kural 1 (randevu oluşturma), Kural 8 (uydurma fiyat)`,
          `Sebep: Asistan randevu oluşturamaz ve bilgi bankasında olmayan fiyat uydurmuş`,
          `Gönderilen: Yedek yanıt (telefon yönlendirme)`,
        ].join('\n'),
        metadata: { sender_id: senderId, violations: ['randevu', 'uydurma_fiyat'], source: 'test' },
        jobId,
      });
      res.json({ ok: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

/** Simple HTML page for Telegram in-app browser feedback. */
function htmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mission Control</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 400px; text-align: center; }
    h1 { font-size: 24px; margin: 0 0 16px; }
    p { font-size: 16px; color: #94a3b8; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
</body>
</html>`;
}
