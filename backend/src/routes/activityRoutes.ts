/**
 * Activity Feed API Routes — Unified real-time event feed.
 * Factory pattern: createActivityRoutes(db)
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { ActivitySSEManager } from '../services/ActivitySSEManager.js';

let _db: Database.Database;

export function createActivityRoutes(db: Database.Database): Router {
  _db = db;
  const router = Router();
  const sse = ActivitySSEManager.getInstance();

  // GET /feed — Paginated merged activity feed (mc_events + instagram_interactions)
  router.get('/feed', (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const eventTypes = req.query.event_types ? (req.query.event_types as string).split(',') : null;
      const entityTypes = req.query.entity_types ? (req.query.entity_types as string).split(',') : null;

      // Build WHERE clauses
      const conditions: string[] = [];
      const params: any[] = [];

      if (eventTypes && eventTypes.length > 0) {
        conditions.push(`event_type IN (${eventTypes.map(() => '?').join(',')})`);
        params.push(...eventTypes);
      }
      if (entityTypes && entityTypes.length > 0) {
        conditions.push(`entity_type IN (${entityTypes.map(() => '?').join(',')})`);
        params.push(...entityTypes);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // MC events
      const mcEvents = _db.prepare(`
        SELECT
          id, event_type, entity_type, entity_id, message, metadata, created_at,
          'mc_event' as source
        FROM mc_events
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      // Instagram interactions (recent, as DM events)
      const dmConditions: string[] = [];
      const dmParams: any[] = [];
      if (eventTypes && eventTypes.length > 0) {
        // Only include DM events if relevant event types requested
        const dmRelevant = eventTypes.some(t => t.startsWith('dm_') || t === 'dm_response' || t === 'dm_error');
        if (!dmRelevant && eventTypes.length > 0) {
          // Skip DM events if no DM-related types requested
          res.json({
            items: mcEvents.map(formatMcEvent),
            total: getTotalCount(whereClause, params),
            limit,
            offset,
          });
          return;
        }
      }

      const dmEvents = _db.prepare(`
        SELECT
          id, instagram_id, message_text, ai_response, direction, intent, sentiment,
          model_used, model_tier, response_time_ms, pipeline_trace, pipeline_error,
          created_at,
          'dm_event' as source
        FROM instagram_interactions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset);

      // Merge and sort
      const merged = [
        ...mcEvents.map(formatMcEvent),
        ...dmEvents.map(formatDmEvent),
      ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, limit);

      const totalMc = getTotalCount(whereClause, params);
      const totalDm = (_db.prepare('SELECT COUNT(*) as c FROM instagram_interactions').get() as any)?.c || 0;

      res.json({
        items: merged,
        total: totalMc + totalDm,
        limit,
        offset,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /stream — SSE endpoint for real-time activity updates
  router.get('/stream', (req: Request, res: Response) => {
    sse.addClient(res);
    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected', data: { timestamp: new Date().toISOString() } })}\n\n`);
  });

  // GET /stats — Quick stats for the activity feed header
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const today = _db.prepare(`
        SELECT COUNT(*) as c FROM mc_events
        WHERE created_at >= datetime('now', 'start of day')
      `).get() as any;

      const errors = _db.prepare(`
        SELECT COUNT(*) as c FROM mc_events
        WHERE event_type LIKE '%error%' OR event_type LIKE '%fail%'
        AND created_at >= datetime('now', '-24 hours')
      `).get() as any;

      const dmToday = _db.prepare(`
        SELECT COUNT(*) as c FROM instagram_interactions
        WHERE created_at >= datetime('now', 'start of day')
      `).get() as any;

      const activeStreams = sse.getClientCount();

      res.json({
        events_today: today?.c || 0,
        errors_24h: errors?.c || 0,
        dm_today: dmToday?.c || 0,
        active_streams: activeStreams,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  function getTotalCount(whereClause: string, params: any[]): number {
    return (_db.prepare(`SELECT COUNT(*) as c FROM mc_events ${whereClause}`).get(...params) as any)?.c || 0;
  }

  return router;
}

function formatMcEvent(row: any) {
  return {
    id: `mc_${row.id}`,
    event_type: row.event_type,
    entity_type: row.entity_type || 'system',
    entity_id: row.entity_id,
    message: row.message,
    metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null,
    created_at: row.created_at,
    source: 'mc_event',
  };
}

function formatDmEvent(row: any) {
  const isInbound = row.direction === 'inbound';
  return {
    id: `dm_${row.id}`,
    event_type: row.pipeline_error ? 'dm_error' : (isInbound ? 'dm_inbound' : 'dm_response'),
    entity_type: 'conversation',
    entity_id: row.instagram_id,
    message: isInbound
      ? `📩 ${row.instagram_id}: ${(row.message_text || '').substring(0, 120)}`
      : `🤖 → ${row.instagram_id}: ${(row.ai_response || '').substring(0, 120)}`,
    metadata: {
      instagram_id: row.instagram_id,
      direction: row.direction,
      intent: row.intent,
      sentiment: row.sentiment,
      model_used: row.model_used,
      model_tier: row.model_tier,
      response_time_ms: row.response_time_ms,
      pipeline_error: row.pipeline_error,
    },
    created_at: row.created_at,
    source: 'dm_event',
  };
}
