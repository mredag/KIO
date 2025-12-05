import { Router, Request, Response } from 'express';

/**
 * Instagram Webhook Routes
 * Handles Meta webhook verification and incoming DMs
 * Messages are forwarded to n8n for AI processing
 */
export function createInstagramWebhookRoutes(): Router {
  const router = Router();
  
  const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || 'spa-kiosk-instagram-verify';
  const N8N_WEBHOOK_URL = process.env.N8N_INSTAGRAM_WEBHOOK_URL || 'http://localhost:5678/webhook/instagram';

  /**
   * GET /webhook/instagram - Webhook verification
   * Meta sends a GET request to verify the webhook URL
   */
  router.get('/', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[Instagram Webhook] Verification request:', { 
      mode, 
      token: token ? '***' : 'missing', 
      challenge: challenge ? 'present' : 'missing' 
    });

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verification successful');
      res.status(200).send(challenge);
    } else {
      console.log('[Instagram Webhook] Verification failed - token mismatch');
      res.status(403).send('Forbidden');
    }
  });

  /**
   * POST /webhook/instagram - Receive incoming DMs
   * Meta sends POST requests with message data
   * We acknowledge immediately and forward to n8n for AI processing
   */
  router.post('/', async (req: Request, res: Response) => {
    const body = req.body;

    // Acknowledge receipt immediately (Meta requires 200 within 20 seconds)
    res.status(200).send('EVENT_RECEIVED');

    // Log the message for debugging
    try {
      const entry = body?.entry?.[0];
      const messaging = entry?.messaging?.[0];
      
      if (messaging?.message?.text) {
        console.log('[Instagram Webhook] DM received:', {
          from: messaging.sender?.id,
          text: messaging.message.text.substring(0, 50) + '...',
          timestamp: messaging.timestamp
        });
        
        // Forward to n8n for AI processing
        try {
          console.log('[Instagram Webhook] Forwarding to n8n:', N8N_WEBHOOK_URL);
          const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          console.log('[Instagram Webhook] n8n response status:', n8nResponse.status);
        } catch (n8nError) {
          console.error('[Instagram Webhook] Failed to forward to n8n:', n8nError);
        }
      } else if (messaging?.read || messaging?.delivery) {
        console.log('[Instagram Webhook] Read/delivery receipt (not forwarding)');
      } else {
        console.log('[Instagram Webhook] Other event type:', Object.keys(messaging || {}));
      }
    } catch (error) {
      console.error('[Instagram Webhook] Error parsing message:', error);
    }
  });

  return router;
}
