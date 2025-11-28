/**
 * EventLogService - Service for logging coupon-related events
 * 
 * Provides audit trail for all coupon operations including token issuance,
 * consumption, redemption attempts, and completions.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import Database from 'better-sqlite3';
import { CouponEvent, CouponEventDb } from '../database/types.js';
import { PIIMasking } from './PIIMasking.js';

export class EventLogService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Log a coupon-related event
   * Automatically masks PII in the details field for logging
   * 
   * @param event - Event data to log
   * @returns The created event with ID
   */
  logEvent(event: Omit<CouponEvent, 'id' | 'createdAt'>): CouponEvent {
    const now = new Date().toISOString();
    
    // Mask PII in details if present
    let maskedDetails = event.details;
    if (maskedDetails) {
      maskedDetails = { ...maskedDetails };
      
      // Mask phone numbers in details
      if (maskedDetails.phone) {
        maskedDetails.phone = PIIMasking.maskPhone(maskedDetails.phone);
      }
      
      // Mask tokens in details
      if (maskedDetails.token) {
        maskedDetails.token = PIIMasking.maskToken(maskedDetails.token);
      }
    }

    const result = this.db
      .prepare(
        `INSERT INTO coupon_events (phone, event, token, details, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        event.phone || null,
        event.event,
        event.token || null,
        maskedDetails ? JSON.stringify(maskedDetails) : null,
        now
      );

    return {
      id: result.lastInsertRowid as number,
      phone: event.phone,
      event: event.event,
      token: event.token,
      details: event.details, // Return original unmasked details
      createdAt: new Date(now),
    };
  }

  /**
   * Get event history for a specific phone number
   * 
   * @param phone - Phone number to retrieve events for
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of events ordered by most recent first
   */
  getEventsByPhone(phone: string, limit: number = 100): CouponEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM coupon_events
         WHERE phone = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(phone, limit) as CouponEventDb[];

    return rows.map(this.parseEventRow);
  }

  /**
   * Get all events for a specific token
   * Useful for tracking token lifecycle
   * 
   * @param token - Token to retrieve events for
   * @returns Array of events ordered by most recent first
   */
  getEventsByToken(token: string): CouponEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM coupon_events
         WHERE token = ?
         ORDER BY created_at DESC, id DESC`
      )
      .all(token) as CouponEventDb[];

    return rows.map(this.parseEventRow);
  }

  /**
   * Get recent events across all users
   * Useful for admin monitoring
   * 
   * @param limit - Maximum number of events to return (default: 50)
   * @returns Array of events ordered by most recent first
   */
  getRecentEvents(limit: number = 50): CouponEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM coupon_events
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(limit) as CouponEventDb[];

    return rows.map(this.parseEventRow);
  }

  /**
   * Get events by type
   * 
   * @param eventType - Type of event to filter by
   * @param limit - Maximum number of events to return (default: 100)
   * @returns Array of events ordered by most recent first
   */
  getEventsByType(
    eventType: CouponEvent['event'],
    limit: number = 100
  ): CouponEvent[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM coupon_events
         WHERE event = ?
         ORDER BY created_at DESC, id DESC
         LIMIT ?`
      )
      .all(eventType, limit) as CouponEventDb[];

    return rows.map(this.parseEventRow);
  }

  /**
   * Count events by type for analytics
   * 
   * @param startDate - Optional start date for filtering
   * @param endDate - Optional end date for filtering
   * @returns Object with event counts by type
   */
  getEventCounts(startDate?: Date, endDate?: Date): Record<string, number> {
    let query = 'SELECT event, COUNT(*) as count FROM coupon_events';
    const params: any[] = [];

    if (startDate || endDate) {
      query += ' WHERE';
      if (startDate) {
        query += ' created_at >= ?';
        params.push(startDate.toISOString());
      }
      if (endDate) {
        if (startDate) query += ' AND';
        query += ' created_at <= ?';
        params.push(endDate.toISOString());
      }
    }

    query += ' GROUP BY event';

    const rows = this.db.prepare(query).all(...params) as Array<{
      event: string;
      count: number;
    }>;

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.event] = row.count;
    }

    return counts;
  }

  /**
   * Parse a database row into a CouponEvent object
   * Converts snake_case to camelCase and parses JSON fields
   */
  private parseEventRow(row: CouponEventDb): CouponEvent {
    return {
      id: row.id,
      phone: row.phone || undefined,
      event: row.event as CouponEvent['event'],
      token: row.token || undefined,
      details: row.details ? JSON.parse(row.details) : undefined,
      createdAt: new Date(row.created_at),
    };
  }
}
