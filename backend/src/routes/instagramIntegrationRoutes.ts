/**
 * Instagram Integration Routes
 * API endpoints for OpenClaw and admin panel to fetch customer data and log interactions
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

interface InstagramCustomer {
  instagramId: string;
  phone?: string;
  couponBalance: number;
  totalEarned: number;
  totalRedeemed: number;
  lastVisit?: string;
  interactionCount: number;
  firstContact?: string;
  lastContact?: string;
  isNewCustomer: boolean;
}

export function createInstagramIntegrationRoutes(db: Database.Database): Router {
  const router = Router();

  // All routes require API key authentication
  router.use(apiKeyAuth);

  /**
   * POST /api/integrations/instagram/send
   * Send an Instagram DM via Meta Graph API
   * Called by OpenClaw agent/transform after processing
   */
  router.post('/send', async (req: Request, res: Response) => {
    try {
      const { recipientId, message } = req.body;
      if (!recipientId || !message) {
        res.status(400).json({ error: 'recipientId and message required' });
        return;
      }

      const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
      const IG_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

      if (!IG_TOKEN || !IG_ACCOUNT_ID) {
        console.error('[IG Send] Missing INSTAGRAM_ACCESS_TOKEN or INSTAGRAM_ACCOUNT_ID');
        res.status(500).json({ error: 'Instagram API not configured' });
        return;
      }

      // Use graph.instagram.com for Instagram User Tokens (IGAA* tokens)
      // graph.facebook.com only works with Facebook Page Tokens
      const graphDomain = IG_TOKEN.startsWith('IGAA') ? 'graph.instagram.com' : 'graph.facebook.com';
      const apiVersion = 'v25.0';

      const metaRes = await fetch(`https://${graphDomain}/${apiVersion}/${IG_ACCOUNT_ID}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${IG_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
        }),
      });

      const data = await metaRes.json() as Record<string, unknown>;

      if (!metaRes.ok) {
        console.error('[IG Send] Meta API error:', data);
        // Retry once on 5xx
        if (metaRes.status >= 500) {
          console.log('[IG Send] Retrying...');
          const retryRes = await fetch(`https://${graphDomain}/${apiVersion}/${IG_ACCOUNT_ID}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${IG_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipient: { id: recipientId },
              message: { text: message },
            }),
          });
          const retryData = await retryRes.json() as Record<string, unknown>;
          if (retryRes.ok) {
            res.json({ success: true, messageId: retryData.message_id });
            return;
          }
        }
        res.status(metaRes.status).json({ error: 'Meta API error', details: data });
        return;
      }

      console.log('[IG Send] Message sent to', recipientId);
      res.json({ success: true, messageId: data.message_id });
    } catch (error) {
      console.error('[IG Send] Error:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  /**
   * GET /api/integrations/instagram/customer/:instagramId
   * Fetch customer data by Instagram ID for personalized responses
   */
  router.get('/customer/:instagramId', (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;

      // Get customer from instagram_customers table
      const customer = db.prepare(`
        SELECT * FROM instagram_customers WHERE instagram_id = ?
      `).get(instagramId) as any;

      // Get interaction count
      const interactionStats = db.prepare(`
        SELECT 
          COUNT(*) as interaction_count,
          MIN(created_at) as first_contact,
          MAX(created_at) as last_contact
        FROM instagram_interactions 
        WHERE instagram_id = ?
      `).get(instagramId) as any;

      // If customer exists, get their coupon wallet if linked
      let couponData = { couponBalance: 0, totalEarned: 0, totalRedeemed: 0 };
      if (customer?.phone) {
        const wallet = db.prepare(`
          SELECT coupon_count, total_earned, total_redeemed 
          FROM coupon_wallets WHERE phone = ?
        `).get(customer.phone) as any;
        
        if (wallet) {
          couponData = {
            couponBalance: wallet.coupon_count,
            totalEarned: wallet.total_earned,
            totalRedeemed: wallet.total_redeemed
          };
        }
      }

      const response: InstagramCustomer = {
        instagramId,
        phone: customer?.phone,
        couponBalance: couponData.couponBalance,
        totalEarned: couponData.totalEarned,
        totalRedeemed: couponData.totalRedeemed,
        lastVisit: customer?.last_visit,
        interactionCount: interactionStats?.interaction_count || 0,
        firstContact: interactionStats?.first_contact,
        lastContact: interactionStats?.last_contact,
        isNewCustomer: !customer || (interactionStats?.interaction_count || 0) === 0
      };

      res.json(response);
    } catch (error) {
      console.error('[Instagram API] Error fetching customer:', error);
      res.status(500).json({ error: 'Failed to fetch customer data' });
    }
  });

  /**
   * POST /api/integrations/instagram/interaction
   * Log an Instagram interaction for marketing analysis
   */
  router.post('/interaction', (req: Request, res: Response) => {
    try {
      const {
        instagramId,
        direction,
        messageText,
        intent,
        sentiment,
        aiResponse,
        responseTime,
        username,
        modelUsed,
        tokensEstimated,
        executionId
      } = req.body;

      if (!instagramId || !direction || !messageText) {
        res.status(400).json({ 
          error: 'Missing required fields: instagramId, direction, messageText' 
        });
        return;
      }

      const id = randomUUID();
      const now = new Date().toISOString();

      // Upsert customer record FIRST (to satisfy foreign key)
      // Also update username if provided
      if (username) {
        db.prepare(`
          INSERT INTO instagram_customers (instagram_id, name, last_interaction_at, interaction_count, updated_at)
          VALUES (?, ?, ?, 1, ?)
          ON CONFLICT(instagram_id) DO UPDATE SET
            name = COALESCE(excluded.name, name),
            last_interaction_at = excluded.last_interaction_at,
            interaction_count = interaction_count + 1,
            updated_at = excluded.updated_at
        `).run(instagramId, username, now, now);
      } else {
        db.prepare(`
          INSERT INTO instagram_customers (instagram_id, last_interaction_at, interaction_count, updated_at)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(instagram_id) DO UPDATE SET
            last_interaction_at = excluded.last_interaction_at,
            interaction_count = interaction_count + 1,
            updated_at = excluded.updated_at
        `).run(instagramId, now, now);
      }

      // Insert interaction
      db.prepare(`
        INSERT INTO instagram_interactions 
        (id, instagram_id, direction, message_text, intent, sentiment, ai_response, response_time_ms, model_used, tokens_estimated, execution_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, instagramId, direction, messageText, intent, sentiment, aiResponse, responseTime, modelUsed || null, tokensEstimated || 0, executionId || null, now);

      res.json({ 
        success: true, 
        interactionId: id,
        message: 'Interaction logged successfully' 
      });
    } catch (error) {
      console.error('[Instagram API] Error logging interaction:', error);
      res.status(500).json({ error: 'Failed to log interaction' });
    }
  });

  /**
   * POST /api/integrations/instagram/customer/:instagramId/link-phone
   * Link a phone number to an Instagram customer (for coupon integration)
   */
  router.post('/customer/:instagramId/link-phone', (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      const { phone } = req.body;

      if (!phone) {
        res.status(400).json({ error: 'Phone number required' });
        return;
      }

      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO instagram_customers (instagram_id, phone, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(instagram_id) DO UPDATE SET
          phone = excluded.phone,
          updated_at = excluded.updated_at
      `).run(instagramId, phone, now);

      res.json({ success: true, message: 'Phone linked successfully' });
    } catch (error) {
      console.error('[Instagram API] Error linking phone:', error);
      res.status(500).json({ error: 'Failed to link phone' });
    }
  });

  /**
   * GET /api/integrations/instagram/analytics
   * Get Instagram interaction analytics for marketing dashboard
   */
  router.get('/analytics', (req: Request, res: Response) => {
    try {
      const { startDate, endDate, limit = 100 } = req.query;

      let dateFilter = '';
      const params: any[] = [];

      if (startDate) {
        dateFilter += ' AND created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ' AND created_at <= ?';
        params.push(endDate);
      }

      // Total interactions
      const totalStats = db.prepare(`
        SELECT 
          COUNT(*) as total_interactions,
          COUNT(DISTINCT instagram_id) as unique_users,
          COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_count,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_count,
          AVG(response_time_ms) as avg_response_time
        FROM instagram_interactions
        WHERE 1=1 ${dateFilter}
      `).get(...params) as any;

      // Intent breakdown
      const intentStats = db.prepare(`
        SELECT intent, COUNT(*) as count
        FROM instagram_interactions
        WHERE intent IS NOT NULL ${dateFilter}
        GROUP BY intent
        ORDER BY count DESC
      `).all(...params) as any[];

      // Sentiment breakdown
      const sentimentStats = db.prepare(`
        SELECT sentiment, COUNT(*) as count
        FROM instagram_interactions
        WHERE sentiment IS NOT NULL ${dateFilter}
        GROUP BY sentiment
        ORDER BY count DESC
      `).all(...params) as any[];

      // Daily interaction counts
      const dailyStats = db.prepare(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as interactions,
          COUNT(DISTINCT instagram_id) as unique_users
        FROM instagram_interactions
        WHERE 1=1 ${dateFilter}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `).all(...params) as any[];

      // Recent interactions for export
      const recentInteractions = db.prepare(`
        SELECT 
          i.id,
          i.instagram_id,
          i.direction,
          i.message_text,
          i.intent,
          i.sentiment,
          i.ai_response,
          i.response_time_ms,
          i.created_at,
          c.phone
        FROM instagram_interactions i
        LEFT JOIN instagram_customers c ON i.instagram_id = c.instagram_id
        WHERE 1=1 ${dateFilter}
        ORDER BY i.created_at DESC
        LIMIT ?
      `).all(...params, Number(limit)) as any[];

      res.json({
        summary: {
          totalInteractions: totalStats?.total_interactions || 0,
          uniqueUsers: totalStats?.unique_users || 0,
          inboundMessages: totalStats?.inbound_count || 0,
          outboundMessages: totalStats?.outbound_count || 0,
          avgResponseTimeMs: Math.round(totalStats?.avg_response_time || 0)
        },
        intentBreakdown: intentStats,
        sentimentBreakdown: sentimentStats,
        dailyStats,
        recentInteractions: recentInteractions.map(r => ({
          id: r.id,
          instagramId: r.instagram_id,
          direction: r.direction,
          messageText: r.message_text,
          intent: r.intent,
          sentiment: r.sentiment,
          aiResponse: r.ai_response,
          responseTimeMs: r.response_time_ms,
          createdAt: r.created_at,
          phone: r.phone
        }))
      });
    } catch (error) {
      console.error('[Instagram API] Error fetching analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  /**
   * GET /api/integrations/instagram/export
   * Export interactions as CSV for Google Sheets import
   */
  router.get('/export', (req: Request, res: Response) => {
    try {
      const { startDate, endDate, format = 'json' } = req.query;

      let dateFilter = '';
      const params: any[] = [];

      if (startDate) {
        dateFilter += ' AND i.created_at >= ?';
        params.push(startDate);
      }
      if (endDate) {
        dateFilter += ' AND i.created_at <= ?';
        params.push(endDate);
      }

      const interactions = db.prepare(`
        SELECT 
          i.id,
          i.instagram_id,
          i.direction,
          i.message_text,
          i.intent,
          i.sentiment,
          i.ai_response,
          i.response_time_ms,
          i.created_at,
          c.phone,
          c.interaction_count
        FROM instagram_interactions i
        LEFT JOIN instagram_customers c ON i.instagram_id = c.instagram_id
        WHERE 1=1 ${dateFilter}
        ORDER BY i.created_at DESC
      `).all(...params) as any[];

      if (format === 'csv') {
        const headers = 'ID,Instagram ID,Direction,Message,Intent,Sentiment,AI Response,Response Time (ms),Created At,Phone,Total Interactions\n';
        const rows = interactions.map(r => 
          `"${r.id}","${r.instagram_id}","${r.direction}","${(r.message_text || '').replace(/"/g, '""')}","${r.intent || ''}","${r.sentiment || ''}","${(r.ai_response || '').replace(/"/g, '""')}","${r.response_time_ms || ''}","${r.created_at}","${r.phone || ''}","${r.interaction_count || 0}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=instagram_interactions.csv');
        res.send(headers + rows);
      } else {
        res.json(interactions.map(r => ({
          id: r.id,
          instagramId: r.instagram_id,
          direction: r.direction,
          messageText: r.message_text,
          intent: r.intent,
          sentiment: r.sentiment,
          aiResponse: r.ai_response,
          responseTimeMs: r.response_time_ms,
          createdAt: r.created_at,
          phone: r.phone,
          totalInteractions: r.interaction_count
        })));
      }
    } catch (error) {
      console.error('[Instagram API] Error exporting data:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  });

  /**
   * GET /api/integrations/instagram/block/check/:instagramId
   * Check if a user is currently blocked
   * Used by OpenClaw pipeline before responding
   */
  router.get('/block/check/:instagramId', async (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      
      // Import UserBlockService dynamically
      const { UserBlockService } = await import('../services/UserBlockService.js');
      const blockService = new UserBlockService(db);
      
      const result = blockService.checkBlock('instagram', instagramId);
      
      res.json(result);
    } catch (error) {
      console.error('[Instagram API] Error checking block status:', error);
      res.status(500).json({ error: 'Failed to check block status', isBlocked: false });
    }
  });

  /**
   * POST /api/integrations/instagram/block/:instagramId
   * Block a user temporarily after inappropriate message
   * Called by OpenClaw pipeline when safety gate returns BLOCK
   */
  router.post('/block/:instagramId', async (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      const { reason } = req.body;
      
      const { UserBlockService } = await import('../services/UserBlockService.js');
      const blockService = new UserBlockService(db);
      
      const block = blockService.blockUser('instagram', instagramId, reason || 'Inappropriate message');
      
      // Calculate duration in minutes
      const expiresAt = new Date(block.expiresAt);
      const durationMinutes = Math.ceil((expiresAt.getTime() - Date.now()) / 60000);
      
      console.log(`[Instagram API] User ${instagramId} blocked for ${durationMinutes} minutes (offense #${block.blockCount})`);
      
      res.json({
        success: true,
        blocked: true,
        expiresAt: block.expiresAt,
        durationMinutes,
        blockCount: block.blockCount,
        message: `User blocked for ${durationMinutes} minutes`
      });
    } catch (error) {
      console.error('[Instagram API] Error blocking user:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  /**
   * DELETE /api/integrations/instagram/block/:instagramId
   * Manually unblock a user (admin action)
   */
  router.delete('/block/:instagramId', async (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      
      const { UserBlockService } = await import('../services/UserBlockService.js');
      const blockService = new UserBlockService(db);
      
      const unblocked = blockService.unblockUser('instagram', instagramId);
      
      if (unblocked) {
        console.log(`[Instagram API] User ${instagramId} manually unblocked`);
        res.json({ success: true, message: 'User unblocked successfully' });
      } else {
        res.json({ success: false, message: 'User was not blocked' });
      }
    } catch (error) {
      console.error('[Instagram API] Error unblocking user:', error);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  /**
   * GET /api/integrations/instagram/blocked-users
   * Get list of currently blocked users
   */
  router.get('/blocked-users', async (_req: Request, res: Response) => {
    try {
      const { UserBlockService } = await import('../services/UserBlockService.js');
      const blockService = new UserBlockService(db);
      
      const blockedUsers = blockService.getBlockedUsers('instagram');
      
      res.json({
        count: blockedUsers.length,
        users: blockedUsers
      });
    } catch (error) {
      console.error('[Instagram API] Error fetching blocked users:', error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  });

  // ==================== STATS & CONVERSATIONS (Agent Intelligence) ====================

  /**
   * GET /api/integrations/instagram/stats
   * Real-time DM statistics for the Instagram agent's operational awareness
   */
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const todayStats = db.prepare(`
        SELECT 
          COUNT(*) as total_today,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as responses_today,
          COUNT(DISTINCT instagram_id) as unique_senders,
          AVG(CASE WHEN response_time_ms > 0 THEN response_time_ms END) as avg_response_time,
          SUM(COALESCE(tokens_estimated, 0)) as total_tokens
        FROM instagram_interactions
        WHERE DATE(created_at) = ?
      `).get(today) as any;

      const modelDistribution = db.prepare(`
        SELECT model_used, COUNT(*) as count
        FROM instagram_interactions
        WHERE DATE(created_at) = ? AND model_used IS NOT NULL
        GROUP BY model_used
        ORDER BY count DESC
      `).all(today) as any[];

      const intentBreakdown = db.prepare(`
        SELECT intent, COUNT(*) as count
        FROM instagram_interactions
        WHERE DATE(created_at) = ? AND intent IS NOT NULL AND direction = 'inbound'
        GROUP BY intent
        ORDER BY count DESC
        LIMIT 10
      `).all(today) as any[];

      const hourlyActivity = db.prepare(`
        SELECT 
          strftime('%H', created_at) as hour,
          COUNT(*) as count
        FROM instagram_interactions
        WHERE DATE(created_at) = ?
        GROUP BY strftime('%H', created_at)
        ORDER BY hour
      `).all(today) as any[];

      res.json({
        today: {
          totalMessages: todayStats?.total_today || 0,
          responsesGenerated: todayStats?.responses_today || 0,
          uniqueSenders: todayStats?.unique_senders || 0,
          avgResponseTimeMs: Math.round(todayStats?.avg_response_time || 0),
          totalTokens: todayStats?.total_tokens || 0,
        },
        modelDistribution: modelDistribution.map((m: any) => ({ model: m.model_used, count: m.count })),
        intentBreakdown: intentBreakdown.map((i: any) => ({ intent: i.intent, count: i.count })),
        hourlyActivity: hourlyActivity.map((h: any) => ({ hour: h.hour, count: h.count })),
      });
    } catch (error) {
      console.error('[Instagram API] Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /api/integrations/instagram/conversations
   * Recent conversations grouped by customer, with message history
   */
  router.get('/conversations', (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const customerId = req.query.customerId as string | undefined;

      if (customerId) {
        // Single customer conversation history
        const messages = db.prepare(`
          SELECT id, direction, message_text, intent, ai_response, response_time_ms, model_used, tokens_estimated, created_at
          FROM instagram_interactions
          WHERE instagram_id = ?
          ORDER BY created_at DESC
          LIMIT 50
        `).all(customerId) as any[];

        const customer = db.prepare(`
          SELECT instagram_id, name, phone, interaction_count, last_interaction_at, created_at
          FROM instagram_customers
          WHERE instagram_id = ?
        `).get(customerId) as any;

        res.json({
          customer: customer ? {
            id: customer.instagram_id,
            name: customer.name,
            phone: customer.phone,
            interactionCount: customer.interaction_count,
            lastInteraction: customer.last_interaction_at,
            firstSeen: customer.created_at,
          } : null,
          messages: messages.reverse().map((m: any) => ({
            id: m.id,
            direction: m.direction,
            text: m.message_text,
            intent: m.intent,
            aiResponse: m.ai_response,
            responseTimeMs: m.response_time_ms,
            model: m.model_used,
            tokens: m.tokens_estimated,
            createdAt: m.created_at,
          })),
        });
        return;
      }

      // List recent conversations (grouped by customer)
      const conversations = db.prepare(`
        SELECT 
          i.instagram_id,
          c.name,
          COUNT(*) as message_count,
          MAX(i.created_at) as last_message_at,
          MIN(i.created_at) as first_message_at,
          GROUP_CONCAT(DISTINCT i.model_used) as models_used
        FROM instagram_interactions i
        LEFT JOIN instagram_customers c ON i.instagram_id = c.instagram_id
        GROUP BY i.instagram_id
        ORDER BY last_message_at DESC
        LIMIT ?
      `).all(limit) as any[];

      res.json({
        conversations: conversations.map((c: any) => ({
          customerId: c.instagram_id,
          name: c.name,
          messageCount: c.message_count,
          lastMessageAt: c.last_message_at,
          firstMessageAt: c.first_message_at,
          modelsUsed: c.models_used ? c.models_used.split(',').filter(Boolean) : [],
        })),
      });
    } catch (error) {
      console.error('[Instagram API] Error fetching conversations:', error);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  });

  // ==================== SUSPICIOUS USERS ====================

  /**
   * GET /api/integrations/instagram/suspicious/check/:instagramId
   * Check if a user is flagged as suspicious
   */
  router.get('/suspicious/check/:instagramId', async (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      const { SuspiciousUserService } = await import('../services/SuspiciousUserService.js');
      const suspiciousService = new SuspiciousUserService(db);
      
      const result = suspiciousService.checkSuspicious('instagram', instagramId);
      res.json(result);
    } catch (error) {
      console.error('[Instagram API] Error checking suspicious status:', error);
      res.status(500).json({ error: 'Failed to check suspicious status', isSuspicious: false });
    }
  });

  /**
   * POST /api/integrations/instagram/suspicious/flag/:instagramId
   * Flag a user as suspicious
   */
  router.post('/suspicious/flag/:instagramId', async (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      const { reason } = req.body;
      
      const { SuspiciousUserService } = await import('../services/SuspiciousUserService.js');
      const suspiciousService = new SuspiciousUserService(db);
      
      const user = suspiciousService.flagUser('instagram', instagramId, reason || 'Inappropriate message');
      
      console.log(`[Instagram API] User ${instagramId} flagged as suspicious (offense #${user.offenseCount})`);
      
      res.json({
        success: true,
        flagged: true,
        offenseCount: user.offenseCount,
        message: `User flagged as suspicious (offense #${user.offenseCount})`
      });
    } catch (error) {
      console.error('[Instagram API] Error flagging user:', error);
      res.status(500).json({ error: 'Failed to flag user' });
    }
  });

  /**
   * DELETE /api/integrations/instagram/suspicious/unflag/:instagramId
   * Remove suspicious flag from user
   */
  router.delete('/suspicious/unflag/:instagramId', async (req: Request, res: Response) => {
    try {
      const { instagramId } = req.params;
      
      const { SuspiciousUserService } = await import('../services/SuspiciousUserService.js');
      const suspiciousService = new SuspiciousUserService(db);
      
      const unflagged = suspiciousService.unflagUser('instagram', instagramId);
      
      if (unflagged) {
        console.log(`[Instagram API] User ${instagramId} unflagged`);
        res.json({ success: true, message: 'User unflagged successfully' });
      } else {
        res.json({ success: false, message: 'User was not flagged' });
      }
    } catch (error) {
      console.error('[Instagram API] Error unflagging user:', error);
      res.status(500).json({ error: 'Failed to unflag user' });
    }
  });

  /**
   * GET /api/integrations/instagram/suspicious-users
   * Get list of suspicious users
   */
  router.get('/suspicious-users', async (_req: Request, res: Response) => {
    try {
      const { SuspiciousUserService } = await import('../services/SuspiciousUserService.js');
      const suspiciousService = new SuspiciousUserService(db);
      
      const users = suspiciousService.getSuspiciousUsers('instagram');
      
      res.json({
        count: users.length,
        users
      });
    } catch (error) {
      console.error('[Instagram API] Error fetching suspicious users:', error);
      res.status(500).json({ error: 'Failed to fetch suspicious users' });
    }
  });

  return router;
}