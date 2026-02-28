import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type Database from 'better-sqlite3';
import { OpenClawClientService } from '../services/OpenClawClientService.js';
import { CommsSSEManager } from '../services/CommsSSEManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _db: Database.Database | null = null;

const router = Router();

// ============================================================
// FACTORY + HELPERS
// ============================================================

export function createAgentCommsRoutes(db: Database.Database) {
  _db = db;
  ensureSchema();
  return router;
}

function getDb(): Database.Database {
  if (!_db) throw new Error('Agent comms routes not initialized');
  return _db;
}

function generateId(): string {
  return crypto.randomUUID();
}

function emitEvent(
  entityType: string, entityId: string, eventType: string,
  message: string, fromState?: string, toState?: string, metadata?: any
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO mc_events (entity_type, entity_id, event_type, from_state, to_state, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(entityType, entityId, eventType, fromState || null, toState || null, message, metadata ? JSON.stringify(metadata) : null);
}

// ============================================================
// SCHEMA MIGRATION (Task 1.2)
// ============================================================

function ensureSchema(): void {
  const db = getDb();

  // Read and execute the schema SQL file (creates 5 new tables with IF NOT EXISTS)
  const schemaPath = path.join(__dirname, '..', 'database', 'agent-comms-schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schemaSql);

  // ALTER TABLE migrations for mc_jobs (safe — try/catch for duplicate column)
  const safeAlter = (sql: string) => {
    try {
      db.exec(sql);
    } catch (e: any) {
      if (!e.message.includes('duplicate column')) throw e;
    }
  };
  safeAlter('ALTER TABLE mc_jobs ADD COLUMN parent_job_id TEXT');
  safeAlter('ALTER TABLE mc_jobs ADD COLUMN board_id TEXT');

  // Expand mc_events CHECK constraint to include board, message, memory entity types
  try {
    const tableInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='mc_events'`).get() as any;
    if (tableInfo && !tableInfo.sql.includes("'board'")) {
      db.exec(`
        DROP TABLE IF EXISTS mc_events_new;
        CREATE TABLE mc_events_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT CHECK(entity_type IN ('job', 'run', 'agent', 'conversation', 'document', 'system', 'approval', 'board', 'message', 'memory')) NOT NULL,
          entity_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          from_state TEXT,
          to_state TEXT,
          message TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO mc_events_new SELECT * FROM mc_events;
        DROP TABLE mc_events;
        ALTER TABLE mc_events_new RENAME TO mc_events;
        CREATE INDEX IF NOT EXISTS idx_mc_events_entity ON mc_events(entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_mc_events_created ON mc_events(created_at);
      `);
      console.log('[AgentComms] Updated mc_events CHECK constraint to include board, message, memory');
    }
  } catch (e: any) {
    console.warn('[AgentComms] mc_events migration warning:', e.message);
  }
}

// ============================================================
// MESSAGE FORMAT TEMPLATES (Task 2.2)
// ============================================================

function formatNudgeMessage(senderName: string, boardName: string, content: string): string {
  return `🔔 PRIORITY NUDGE\nBoard: ${boardName}\nFrom: ${senderName}\n\n${content}`;
}

function formatDelegationMessage(boardName: string, taskTitle: string, taskId: string, description: string): string {
  return `TASK ASSIGNED\nBoard: ${boardName}\nTask: ${taskTitle}\nTask ID: ${taskId}\nStatus: queued\nDescription: ${description}\n\nTake action: begin work on this task. Post updates as status messages.`;
}

function formatStatusUpdate(boardName: string, taskTitle: string, oldStatus: string, newStatus: string, summary?: string): string {
  return `STATUS UPDATE\nBoard: ${boardName}\nTask: ${taskTitle}\nStatus: ${oldStatus} → ${newStatus}${summary ? `\nSummary: ${summary}` : ''}`;
}

function formatContextShare(senderName: string, boardName: string, key: string, value: string): string {
  return `CONTEXT SHARED\nBoard: ${boardName}\nFrom: ${senderName}\nKey: ${key}\n\n${value}`;
}

function formatBroadcast(senderName: string, boardName: string, content: string): string {
  return `BOARD BROADCAST\nBoard: ${boardName}\nFrom: ${senderName}\n\n${content}`;
}

function formatBoardCompleted(boardName: string, objective: string): string {
  return `BOARD COMPLETED\nBoard: ${boardName}\nObjective: ${objective}\n\nThis board has been marked as completed. No further tasks will be dispatched.`;
}

// ============================================================
// MESSAGE DELIVERY (Task 2.3)
// ============================================================

async function deliverMessage(messageId: string, recipientAgentId: string, content: string, boardId?: string): Promise<boolean> {
  const db = getDb();
  try {
    const ocClient = OpenClawClientService.getInstance();
    if (!ocClient.isConnected()) {
      await ocClient.connect();
    }

    // Build session key — board-scoped if boardId provided
    const channel = boardId ? 'board' : 'comms';
    const peer = boardId ? `${boardId}:${recipientAgentId}` : recipientAgentId;

    // Ensure session exists (idempotent — sessions.patch creates or returns existing)
    await ocClient.createSession(channel, peer);

    // Send message via chat.send
    const sessionKey = `agent:main:${channel}:${peer}`;
    await ocClient.sendMessage(sessionKey, content);

    // Update delivery status
    db.prepare(`UPDATE mc_agent_messages SET delivery_status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE id = ?`).run(messageId);
    return true;
  } catch (err: any) {
    console.error(`[AgentComms] Delivery failed for message ${messageId}:`, err.message);
    db.prepare(`UPDATE mc_agent_messages SET delivery_status = 'failed', error = ? WHERE id = ?`).run(err.message, messageId);
    emitEvent('message', messageId, 'comms_delivery_failed', `Delivery failed: ${err.message}`);
    return false;
  }
}

// ============================================================
// ALLOWED MESSAGE TYPES
// ============================================================

const ALLOWED_MESSAGE_TYPES = ['nudge', 'delegation', 'status_update', 'context_share', 'query', 'response'];

// ============================================================
// POST /comms/send (Task 2.4)
// ============================================================

router.post('/comms/send', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { sender_id, recipient_id, message_type, content, board_id, metadata } = req.body;

    // Validate required fields
    if (!sender_id || !recipient_id || !message_type || !content) {
      return res.status(400).json({ error: 'Missing required fields: sender_id, recipient_id, message_type, content' });
    }

    // Validate message_type
    if (!ALLOWED_MESSAGE_TYPES.includes(message_type)) {
      return res.status(400).json({ error: `Invalid message_type. Allowed: ${ALLOWED_MESSAGE_TYPES.join(', ')}` });
    }

    // Validate sender exists in mc_agents
    const sender = db.prepare('SELECT id, name FROM mc_agents WHERE id = ?').get(sender_id) as any;
    if (!sender) {
      return res.status(400).json({ error: `Sender agent not found: ${sender_id}` });
    }

    // Validate recipient exists in mc_agents
    const recipient = db.prepare('SELECT id, name FROM mc_agents WHERE id = ?').get(recipient_id) as any;
    if (!recipient) {
      return res.status(400).json({ error: `Recipient agent not found: ${recipient_id}` });
    }

    // Persist message with delivery_status "pending"
    const id = generateId();
    db.prepare(
      `INSERT INTO mc_agent_messages (id, board_id, sender_id, recipient_id, message_type, content, delivery_status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(id, board_id || null, sender_id, recipient_id, message_type, content, metadata ? JSON.stringify(metadata) : null);

    // Apply nudge priority formatting
    let deliveryContent = content;
    if (message_type === 'nudge') {
      const boardName = board_id
        ? (db.prepare('SELECT name FROM mc_boards WHERE id = ?').get(board_id) as any)?.name || 'Unknown'
        : 'Direct';
      deliveryContent = formatNudgeMessage(sender.name, boardName, content);
    }

    // Deliver via OpenClaw gateway
    const delivered = await deliverMessage(id, recipient_id, deliveryContent, board_id || undefined);

    // Emit event
    emitEvent('message', id, 'message_sent', `${sender.name} → ${recipient.name}: ${message_type}`, undefined, undefined, {
      sender_id, recipient_id, message_type, board_id
    });

    const msg = db.prepare('SELECT id, delivery_status FROM mc_agent_messages WHERE id = ?').get(id) as any;
    res.status(201).json({ id: msg.id, delivery_status: msg.delivery_status });

    // Push SSE events (Task 9.3)
    const sseEvent = { type: 'message_sent', data: { id, sender_id, recipient_id, message_type, board_id, delivery_status: msg.delivery_status }, boardId: board_id };
    if (board_id) {
      CommsSSEManager.getInstance().pushEvent(board_id, sseEvent);
    }
    CommsSSEManager.getInstance().pushGlobalEvent(sseEvent);
  } catch (err: any) {
    console.error('[AgentComms] Send error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// GET /comms/messages (Task 2.5)
// ============================================================

router.get('/comms/messages', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const { sender_id, recipient_id, message_type, board_id } = req.query;

    // Build WHERE clauses dynamically
    const conditions: string[] = [];
    const params: any[] = [];

    if (sender_id) {
      conditions.push('sender_id = ?');
      params.push(sender_id);
    }
    if (recipient_id) {
      conditions.push('recipient_id = ?');
      params.push(recipient_id);
    }
    if (message_type) {
      conditions.push('message_type = ?');
      params.push(message_type);
    }
    if (board_id) {
      conditions.push('board_id = ?');
      params.push(board_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countRow = db.prepare(`SELECT COUNT(*) as total FROM mc_agent_messages ${whereClause}`).get(...params) as any;
    const total = countRow.total;

    // Get paginated messages
    const messages = db.prepare(
      `SELECT * FROM mc_agent_messages ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({ messages, total, page, limit });
  } catch (err: any) {
    console.error('[AgentComms] Messages list error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// BOARD CRUD ENDPOINTS (Task 4.1)
// ============================================================

// POST /boards — create board
router.post('/boards', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { name, objective, lead_agent_id } = req.body;

    if (!name || !lead_agent_id) {
      return res.status(400).json({ error: 'Missing required fields: name, lead_agent_id' });
    }

    // Validate lead_agent_id exists in mc_agents
    const agent = db.prepare('SELECT id FROM mc_agents WHERE id = ?').get(lead_agent_id) as any;
    if (!agent) {
      return res.status(400).json({ error: `Lead agent not found: ${lead_agent_id}` });
    }

    const id = generateId();
    db.prepare(
      `INSERT INTO mc_boards (id, name, objective, lead_agent_id, status) VALUES (?, ?, ?, ?, 'active')`
    ).run(id, name, objective || null, lead_agent_id);

    emitEvent('board', id, 'board_created', `Board created: ${name}`, undefined, 'active', { lead_agent_id });

    res.status(201).json({ id, name, status: 'active' });
  } catch (err: any) {
    console.error('[AgentComms] Create board error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// GET /boards — list boards filterable by status
router.get('/boards', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status } = req.query;

    let sql = 'SELECT * FROM mc_boards';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = ?';
      params.push(status);
    } else {
      // Exclude archived boards by default
      sql += " WHERE status != 'archived'";
    }

    sql += ' ORDER BY created_at DESC';

    const boards = db.prepare(sql).all(...params);
    res.json({ boards });
  } catch (err: any) {
    console.error('[AgentComms] List boards error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// GET /boards/:id — board detail with members, jobs, memory
router.get('/boards/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const board = db.prepare('SELECT * FROM mc_boards WHERE id = ?').get(id) as any;
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Member agents (JOIN mc_agents for agent details)
    const agents = db.prepare(
      `SELECT a.*, ba.joined_at FROM mc_board_agents ba
       JOIN mc_agents a ON a.id = ba.agent_id
       WHERE ba.board_id = ?`
    ).all(id);

    // Active jobs (not completed)
    const jobs = db.prepare(
      `SELECT * FROM mc_jobs WHERE board_id = ? AND status != 'completed' ORDER BY created_at DESC`
    ).all(id);

    // Recent memory items
    const memory = db.prepare(
      `SELECT * FROM mc_shared_memory WHERE board_id = ? ORDER BY updated_at DESC LIMIT 20`
    ).all(id);

    res.json({ board, agents, jobs, memory });
  } catch (err: any) {
    console.error('[AgentComms] Board detail error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// PATCH /boards/:id — update board
router.patch('/boards/:id', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, objective, status, lead_agent_id } = req.body;

    const board = db.prepare('SELECT * FROM mc_boards WHERE id = ?').get(id) as any;
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Validate lead_agent_id if provided
    if (lead_agent_id) {
      const agent = db.prepare('SELECT id FROM mc_agents WHERE id = ?').get(lead_agent_id) as any;
      if (!agent) {
        return res.status(400).json({ error: `Lead agent not found: ${lead_agent_id}` });
      }
    }

    // Build dynamic UPDATE
    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (objective !== undefined) { updates.push('objective = ?'); params.push(objective); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (lead_agent_id !== undefined) { updates.push('lead_agent_id = ?'); params.push(lead_agent_id); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE mc_boards SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Task 4.3: Board completion notification
    if (status === 'completed' && board.status !== 'completed') {
      const members = db.prepare(
        `SELECT a.id, a.name FROM mc_board_agents ba JOIN mc_agents a ON a.id = ba.agent_id WHERE ba.board_id = ?`
      ).all(id) as any[];

      const completionContent = formatBoardCompleted(board.name, board.objective || '');

      for (const member of members) {
        const msgId = generateId();
        db.prepare(
          `INSERT INTO mc_agent_messages (id, board_id, sender_id, recipient_id, message_type, content, delivery_status)
           VALUES (?, ?, ?, ?, 'status_update', ?, 'pending')`
        ).run(msgId, id, board.lead_agent_id, member.id, completionContent);

        // Fire-and-forget delivery
        deliverMessage(msgId, member.id, completionContent, id).catch(() => {});
      }

      emitEvent('board', id, 'board_completed', `Board completed: ${board.name}`, board.status, 'completed');
    } else if (status && status !== board.status) {
      emitEvent('board', id, 'board_status_changed', `Board status: ${board.status} → ${status}`, board.status, status);
    }

    res.json({ ok: true });

    // Push SSE events for board status change (Task 9.3)
    if (status && status !== board.status) {
      const sseEvent = { type: 'board_status_changed', data: { id, name: name || board.name, oldStatus: board.status, newStatus: status }, boardId: id };
      CommsSSEManager.getInstance().pushEvent(id, sseEvent);
      CommsSSEManager.getInstance().pushGlobalEvent(sseEvent);
    }
  } catch (err: any) {
    console.error('[AgentComms] Update board error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// DELETE /boards/:id — archive board
router.delete('/boards/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const board = db.prepare('SELECT * FROM mc_boards WHERE id = ?').get(id) as any;
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    db.prepare(`UPDATE mc_boards SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    emitEvent('board', id, 'board_archived', `Board archived: ${board.name}`, board.status, 'archived');

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[AgentComms] Archive board error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// BOARD AGENT MEMBERSHIP (Task 4.2)
// ============================================================

// POST /boards/:id/agents — add agent to board
router.post('/boards/:id/agents', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({ error: 'Missing required field: agent_id' });
    }

    // Validate board exists
    const board = db.prepare('SELECT id FROM mc_boards WHERE id = ?').get(id) as any;
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Validate agent exists
    const agent = db.prepare('SELECT id FROM mc_agents WHERE id = ?').get(agent_id) as any;
    if (!agent) {
      return res.status(400).json({ error: `Agent not found: ${agent_id}` });
    }

    // Insert — handle UNIQUE constraint
    try {
      const baId = generateId();
      db.prepare(
        `INSERT INTO mc_board_agents (id, board_id, agent_id) VALUES (?, ?, ?)`
      ).run(baId, id, agent_id);
    } catch (e: any) {
      if (e.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Agent already in board' });
      }
      throw e;
    }

    emitEvent('board', id, 'agent_added', `Agent ${agent_id} added to board`, undefined, undefined, { agent_id });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[AgentComms] Add board agent error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// DELETE /boards/:id/agents/:agentId — remove agent from board
router.delete('/boards/:id/agents/:agentId', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id, agentId } = req.params;

    db.prepare('DELETE FROM mc_board_agents WHERE board_id = ? AND agent_id = ?').run(id, agentId);
    emitEvent('board', id, 'agent_removed', `Agent ${agentId} removed from board`, undefined, undefined, { agent_id: agentId });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[AgentComms] Remove board agent error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// POST /comms/broadcast (Task 4.4)
// ============================================================

router.post('/comms/broadcast', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { sender_id, board_id, message_type, content } = req.body;

    if (!sender_id || !board_id || !content) {
      return res.status(400).json({ error: 'Missing required fields: sender_id, board_id, content' });
    }

    // Validate sender exists
    const sender = db.prepare('SELECT id, name FROM mc_agents WHERE id = ?').get(sender_id) as any;
    if (!sender) {
      return res.status(400).json({ error: `Sender agent not found: ${sender_id}` });
    }

    // Validate board exists
    const board = db.prepare('SELECT id, name FROM mc_boards WHERE id = ?').get(board_id) as any;
    if (!board) {
      return res.status(400).json({ error: `Board not found: ${board_id}` });
    }

    // Fetch all board member agents
    const members = db.prepare(
      `SELECT a.id, a.name FROM mc_board_agents ba JOIN mc_agents a ON a.id = ba.agent_id WHERE ba.board_id = ?`
    ).all(board_id) as any[];

    if (members.length === 0) {
      return res.status(400).json({ error: 'No agents in board' });
    }

    const broadcastContent = formatBroadcast(sender.name, board.name, content);
    const msgType = message_type || 'broadcast';
    const results: { id: string; recipient_id: string; delivery_status: string }[] = [];

    for (const member of members) {
      const msgId = generateId();
      db.prepare(
        `INSERT INTO mc_agent_messages (id, board_id, sender_id, recipient_id, message_type, content, delivery_status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      ).run(msgId, board_id, sender_id, member.id, msgType, content);

      // Fire-and-forget delivery
      deliverMessage(msgId, member.id, broadcastContent, board_id).catch(() => {});

      const msg = db.prepare('SELECT delivery_status FROM mc_agent_messages WHERE id = ?').get(msgId) as any;
      results.push({ id: msgId, recipient_id: member.id, delivery_status: msg.delivery_status });
    }

    emitEvent('board', board_id, 'broadcast_sent', `Broadcast from ${sender.name} to ${members.length} agents`, undefined, undefined, {
      sender_id, board_id, recipient_count: members.length
    });

    res.status(201).json({ messages: results });

    // Push SSE events (Task 9.3)
    const sseEvent = { type: 'broadcast_sent', data: { sender_id, board_id, recipient_count: members.length, messages: results }, boardId: board_id };
    CommsSSEManager.getInstance().pushEvent(board_id, sseEvent);
    CommsSSEManager.getInstance().pushGlobalEvent(sseEvent);
  } catch (err: any) {
    console.error('[AgentComms] Broadcast error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// GET /boards/:id/activity (Task 4.5)
// ============================================================

router.get('/boards/:id/activity', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));

    const board = db.prepare('SELECT id FROM mc_boards WHERE id = ?').get(id) as any;
    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Combine messages and events for this board into a unified activity feed
    // Messages scoped to this board
    const messages = db.prepare(
      `SELECT id, 'message' as type, created_at, sender_id, recipient_id, message_type, content, delivery_status
       FROM mc_agent_messages WHERE board_id = ?
       ORDER BY created_at DESC LIMIT ?`
    ).all(id, limit) as any[];

    // Events related to this board (entity_id = board_id, or entity_id in board's jobs/messages)
    const events = db.prepare(
      `SELECT id, 'event' as type, created_at, entity_type, entity_id, event_type, message, metadata
       FROM mc_events WHERE entity_id = ?
       ORDER BY created_at DESC LIMIT ?`
    ).all(id, limit) as any[];

    // Merge and sort by created_at DESC
    const combined = [
      ...messages.map(m => ({ type: 'message' as const, data: m, created_at: m.created_at })),
      ...events.map(e => ({ type: 'event' as const, data: e, created_at: e.created_at })),
    ].sort((a, b) => {
      // DESC order — newest first
      if (a.created_at > b.created_at) return -1;
      if (a.created_at < b.created_at) return 1;
      return 0;
    }).slice(0, limit);

    res.json({ events: combined });
  } catch (err: any) {
    console.error('[AgentComms] Board activity error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// GET /boards/:id/stream — SSE endpoint (Task 9.2)
// ============================================================

router.get('/boards/:id/stream', (req: Request, res: Response) => {
  const { id } = req.params;
  CommsSSEManager.getInstance().addClient(id, res);
});

// ============================================================
// DFS CYCLE DETECTION (Task 5.1)
// ============================================================

function hasCycle(nodes: Set<string>, edges: Map<string, Set<string>>): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(current: string): boolean {
    if (inStack.has(current)) return true;  // cycle detected
    if (visited.has(current)) return false; // already fully explored
    visited.add(current);
    inStack.add(current);
    for (const next of edges.get(current) || []) {
      if (dfs(next)) return true;
    }
    inStack.delete(current); // IMPORTANT: Set uses .delete(), not .remove()
    return false;
  }

  for (const node of nodes) {
    if (dfs(node)) return true;
  }
  return false;
}

function validateDependencies(jobId: string, dependsOn: string[], boardId: string): { valid: boolean; error?: string } {
  const db = getDb();

  // No self-dependencies
  if (dependsOn.includes(jobId)) {
    return { valid: false, error: 'Self-dependency not allowed' };
  }

  // All dependency jobs must exist and belong to the same board
  for (const depId of dependsOn) {
    const dep = db.prepare('SELECT id, board_id FROM mc_jobs WHERE id = ?').get(depId) as any;
    if (!dep) {
      return { valid: false, error: `Dependency job ${depId} not found` };
    }
    if (dep.board_id !== boardId) {
      return { valid: false, error: `Dependency job ${depId} belongs to a different board` };
    }
  }

  // Build graph from existing deps + proposed new deps
  const allDeps = db.prepare('SELECT job_id, depends_on_job_id FROM mc_task_deps').all() as any[];
  const edges = new Map<string, Set<string>>();
  const nodes = new Set<string>();

  for (const dep of allDeps) {
    nodes.add(dep.job_id);
    nodes.add(dep.depends_on_job_id);
    if (!edges.has(dep.job_id)) edges.set(dep.job_id, new Set());
    edges.get(dep.job_id)!.add(dep.depends_on_job_id);
  }

  // Add proposed deps
  nodes.add(jobId);
  if (!edges.has(jobId)) edges.set(jobId, new Set());
  for (const depId of dependsOn) {
    nodes.add(depId);
    edges.get(jobId)!.add(depId);
  }

  if (hasCycle(nodes, edges)) {
    return { valid: false, error: 'Circular dependency detected' };
  }

  return { valid: true };
}

// ============================================================
// POST /comms/delegate (Task 5.2)
// ============================================================

router.post('/comms/delegate', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { parent_job_id, title, agent_id, priority, payload, depends_on, board_id } = req.body;

    if (!title || !agent_id) {
      return res.status(400).json({ error: 'Missing required fields: title, agent_id' });
    }

    // Validate agent exists
    const agent = db.prepare('SELECT id, name FROM mc_agents WHERE id = ?').get(agent_id) as any;
    if (!agent) {
      return res.status(400).json({ error: `Agent not found: ${agent_id}` });
    }

    // Validate board exists (if provided)
    let board: any = null;
    if (board_id) {
      board = db.prepare('SELECT id, name, lead_agent_id FROM mc_boards WHERE id = ?').get(board_id) as any;
      if (!board) {
        return res.status(400).json({ error: `Board not found: ${board_id}` });
      }
    }

    // Validate parent job exists (if provided)
    if (parent_job_id) {
      const parentJob = db.prepare('SELECT id FROM mc_jobs WHERE id = ?').get(parent_job_id) as any;
      if (!parentJob) {
        return res.status(400).json({ error: `Parent job not found: ${parent_job_id}` });
      }
    }

    // Create the job
    const jobId = generateId();
    db.prepare(
      `INSERT INTO mc_jobs (id, title, status, priority, agent_id, parent_job_id, board_id, source, payload)
       VALUES (?, ?, 'queued', ?, ?, ?, ?, 'manual', ?)`
    ).run(jobId, title, priority || 'medium', agent_id, parent_job_id || null, board_id || null, payload ? JSON.stringify(payload) : null);

    // Validate and insert dependencies
    const depsArray = Array.isArray(depends_on) ? depends_on : [];
    if (depsArray.length > 0) {
      if (board_id) {
        const validation = validateDependencies(jobId, depsArray, board_id);
        if (!validation.valid) {
          // Rollback the job we just created
          db.prepare('DELETE FROM mc_jobs WHERE id = ?').run(jobId);
          return res.status(400).json({ error: validation.error });
        }
      }

      for (const depId of depsArray) {
        const depEntryId = generateId();
        db.prepare(
          `INSERT INTO mc_task_deps (id, job_id, depends_on_job_id) VALUES (?, ?, ?)`
        ).run(depEntryId, jobId, depId);
      }
    }

    // Send delegation notification to assigned agent
    const boardName = board?.name || 'Direct';
    const delegationContent = formatDelegationMessage(boardName, title, jobId, payload?.description || title);
    const msgId = generateId();
    db.prepare(
      `INSERT INTO mc_agent_messages (id, board_id, sender_id, recipient_id, message_type, content, delivery_status)
       VALUES (?, ?, ?, ?, 'delegation', ?, 'pending')`
    ).run(msgId, board_id || null, board?.lead_agent_id || 'main', agent_id, delegationContent);

    deliverMessage(msgId, agent_id, delegationContent, board_id || undefined).catch(() => {});

    // Emit event
    emitEvent('job', jobId, 'task_delegated', `Task delegated to ${agent.name}: ${title}`, undefined, 'queued', {
      agent_id, parent_job_id, board_id, depends_on: depsArray
    });

    res.status(201).json({ job_id: jobId, dependencies_created: depsArray.length });
  } catch (err: any) {
    console.error('[AgentComms] Delegate error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// POST /comms/task-completed (Task 5.3)
// ============================================================

router.post('/comms/task-completed', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { job_id } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'Missing required field: job_id' });
    }

    // Look up the job
    const job = db.prepare('SELECT id, title, board_id, status, agent_id FROM mc_jobs WHERE id = ?').get(job_id) as any;
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Find the board's lead agent
    if (!job.board_id) {
      return res.json({ ok: true, notified: false, reason: 'Job has no board' });
    }

    const board = db.prepare('SELECT id, name, lead_agent_id, objective FROM mc_boards WHERE id = ?').get(job.board_id) as any;
    if (!board || !board.lead_agent_id) {
      return res.json({ ok: true, notified: false, reason: 'Board or lead agent not found' });
    }

    // Send status_update to lead agent
    const statusContent = formatStatusUpdate(board.name, job.title, job.status, 'completed', `Task ${job.title} has been completed.`);
    const msgId = generateId();
    db.prepare(
      `INSERT INTO mc_agent_messages (id, board_id, sender_id, recipient_id, message_type, content, delivery_status)
       VALUES (?, ?, ?, ?, 'status_update', ?, 'pending')`
    ).run(msgId, job.board_id, job.agent_id || board.lead_agent_id, board.lead_agent_id, statusContent);

    deliverMessage(msgId, board.lead_agent_id, statusContent, job.board_id).catch(() => {});

    emitEvent('job', job_id, 'task_completion_notified', `Lead agent notified of task completion: ${job.title}`, undefined, undefined, {
      board_id: job.board_id, lead_agent_id: board.lead_agent_id
    });

    res.json({ ok: true, notified: true });
  } catch (err: any) {
    console.error('[AgentComms] Task completed notification error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// ============================================================
// SHARED MEMORY CRUD (Task 6.1)
// ============================================================

// POST /comms/memory — create or update (upsert by board_id + key)
router.post('/comms/memory', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { board_id, source_agent_id, key, value, tags, memory_type } = req.body;

    if (!board_id || !source_agent_id || !key || !value) {
      return res.status(400).json({ error: 'Missing required fields: board_id, source_agent_id, key, value' });
    }

    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    const mType = memory_type || 'context';

    // Check if entry exists for this board_id + key
    const existing = db.prepare(
      'SELECT id FROM mc_shared_memory WHERE board_id = ? AND key = ?'
    ).get(board_id, key) as any;

    let id: string;
    let created: boolean;

    if (existing) {
      // Update existing
      id = existing.id;
      created = false;
      db.prepare(
        `UPDATE mc_shared_memory SET value = ?, source_agent_id = ?, tags = ?, memory_type = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).run(value, source_agent_id, tagsJson, mType, id);
    } else {
      // Insert new
      id = generateId();
      created = true;
      db.prepare(
        `INSERT INTO mc_shared_memory (id, board_id, source_agent_id, key, value, tags, memory_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, board_id, source_agent_id, key, value, tagsJson, mType);
    }

    // Emit event
    emitEvent('memory', id, 'memory_write', `Memory ${created ? 'created' : 'updated'}: ${key}`, undefined, undefined, {
      board_id, source_agent_id, key, memory_type: mType
    });

    res.status(created ? 201 : 200).json({ id, created });

    // Push SSE events (Task 9.3)
    const sseEvent = { type: 'memory_write', data: { id, board_id, source_agent_id, key, memory_type: mType, created }, boardId: board_id };
    CommsSSEManager.getInstance().pushEvent(board_id, sseEvent);
    CommsSSEManager.getInstance().pushGlobalEvent(sseEvent);
  } catch (err: any) {
    console.error('[AgentComms] Memory write error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// GET /comms/memory — list memory items with filters
router.get('/comms/memory', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { board_id, source_agent_id, tags, memory_type } = req.query;

    const conditions: string[] = [];
    const params: any[] = [];

    if (board_id) {
      conditions.push('board_id = ?');
      params.push(board_id);
    }
    if (source_agent_id) {
      conditions.push('source_agent_id = ?');
      params.push(source_agent_id);
    }
    if (memory_type) {
      conditions.push('memory_type = ?');
      params.push(memory_type);
    }
    if (tags) {
      // Tags filter: check if any of the requested tags appear in the JSON array
      const tagList = (tags as string).split(',').map(t => t.trim());
      const tagConditions = tagList.map(() => `tags LIKE ?`);
      conditions.push(`(${tagConditions.join(' OR ')})`);
      for (const tag of tagList) {
        params.push(`%"${tag}"%`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const items = db.prepare(
      `SELECT * FROM mc_shared_memory ${whereClause} ORDER BY updated_at DESC`
    ).all(...params);

    res.json({ items });
  } catch (err: any) {
    console.error('[AgentComms] Memory list error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});

// DELETE /comms/memory/:id — remove memory item
router.delete('/comms/memory/:id', (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { id } = req.params;

    db.prepare('DELETE FROM mc_shared_memory WHERE id = ?').run(id);

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[AgentComms] Memory delete error:', err.message);
    res.status(500).json({ error: 'Internal error', details: err.message });
  }
});
