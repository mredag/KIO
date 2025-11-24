import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../database/DatabaseService.js';
import { LoggerService } from './LoggerService.js';
import { initializeDatabase } from '../database/init.js';
import Database from 'better-sqlite3';
import fs from 'fs';

describe('LoggerService', () => {
  let db: Database.Database;
  let dbService: DatabaseService;
  let logger: LoggerService;
  const testDbPath = './test-logger.db';

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize database
    db = initializeDatabase(testDbPath);
    dbService = new DatabaseService(db);
    logger = new LoggerService(dbService);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('info', () => {
    it('should log info message to database', () => {
      logger.info('Test info message', { key: 'value' });

      const logs = dbService.getLogs({ level: 'info', limit: 1 });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('Test info message');
      expect(logs[0].details).toEqual({ key: 'value' });
    });

    it('should log info message without details', () => {
      logger.info('Simple info message');

      const logs = dbService.getLogs({ level: 'info', limit: 1 });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Simple info message');
      expect(logs[0].details).toBeNull();
    });
  });

  describe('warn', () => {
    it('should log warning message to database', () => {
      logger.warn('Test warning', { reason: 'test' });

      const logs = dbService.getLogs({ level: 'warn', limit: 1 });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('warn');
      expect(logs[0].message).toBe('Test warning');
      expect(logs[0].details).toEqual({ reason: 'test' });
    });
  });

  describe('error', () => {
    it('should log error message to database', () => {
      logger.error('Test error', { stack: 'error stack' });

      const logs = dbService.getLogs({ level: 'error', limit: 1 });
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('Test error');
      expect(logs[0].details).toEqual({ stack: 'error stack' });
    });
  });

  describe('logError', () => {
    it('should log Error object', () => {
      const error = new Error('Test error object');
      logger.logError(error);

      const logs = dbService.getLogs({ level: 'error', limit: 1 });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test error object');
      expect(logs[0].details?.name).toBe('Error');
      expect(logs[0].details?.message).toBe('Test error object');
      expect(logs[0].details?.stack).toBeDefined();
    });

    it('should log Error object with context', () => {
      const error = new Error('Database error');
      logger.logError(error, 'Database connection failed');

      const logs = dbService.getLogs({ level: 'error', limit: 1 });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Database connection failed');
      expect(logs[0].details?.message).toBe('Database error');
    });
  });

  describe('log filtering', () => {
    beforeEach(() => {
      // Create multiple log entries
      logger.info('Info 1');
      logger.warn('Warning 1');
      logger.error('Error 1');
      logger.info('Info 2');
      logger.error('Error 2');
    });

    it('should filter logs by level', () => {
      const errorLogs = dbService.getLogs({ level: 'error' });
      expect(errorLogs).toHaveLength(2);
      expect(errorLogs.every((log) => log.level === 'error')).toBe(true);

      const warnLogs = dbService.getLogs({ level: 'warn' });
      expect(warnLogs).toHaveLength(1);
      expect(warnLogs[0].level).toBe('warn');
    });

    it('should limit number of logs returned', () => {
      const logs = dbService.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
    });

    it('should return all logs without filters', () => {
      const logs = dbService.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', () => {
      // Close database to simulate error
      db.close();

      // Should not throw, but log to console
      expect(() => {
        logger.info('This should fail gracefully');
      }).not.toThrow();
    });
  });
});
