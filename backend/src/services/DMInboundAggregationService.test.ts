import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { DMInboundAggregationService } from './DMInboundAggregationService.js';

function createBufferDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE dm_inbound_buffer (
      channel TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      merged_text TEXT NOT NULL,
      fragments_json TEXT NOT NULL,
      fragment_count INTEGER NOT NULL DEFAULT 1,
      first_received_at TEXT NOT NULL,
      last_received_at TEXT NOT NULL,
      flush_after TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('buffering', 'processing')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (channel, customer_id)
    );
  `);
  return db;
}

describe('DMInboundAggregationService', () => {
  let db: Database.Database;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-11T10:00:00.000Z'));
    db = createBufferDb();
  });

  afterEach(() => {
    vi.useRealTimers();
    db.close();
  });

  it('dispatches immediately for complete or punctuated messages', () => {
    const service = new DMInboundAggregationService(db);

    expect(service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'Merhaba, saat kacta aciliyorsunuz?',
      receivedAt: new Date().toISOString(),
    })).toEqual({
      action: 'dispatch_now',
      messageText: 'Merhaba, saat kacta aciliyorsunuz?',
      trace: null,
    });

    const rowCount = db.prepare('SELECT COUNT(1) as count FROM dm_inbound_buffer').get() as { count: number };
    expect(rowCount.count).toBe(0);
    service.dispose();
  });

  it('merges short fragments and flushes them after the buffer window', async () => {
    const dispatchSpy = vi.fn().mockResolvedValue(undefined);
    const service = new DMInboundAggregationService(db, {
      bufferWindowMs: 5000,
      onDispatch: dispatchSpy,
    });

    expect(service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'merhaba',
      receivedAt: new Date().toISOString(),
    }).action).toBe('buffered');

    vi.advanceTimersByTime(1000);
    expect(service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'saat',
      receivedAt: new Date().toISOString(),
    }).action).toBe('buffered');

    vi.advanceTimersByTime(1000);
    expect(service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'kacta',
      receivedAt: new Date().toISOString(),
    }).action).toBe('buffered');

    vi.advanceTimersByTime(1000);
    expect(service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'aciliyor',
      receivedAt: new Date().toISOString(),
    }).action).toBe('buffered');

    await vi.advanceTimersByTimeAsync(5000);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'merhaba saat kacta aciliyor',
      trace: expect.objectContaining({
        aggregated: true,
        fragmentCount: 4,
        fragments: ['merhaba', 'saat', 'kacta', 'aciliyor'],
        trigger: 'timer',
      }),
    }));

    const rowCount = db.prepare('SELECT COUNT(1) as count FROM dm_inbound_buffer').get() as { count: number };
    expect(rowCount.count).toBe(0);
    service.dispose();
  });

  it('dispatches merged text immediately when the latest fragment becomes a complete question', () => {
    const service = new DMInboundAggregationService(db, { bufferWindowMs: 5000 });

    expect(service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'merhaba',
      receivedAt: new Date().toISOString(),
    }).action).toBe('buffered');

    vi.advanceTimersByTime(1500);
    const result = service.ingest({
      channel: 'instagram',
      customerId: 'user-1',
      messageText: 'saat kacta aciliyorsunuz?',
      receivedAt: new Date().toISOString(),
    });

    expect(result).toMatchObject({
      action: 'dispatch_now',
      messageText: 'merhaba saat kacta aciliyorsunuz?',
      trace: {
        aggregated: true,
        fragmentCount: 2,
        fragments: ['merhaba', 'saat kacta aciliyorsunuz?'],
        trigger: 'immediate',
      },
    });

    const rowCount = db.prepare('SELECT COUNT(1) as count FROM dm_inbound_buffer').get() as { count: number };
    expect(rowCount.count).toBe(0);
    service.dispose();
  });

  it('restores pending buffers and reschedules them after restart', async () => {
    const now = new Date().toISOString();
    const flushAfter = new Date(Date.now() + 1000).toISOString();
    db.prepare(`
      INSERT INTO dm_inbound_buffer (
        channel,
        customer_id,
        merged_text,
        fragments_json,
        fragment_count,
        first_received_at,
        last_received_at,
        flush_after,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'instagram',
      'user-2',
      'merhaba saat',
      JSON.stringify([
        { text: 'merhaba', receivedAt: now },
        { text: 'saat', receivedAt: now },
      ]),
      2,
      now,
      now,
      flushAfter,
      'buffering',
      now,
      now,
    );

    const dispatchSpy = vi.fn().mockResolvedValue(undefined);
    const service = new DMInboundAggregationService(db, {
      bufferWindowMs: 5000,
      onDispatch: dispatchSpy,
    });

    await vi.advanceTimersByTimeAsync(1000);

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      channel: 'instagram',
      customerId: 'user-2',
      messageText: 'merhaba saat',
      trace: expect.objectContaining({
        aggregated: true,
        fragmentCount: 2,
        trigger: 'timer',
      }),
    }));

    const rowCount = db.prepare('SELECT COUNT(1) as count FROM dm_inbound_buffer').get() as { count: number };
    expect(rowCount.count).toBe(0);
    service.dispose();
  });
});
