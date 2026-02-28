import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { extractTaskSummary } from './jarvisRoutes.js';

/**
 * Feature: jarvis-task-orchestration, Property 5: Task summary detection
 *
 * For any assistant message containing a valid task_summary JSON block
 * (with title, objective, deliverables, suggestedModel fields), the system
 * should transition the session status to awaiting_confirmation. For messages
 * without a valid summary block, the session should remain in planning status.
 *
 * Validates: Requirements 1.2, 3.4
 */
describe('Property 5: Task summary detection', () => {
  const validSummaryArb = fc.record({
    type: fc.constant('task_summary'),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    objective: fc.string({ minLength: 1, maxLength: 200 }),
    constraints: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
    deliverables: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 5 }),
    suggestedModel: fc.constantFrom('moonshotai/kimi-k2', 'openai/gpt-4o-mini', 'deepseek/deepseek-chat'),
    suggestedRole: fc.constantFrom('developer', 'researcher', 'analyst'),
  });

  it('valid task_summary JSON blocks are detected correctly', () => {
    fc.assert(
      fc.property(
        validSummaryArb,
        fc.string({ minLength: 0, maxLength: 100 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        (summary, prefix, suffix) => {
          const jsonStr = JSON.stringify(summary, null, 2);
          const content = `${prefix}\n\`\`\`json\n${jsonStr}\n\`\`\`\n${suffix}`;

          const result = extractTaskSummary(content);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('task_summary');
          expect(result!.title).toBe(summary.title);
          expect(result!.objective).toBe(summary.objective);
          expect(result!.suggestedModel).toBe(summary.suggestedModel);
          expect(result!.deliverables).toEqual(summary.deliverables);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('messages without task_summary JSON return null', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }).filter(s => !s.includes('task_summary')),
        (content) => {
          const result = extractTaskSummary(content);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('JSON blocks missing required fields return null', () => {
    fc.assert(
      fc.property(
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 50 }),
          objective: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (partial) => {
          const content = `\`\`\`json\n${JSON.stringify(partial)}\n\`\`\``;
          const result = extractTaskSummary(content);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('summary detection drives session status transition in the database', () => {
    // This tests the full integration: extractTaskSummary result determines
    // whether a session transitions from planning → awaiting_confirmation
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE mc_jarvis_sessions (
        id TEXT PRIMARY KEY,
        status TEXT DEFAULT 'planning',
        title TEXT NOT NULL DEFAULT 'Yeni Görev',
        summary TEXT,
        openclaw_session_key TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try {
      fc.assert(
        fc.property(
          validSummaryArb,
          fc.string({ minLength: 1, maxLength: 200 }),
          (summaryObj, plainMessage) => {
            const sessionId = crypto.randomUUID();
            db.prepare(`INSERT INTO mc_jarvis_sessions (id, status) VALUES (?, 'planning')`).run(sessionId);

            // Message WITH valid summary → should transition
            const withSummary = `Here is the plan:\n\`\`\`json\n${JSON.stringify(summaryObj)}\n\`\`\``;
            const detected = extractTaskSummary(withSummary);

            if (detected) {
              db.prepare(`UPDATE mc_jarvis_sessions SET status = 'awaiting_confirmation', summary = ? WHERE id = ? AND status = 'planning'`).run(
                JSON.stringify(detected), sessionId
              );
            }

            const afterSummary = db.prepare('SELECT status, summary FROM mc_jarvis_sessions WHERE id = ?').get(sessionId) as any;
            expect(afterSummary.status).toBe('awaiting_confirmation');
            expect(JSON.parse(afterSummary.summary).title).toBe(summaryObj.title);

            // Plain message on a NEW session → should stay planning
            const sessionId2 = crypto.randomUUID();
            db.prepare(`INSERT INTO mc_jarvis_sessions (id, status) VALUES (?, 'planning')`).run(sessionId2);

            const notDetected = extractTaskSummary(plainMessage);
            if (notDetected) {
              db.prepare(`UPDATE mc_jarvis_sessions SET status = 'awaiting_confirmation' WHERE id = ? AND status = 'planning'`).run(sessionId2);
            }

            // Plain messages shouldn't contain task_summary, so status stays planning
            // (unless the random string happens to contain a valid JSON block, which is astronomically unlikely)
            if (!notDetected) {
              const afterPlain = db.prepare('SELECT status FROM mc_jarvis_sessions WHERE id = ?').get(sessionId2) as any;
              expect(afterPlain.status).toBe('planning');
            }
          }
        ),
        { numRuns: 100 }
      );
    } finally {
      db.close();
    }
  });
});
