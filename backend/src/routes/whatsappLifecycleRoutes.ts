import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

let _db: Database.Database;

export function createWhatsappLifecycleRoutes(db: Database.Database): Router {
  _db = db;
  const router = Router();

  /**
   * POST / — Receive OpenClaw lifecycle events for WhatsApp channel
   * Body: { event: 'session_start' | 'session_end' | 'session_error', sessionKey?: string, error?: string, timestamp?: string }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { event, sessionKey, error, timestamp } = req.body;
      const now = new Date().toISOString();

      // Map event to mc_events event_type
      const eventTypeMap: Record<string, string> = {
        'session_start': 'whatsapp_session_start',
        'session_end': 'whatsapp_session_end',
        'session_error': 'whatsapp_session_error',
      };

      const eventType = eventTypeMap[event] || `whatsapp_${event}`;

      // Log to mc_events
      _db.prepare(`
        INSERT INTO mc_events (entity_type, entity_id, event_type, message, metadata)
        VALUES ('agent', 'whatsapp-dm', ?, ?, ?)
      `).run(
        eventType,
        `WhatsApp ${event}: ${sessionKey || 'unknown'}`,
        JSON.stringify({ sessionKey, error: error || null, timestamp: timestamp || now })
      );

      // Update mc_agents status based on event
      if (event === 'session_start') {
        _db.prepare(`UPDATE mc_agents SET status = 'active', updated_at = ? WHERE id = 'whatsapp-dm'`).run(now);
      } else if (event === 'session_end') {
        _db.prepare(`UPDATE mc_agents SET status = 'idle', updated_at = ? WHERE id = 'whatsapp-dm'`).run(now);
      } else if (event === 'session_error') {
        _db.prepare(`UPDATE mc_agents SET status = 'error', updated_at = ? WHERE id = 'whatsapp-dm'`).run(now);

        // Trigger Telegram notification for errors (fire-and-forget)
        triggerErrorEscalation(sessionKey, error);
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('[WA Lifecycle] webhook error:', err);
      res.status(500).json({ error: 'Failed to process lifecycle event' });
    }
  });

  return router;
}

function triggerErrorEscalation(sessionKey?: string, error?: string): void {
  (async () => {
    try {
      const { TelegramNotificationService } = await import('../services/TelegramNotificationService.js');
      const telegram = new TelegramNotificationService(_db);

      if (!telegram.isEnabled()) return;

      await telegram.notify({
        jobId: 'no-job',
        severity: 'high',
        title: 'WhatsApp Oturum Hatası',
        body: `⚠️ WhatsApp oturumu hata verdi\nOturum: ${sessionKey || 'bilinmiyor'}\nHata: ${error || 'bilinmiyor'}`,
        source: 'dm_pipeline',
      });
    } catch (err) {
      console.error('[WA Lifecycle] Escalation error:', err);
    }
  })();
}
