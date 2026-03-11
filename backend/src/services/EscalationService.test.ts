import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { EscalationService } from './EscalationService.js';

function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE mc_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT,
      entity_id TEXT,
      event_type TEXT,
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE instagram_customers (
      instagram_id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT
    );
  `);
  return db;
}

describe('EscalationService', () => {
  it('routes permanent ban events to Telegram', () => {
    const db = createDb();
    const service = new EscalationService(db, {
      isEnabled: () => false,
      notify: async () => false,
    } as any);

    const decision = (service as any).decide({
      source: 'dm_pipeline',
      type: 'permanent_ban_applied',
      severity: 'critical',
      title: 'Perma ban',
      details: 'test',
      metadata: {},
    });

    expect(decision.action).toBe('telegram');
  });

  it('formats permanent ban alerts with operator action guidance', () => {
    const db = createDb();
    db.prepare(`INSERT INTO instagram_customers (instagram_id, name) VALUES (?, ?)`).run('1452244026404093', 'Test User');
    const service = new EscalationService(db, {
      isEnabled: () => false,
      notify: async () => false,
    } as any);

    const body = (service as any).formatBody({
      source: 'dm_pipeline',
      type: 'permanent_ban_applied',
      severity: 'critical',
      title: 'Perma ban',
      details: 'High-confidence abusive slur/hate-speech wording detected.',
      metadata: {
        sender_id: '1452244026404093',
        reason: 'High-confidence abusive slur/hate-speech wording detected.',
        message_excerpt: 'Anani sikeyim',
        matched_terms: ['severe_abuse'],
        conduct_state_before: 'final_warning',
        offense_count_after: 3,
      },
    });

    expect(body).toContain('kalici engel');
    expect(body).toContain('Instagram');
    expect(body).toContain('Anani sikeyim');
    expect(body).toContain('severe_abuse');
  });
});
