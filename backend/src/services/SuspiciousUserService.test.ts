import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { SuspiciousUserService } from './SuspiciousUserService.js';

function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE instagram_customers (
      instagram_id TEXT PRIMARY KEY,
      name TEXT,
      interaction_count INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE instagram_interactions (
      id TEXT PRIMARY KEY,
      instagram_id TEXT,
      direction TEXT,
      message_text TEXT,
      intent TEXT,
      sentiment TEXT,
      ai_response TEXT,
      created_at TEXT
    );

    CREATE TABLE whatsapp_interactions (
      id TEXT PRIMARY KEY,
      phone TEXT,
      direction TEXT,
      message_text TEXT,
      ai_response TEXT,
      created_at TEXT
    );
  `);
  return db;
}

describe('SuspiciousUserService', () => {
  let db: Database.Database;
  let service: SuspiciousUserService;

  beforeEach(() => {
    db = createDb();
    service = new SuspiciousUserService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('escalates from guarded to final warning to bad-customer mode', () => {
    const first = service.flagUser('instagram', 'user-1', 'uygunsuz imada bulundu', {
      action: 'retry_question',
      severity: 'medium',
      source: 'test',
      messageText: 'mutlu son var mi',
    });
    expect(first.conductState).toBe('guarded');
    expect(first.shouldReply).toBe(true);
    expect(first.conductScore).toBe(1);

    const second = service.flagUser('instagram', 'user-1', 'tekrar denedi', {
      action: 'retry_question',
      severity: 'medium',
      source: 'test',
      messageText: 'guzel son?',
    });
    expect(second.conductState).toBe('final_warning');
    expect(second.shouldReply).toBe(true);
    expect(second.conductScore).toBe(2);

    const third = service.flagUser('instagram', 'user-1', 'acik uygunsuz talep', {
      action: 'block_message',
      severity: 'high',
      source: 'test',
      messageText: 'happy ending',
    });
    expect(third.conductState).toBe('silent');
    expect(third.shouldReply).toBe(true);
    expect(third.silentUntil).not.toBeNull();

    const check = service.checkSuspicious('instagram', 'user-1');
    expect(check.conductState).toBe('silent');
    expect(check.shouldReply).toBe(true);
  });

  it('allows creating a force-normal override for a test account before any violation', () => {
    const user = service.setManualMode('instagram', 'test-account', {
      mode: 'force_normal',
      durationHours: 24,
      note: 'manual test allow',
    });

    expect(user.platformUserId).toBe('test-account');
    expect(user.manualMode).toBe('force_normal');
    expect(user.conductState).toBe('normal');
    expect(user.shouldReply).toBe(true);
    expect(user.offenseCount).toBe(0);

    const check = service.checkSuspicious('instagram', 'test-account');
    expect(check.conductState).toBe('normal');
    expect(check.manualMode).toBe('force_normal');
  });

  it('resets a user back to normal and records events', () => {
    service.flagUser('instagram', 'user-2', 'ilk ihlal', {
      action: 'retry_question',
      severity: 'medium',
      source: 'test',
    });
    service.setManualMode('instagram', 'user-2', {
      mode: 'force_silent',
      durationHours: 24,
      note: 'manual mute',
    });

    const reset = service.unflagUser('instagram', 'user-2');
    expect(reset).toBe(true);

    const check = service.checkSuspicious('instagram', 'user-2');
    expect(check.isSuspicious).toBe(false);
    expect(check.conductState).toBe('normal');

    const events = service.getConductEvents('instagram', 'user-2', 10);
    expect(events.map((event) => event.eventType).sort()).toEqual(['manual_override', 'manual_reset', 'violation'].sort());
  });

  it('lists conduct users with server-side search, pagination, and test-like markers', () => {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO instagram_customers (instagram_id, name, interaction_count, created_at, updated_at)
      VALUES
        ('conduct_demo', 'DM Simulator', 1, ?, ?),
        ('real_user', 'Bahtyar', 1, ?, ?)
    `).run(now, now, now, now);

    service.flagUser('instagram', 'conduct_demo', 'test conduct row', {
      action: 'block_message',
      severity: 'high',
      source: 'test',
    });
    service.flagUser('instagram', 'real_user', 'real conduct row', {
      action: 'retry_question',
      severity: 'medium',
      source: 'test',
    });
    service.setManualMode('instagram', 'lifted_test', {
      mode: 'force_normal',
      durationHours: 24,
      note: 'test account',
    });

    const usernameResult = service.listSuspiciousUsers({
      searchQuery: 'bahtyar',
      limit: 10,
      offset: 0,
    });
    expect(usernameResult.total).toBe(1);
    expect(usernameResult.users[0]?.platformUserId).toBe('real_user');
    expect(usernameResult.users[0]?.isTestLike).toBe(false);

    const testResult = service.listSuspiciousUsers({
      searchQuery: 'conduct',
      limit: 10,
      offset: 0,
    });
    expect(testResult.stats.testLike).toBeGreaterThanOrEqual(1);
    expect(testResult.users.some((user) => user.isTestLike)).toBe(true);

    const pagedResult = service.listSuspiciousUsers({
      limit: 1,
      offset: 1,
    });
    expect(pagedResult.limit).toBe(1);
    expect(pagedResult.offset).toBe(1);
    expect(pagedResult.total).toBe(3);
    expect(pagedResult.users).toHaveLength(1);
  });
});
