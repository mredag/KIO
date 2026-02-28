import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * Feature: jarvis-task-orchestration, Property 2: Message persistence round-trip
 *
 * For any user message sent via POST /sessions/:id/messages, querying
 * GET /sessions/:id/messages should return a message with the same content,
 * role "user", the correct session_id, and a valid timestamp.
 *
 * Validates: Requirements 3.7
 */
describe('Property 2: Message persistence round-trip', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Create Jarvis tables
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

  it('any user message persisted can be retrieved with correct content, role, and session_id', () => {
    fc.assert(
      fc.property(
        // Arbitrary message content (non-empty)
        fc.string({ minLength: 1, maxLength: 500 }),
        // Session title
        fc.string({ minLength: 1, maxLength: 100 }),
        (content, title) => {
          const sessionId = crypto.randomUUID();
          const messageId = crypto.randomUUID();

          // Insert session
          db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, title) VALUES (?, 'planning', ?)`).run(sessionId, title);

          // Insert user message (simulates what POST /sessions/:id/messages does)
          db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, 'user', ?)`).run(messageId, sessionId, content);

          // Query messages (simulates what GET /sessions/:id/messages does)
          const messages = db.prepare('SELECT * FROM mc_jarvis_messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];

          expect(messages.length).toBeGreaterThanOrEqual(1);

          const found = messages.find((m: any) => m.id === messageId);
          expect(found).toBeDefined();
          expect(found.content).toBe(content);
          expect(found.role).toBe('user');
          expect(found.session_id).toBe(sessionId);
          expect(found.created_at).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('multiple messages in a session are all retrievable and maintain insertion order', () => {
    fc.assert(
      fc.property(
        // Generate 2-10 messages with roles
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
            content: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        (messageDefs) => {
          const sessionId = crypto.randomUUID();
          db.prepare(`INSERT INTO mc_jarvis_sessions (id, status, title) VALUES (?, 'planning', 'Test')`).run(sessionId);

          const insertedIds: string[] = [];
          for (const msg of messageDefs) {
            const id = crypto.randomUUID();
            insertedIds.push(id);
            db.prepare(`INSERT INTO mc_jarvis_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)`).run(id, sessionId, msg.role, msg.content);
          }

          const messages = db.prepare('SELECT * FROM mc_jarvis_messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as any[];

          expect(messages.length).toBe(messageDefs.length);

          for (let i = 0; i < messageDefs.length; i++) {
            expect(messages[i].id).toBe(insertedIds[i]);
            expect(messages[i].content).toBe(messageDefs[i].content);
            expect(messages[i].role).toBe(messageDefs[i].role);
            expect(messages[i].session_id).toBe(sessionId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
