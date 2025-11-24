import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../database/DatabaseService.js';
import { LogRotationService } from './LogRotationService.js';
import { initializeDatabase } from '../database/init.js';
import Database from 'better-sqlite3';
import fs from 'fs';

describe('LogRotationService', () => {
  let db: Database.Database;
  let dbService: DatabaseService;
  let logRotation: LogRotationService;
  const testDbPath = './test-log-rotation.db';

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize database
    db = initializeDatabase(testDbPath);
    dbService = new DatabaseService(db);
    logRotation = new LogRotationService(dbService, 30);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('rotateLogs', () => {
    it('should delete logs older than retention period', () => {
      // Create old log entry (35 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35);
      
      db.prepare(
        'INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, ?)'
      ).run('info', 'Old log', oldDate.toISOString());

      // Create recent log entry
      dbService.createLog({
        level: 'info',
        message: 'Recent log',
      });

      // Verify we have 2 logs
      expect(logRotation.getLogCount()).toBe(2);

      // Rotate logs
      const deletedCount = logRotation.rotateLogs();

      // Should delete 1 old log
      expect(deletedCount).toBe(1);
      expect(logRotation.getLogCount()).toBe(1);

      // Verify only recent log remains
      const logs = dbService.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Recent log');
    });

    it('should not delete logs within retention period', () => {
      // Create log from 20 days ago (within 30-day retention)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 20);
      
      db.prepare(
        'INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, ?)'
      ).run('info', 'Recent log', recentDate.toISOString());

      // Rotate logs
      const deletedCount = logRotation.rotateLogs();

      // Should not delete any logs
      expect(deletedCount).toBe(0);
      expect(logRotation.getLogCount()).toBe(1);
    });

    it('should return 0 when no old logs exist', () => {
      // Create only recent logs
      dbService.createLog({ level: 'info', message: 'Log 1' });
      dbService.createLog({ level: 'info', message: 'Log 2' });

      const deletedCount = logRotation.rotateLogs();
      expect(deletedCount).toBe(0);
      expect(logRotation.getLogCount()).toBe(2);
    });
  });

  describe('getLogCount', () => {
    it('should return correct log count', () => {
      expect(logRotation.getLogCount()).toBe(0);

      dbService.createLog({ level: 'info', message: 'Log 1' });
      expect(logRotation.getLogCount()).toBe(1);

      dbService.createLog({ level: 'warn', message: 'Log 2' });
      expect(logRotation.getLogCount()).toBe(2);
    });
  });

  describe('getLogStats', () => {
    it('should return log statistics', () => {
      // Create various logs
      dbService.createLog({ level: 'info', message: 'Info 1' });
      dbService.createLog({ level: 'info', message: 'Info 2' });
      dbService.createLog({ level: 'warn', message: 'Warning 1' });
      dbService.createLog({ level: 'error', message: 'Error 1' });

      const stats = logRotation.getLogStats();

      expect(stats.total).toBe(4);
      expect(stats.byLevel.info).toBe(2);
      expect(stats.byLevel.warn).toBe(1);
      expect(stats.byLevel.error).toBe(1);
      expect(stats.oldestLog).toBeDefined();
      expect(stats.newestLog).toBeDefined();
    });

    it('should return empty stats when no logs exist', () => {
      const stats = logRotation.getLogStats();

      expect(stats.total).toBe(0);
      expect(stats.byLevel.info).toBe(0);
      expect(stats.byLevel.warn).toBe(0);
      expect(stats.byLevel.error).toBe(0);
      expect(stats.oldestLog).toBeNull();
      expect(stats.newestLog).toBeNull();
    });
  });

  describe('custom retention period', () => {
    it('should respect custom retention period', () => {
      // Create service with 7-day retention
      const shortRetention = new LogRotationService(dbService, 7);

      // Create log from 10 days ago
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      
      db.prepare(
        'INSERT INTO system_logs (level, message, created_at) VALUES (?, ?, ?)'
      ).run('info', 'Old log', oldDate.toISOString());

      // Should delete the 10-day-old log
      const deletedCount = shortRetention.rotateLogs();
      expect(deletedCount).toBe(1);
    });
  });
});
