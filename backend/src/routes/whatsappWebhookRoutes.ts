import { Router, Request, Response } from 'express';

/**
 * WhatsApp Webhook Routes
 * Handles Meta webhook verification and incoming messages
 * Messages are forwarded to n8n for processing
 */
export function createWhatsappWebhookRoutes(): Router {
  const router = Router();
  
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'spa_kiosk_webhook_verify_2024';
  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp';

  /**
   * GET /webhook/whatsapp - Webhook verification
   * Meta sends a GET request to verify the webhook URL
   */
  router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[WhatsApp Webhook] Verification request:', { mode, token: token ? '***' : 'missing', challenge: challenge ? 'present' : 'missing' });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[WhatsApp Webhook] Verification successful');
      res.status(200).send(challenge);
    } else {
      console.log('[WhatsApp Webhook] Verification failed - token mismatch');
      res.status(403).send('Forbidden');
    }
  });

  /**
   * POST /webhook/whatsapp - Receive incoming messages
   * Meta sends POST requests with message data
   * We acknowledge immediately and forward to n8n for processing
   */
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body;

    // Acknowledge receipt immediately (Meta requires 200 within 20 seconds)
    res.status(200).send('EVENT_RECEIVED');

    // Log the message for debugging
    try {
      const entry = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      if (value?.messages) {
        const message = value.messages[0];
        console.log('[WhatsApp Webhook] Message received:', {
          from: message.from,
          type: message.type,
          text: message.text?.body || message.type,
          timestamp: message.timestamp
        });
        
        // Forward to n8n for processing
        try {
          console.log('[WhatsApp Webhook] Forwarding to n8n:', N8N_WEBHOOK_URL);
          const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          console.log('[WhatsApp Webhook] n8n response status:', n8nResponse.status);
        } catch (n8nError) {
          console.error('[WhatsApp Webhook] Failed to forward to n8n:', n8nError);
        }
      } else if (value?.statuses) {
        console.log('[WhatsApp Webhook] Status update received (not forwarding)');
      }
    } catch (error) {
      console.error('[WhatsApp Webhook] Error parsing message:', error);
    }
  });

  return router;
}
