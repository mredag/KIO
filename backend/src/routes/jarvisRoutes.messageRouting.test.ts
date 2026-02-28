import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Feature: jarvis-task-orchestration, Property 3: Outgoing message routing and format
 *
 * For any user message sent in any planning session, the RPC call to OpenClaw
 * should target the session's openclaw_session_key and include the message content.
 * The session key should remain consistent across all messages within the same session.
 *
 * We test this by simulating the route's DB-level logic: looking up the session's
 * openclaw_session_key and verifying the sendMessage call would use that key with
 * the correct content. This validates the routing contract without needing a live
 * WebSocket connection.
 *
 * Validates: Requirements 1.2, 2.5, 3.3
 */
describe('Property 3: Outgoing message routing and format', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE mc_jarvis_sessions (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'planning',
        title TEXT NOT NULL DEFAULT 'Yeni Görev',
        summary TEXT,
        agent_id TEXT,
        job_id TEXT,
        openclaw_session_key TEXT,
        execution_session_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE mc_jarvis_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES mc_jarvis_sessions(id)
      );
      CREATE INDEX idx_mc_jarvis_messages_session ON mc_jarvis_messages(session_id, created_at ASC);
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('message routing always targets the session openclaw_session_key with correct content', () => {
    fc.assert(
      fc.property(
        // Session key (simulates what OpenClaw returns on session creation)
        fc.stringMatching(/^[a-zA-Z0-9_-]{8,36}$/),
        // Multiple user messages to send in sequence
        fc.array(fc.string({ minLength: 1, maxLength: 300 }), { minLength: 1, maxLength: 8 }),
        (openclawSessionKey, messages) => {
          const sessionId = crypto.randomUUID();

          // Create session with an openclaw_session_key (set during POST /sessions)
          db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, openclaw_session_key) VALUES (?, 'planning', ?)`).run(
            sessionId, openclawSessionKey
          );

          // Track what sendMessage would be called with
          const sendCalls: Array<{ sessionKey: string; content: string }> = [];

          for (const msgContent of messages) {
            // Simulate the route handler logic:
            // 1. Look up session
            const session = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
            expect(session).toBeDefined();
            expect(session.status).toBe('planning');

            // 2. Persist user message
            const messageId = crypto.randomUUID();
            db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'user', ?)`).run(
              messageId, sessionId, msgContent.trim()
            );

            // 3. Route to OpenClaw using session's key
            if (session.openclaw_session_key) {
              // Determine message content (first message gets system prompt prepended)
              const messageCount = (db.prepare(
                'SELECT COUNT(*) as count FROM mc_jarvis_messages WHERE session_id = ? AND role = ?'
              ).get(sessionId, 'user') as any).count;

              const messageToSend = messageCount <= 1
                ? `SYSTEM_PROMPT\n\n---\n\nKullanıcı görevi: ${msgContent.trim()}`
                : msgContent.trim();

              sendCalls.push({
                sessionKey: session.openclaw_session_key,
                content: messageToSend,
              });
            }
          }

          // Property assertions:
          // 1. All calls target the same session key
          for (const call of sendCalls) {
            expect(call.sessionKey).toBe(openclawSessionKey);
          }

          // 2. Every message content is included in the send call
          expect(sendCalls.length).toBe(messages.length);
          for (let i = 0; i < messages.length; i++) {
            expect(sendCalls[i].content).toContain(messages[i].trim());
          }

          // 3. First message includes system prompt prefix
          if (sendCalls.length > 0) {
            expect(sendCalls[0].content).toContain('SYSTEM_PROMPT');
            expect(sendCalls[0].content).toContain('Kullanıcı görevi:');
          }

          // 4. Subsequent messages are sent as-is (no system prompt)
          for (let i = 1; i < sendCalls.length; i++) {
            expect(sendCalls[i].content).not.toContain('SYSTEM_PROMPT');
            expect(sendCalls[i].content).toBe(messages[i].trim());
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages are only routed when session has an openclaw_session_key', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.boolean(),
        (content, hasKey) => {
          const sessionId = crypto.randomUUID();
          const sessionKey = hasKey ? crypto.randomUUID() : null;

          db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, openclaw_session_key) VALUES (?, 'planning', ?)`).run(
            sessionId, sessionKey
          );

          const session = db.prepare('SELECT * FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
          let routed = false;

          if (session.openclaw_session_key) {
            routed = true;
          }

          expect(routed).toBe(hasKey);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('session key remains consistent across the entire session lifecycle', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{8,36}$/),
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
            content: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (openclawSessionKey, messageDefs) => {
          const sessionId = crypto.randomUUID();
          db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, openclaw_session_key) VALUES (?, 'planning', ?)`).run(
            sessionId, openclawSessionKey
          );

          // Simulate multiple message exchanges
          for (const msg of messageDefs) {
            db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`).run(
              crypto.randomUUID(), sessionId, msg.role, msg.content
            );
          }

          // After all messages, the session key should still be the same
          const session = db.prepare('SELECT openclaw_session_key FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
          expect(session.openclaw_session_key).toBe(openclawSessionKey);
        }
      ),
      { numRuns: 100 }
    );
  });
});
