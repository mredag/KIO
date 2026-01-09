/**
 * Tests for EventLogService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { EventLogService } from './EventLogService.js';
import { CouponEvent } from '../database/types.js';

describe('EventLogService', () => {
  let db: Database.Database;
  let service: EventLogService;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    
    // Create coupon_events table
    db.exec(`
      CREATE TABLE IF NOT EXISTS coupon_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT,
        event TEXT,
        token TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_coupon_events_phone ON coupon_events(phone);
      CREATE INDEX IF NOT EXISTS idx_coupon_events_created ON coupon_events(created_at);
    `);

    service = new EventLogService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('logEvent', () => {
    it('should log an event and return it with ID', () => {
      const event = service.logEvent({
        phone: '+905551234567',
        event: 'coupon_awarded',
        token: 'ABC123DEF456',
        details: { balance: 2, remainingToFree: 2 },
      });

      expect(event.id).toBeDefined();
      expect(event.phone).toBe('+905551234567');
      expect(event.event).toBe('coupon_awarded');
      expect(event.token).toBe('ABC123DEF456');
      expect(event.details).toEqual({ balance: 2, remainingToFree: 2 });
      expect(event.createdAt).toBeInstanceOf(Date);
    });

    it('should mask PII in stored details', () => {
      service.logEvent({
        phone: '+905551234567',
        event: 'coupon_awarded',
        token: 'ABC123DEF456',
        details: {
          phone: '+905551234567',
          token: 'ABC123DEF456',
          balance: 2,
        },
      });

      // Check what's actually stored in the database
      const row = db.prepare('SELECT details FROM coupon_events WHERE id = 1').get() as any;
      const storedDetails = JSON.parse(row.details);

      // PII should be masked in stored details
      expect(storedDetails.phone).toBe('*********4567');
      expect(storedDetails.token).toBe('ABC1****F456');
      expect(storedDetails.balance).toBe(2);
    });

    it('should handle events without phone or token', () => {
      const event = service.logEvent({
        event: 'issued',
        details: { kioskId: 'kiosk-1' },
      });

      expect(event.id).toBeDefined();
      expect(event.phone).toBeUndefined();
      expect(event.token).toBeUndefined();
      expect(event.details).toEqual({ kioskId: 'kiosk-1' });
    });
  });

  describe('getEventsByPhone', () => {
    beforeEach(() => {
      // Insert test events - order matters for testing
      const event1 = service.logEvent({
        phone: '+905551234567',
        event: 'coupon_awarded',
        token: 'TOKEN1',
      });
      const event2 = service.logEvent({
        phone: '+905551234567',
        event: 'redemption_attempt',
      });
      const event3 = service.logEvent({
        phone: '+905559999999',
        event: 'coupon_awarded',
        token: 'TOKEN2',
      });
    });

    it('should return events for specific phone', () => {
      const events = service.getEventsByPhone('+905551234567');

      expect(events).toHaveLength(2);
      // Events are ordered by created_at DESC, but since they're created in same millisecond,
      // order by ID DESC is used (most recent ID first)
      expect(events[0].event).toBe('redemption_attempt'); // ID 2
      expect(events[1].event).toBe('coupon_awarded'); // ID 1
      expect(events.every((e) => e.phone === '+905551234567')).toBe(true);
    });

    it('should respect limit parameter', () => {
      const events = service.getEventsByPhone('+905551234567', 1);

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('redemption_attempt'); // Most recent (ID 2)
    });

    it('should return empty array for phone with no events', () => {
      const events = service.getEventsByPhone('+905550000000');

      expect(events).toHaveLength(0);
    });
  });

  describe('getEventsByToken', () => {
    beforeEach(() => {
      service.logEvent({
        phone: '+905551234567',
        event: 'issued',
        token: 'TOKEN1',
      });
      service.logEvent({
        phone: '+905551234567',
        event: 'coupon_awarded',
        token: 'TOKEN1',
      });
      service.logEvent({
        phone: '+905559999999',
        event: 'coupon_awarded',
        token: 'TOKEN2',
      });
    });

    it('should return events for specific token', () => {
      const events = service.getEventsByToken('TOKEN1');

      expect(events).toHaveLength(2);
      expect(events[0].event).toBe('coupon_awarded'); // Most recent first
      expect(events[1].event).toBe('issued');
      expect(events.every((e) => e.token === 'TOKEN1')).toBe(true);
    });
  });

  describe('getRecentEvents', () => {
    beforeEach(() => {
      // Insert multiple events
      for (let i = 0; i < 10; i++) {
        service.logEvent({
          phone: `+90555123456${i}`,
          event: 'coupon_awarded',
          token: `TOKEN${i}`,
        });
      }
    });

    it('should return recent events across all users', () => {
      const events = service.getRecentEvents(5);

      expect(events).toHaveLength(5);
      // Should be ordered by most recent first
      expect(events[0].token).toBe('TOKEN9');
      expect(events[4].token).toBe('TOKEN5');
    });
  });

  describe('getEventsByType', () => {
    beforeEach(() => {
      service.logEvent({ event: 'issued', token: 'TOKEN1' });
      service.logEvent({ event: 'coupon_awarded', phone: '+905551234567', token: 'TOKEN1' });
      service.logEvent({ event: 'redemption_attempt', phone: '+905551234567' });
      service.logEvent({ event: 'redemption_granted', phone: '+905551234567' });
      service.logEvent({ event: 'coupon_awarded', phone: '+905559999999', token: 'TOKEN2' });
    });

    it('should return events of specific type', () => {
      const events = service.getEventsByType('coupon_awarded');

      expect(events).toHaveLength(2);
      expect(events.every((e) => e.event === 'coupon_awarded')).toBe(true);
    });

    it('should return events ordered by most recent first', () => {
      const events = service.getEventsByType('coupon_awarded');

      expect(events[0].phone).toBe('+905559999999'); // Most recent
      expect(events[1].phone).toBe('+905551234567');
    });
  });

  describe('getEventCounts', () => {
    beforeEach(() => {
      service.logEvent({ event: 'issued', token: 'TOKEN1' });
      service.logEvent({ event: 'coupon_awarded', phone: '+905551234567', token: 'TOKEN1' });
      service.logEvent({ event: 'coupon_awarded', phone: '+905559999999', token: 'TOKEN2' });
      service.logEvent({ event: 'redemption_attempt', phone: '+905551234567' });
      service.logEvent({ event: 'redemption_granted', phone: '+905551234567' });
    });

    it('should return counts by event type', () => {
      const counts = service.getEventCounts();

      expect(counts).toEqual({
        issued: 1,
        coupon_awarded: 2,
        redemption_attempt: 1,
        redemption_granted: 1,
      });
    });

    it('should filter by date range', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

      // All events are in the past, so future date range should return empty
      const counts = service.getEventCounts(future, undefined);

      expect(Object.keys(counts)).toHaveLength(0);
    });
  });
});
