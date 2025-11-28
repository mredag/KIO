import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupService } from './BackupService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { initializeDatabase } from '../database/init.js';
import * as fs from 'fs';
import * as path from 'path';

describe('BackupService', () => {
  let db: DatabaseService;
  let backupService: BackupService;
  const testBackupDir = './data/test-backups';
  const testDbPath = './data/test-backup-db.db';

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize test database
    const database = initializeDatabase(testDbPath);
    db = new DatabaseService(database);

    // Create backup service with test directory
    backupService = new BackupService(db, testBackupDir);
  });

  afterEach(() => {
    // Close database first
    db.close();

    // Clean up test backup directory
    if (fs.existsSync(testBackupDir)) {
      const files = fs.readdirSync(testBackupDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testBackupDir, file));
      }
      fs.rmdirSync(testBackupDir);
    }

    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Clean up WAL files
    if (fs.existsSync(testDbPath + '-wal')) {
      fs.unlinkSync(testDbPath + '-wal');
    }
    if (fs.existsSync(testDbPath + '-shm')) {
      fs.unlinkSync(testDbPath + '-shm');
    }
  });

  describe('createBackup', () => {
    it('should create a backup file with all database tables', async () => {
      // Create backup
      const filepath = await backupService.createBackup();

      // Verify file exists
      expect(fs.existsSync(filepath)).toBe(true);

      // Read and parse backup file
      const backupContent = fs.readFileSync(filepath, 'utf-8');
      const backupData = JSON.parse(backupContent);

      // Verify backup structure
      expect(backupData).toHaveProperty('timestamp');
      expect(backupData).toHaveProperty('version');
      expect(backupData).toHaveProperty('data');

      // Verify all tables are included
      expect(backupData.data).toHaveProperty('massages');
      expect(backupData.data).toHaveProperty('survey_templates');
      expect(backupData.data).toHaveProperty('survey_responses');
      expect(backupData.data).toHaveProperty('kiosk_state');
      expect(backupData.data).toHaveProperty('system_settings');
      expect(backupData.data).toHaveProperty('coupon_tokens');
      expect(backupData.data).toHaveProperty('coupon_wallets');
      expect(backupData.data).toHaveProperty('coupon_redemptions');
      expect(backupData.data).toHaveProperty('coupon_events');
      expect(backupData.data).toHaveProperty('coupon_rate_limits');

      // Verify data types
      expect(Array.isArray(backupData.data.massages)).toBe(true);
      expect(Array.isArray(backupData.data.survey_templates)).toBe(true);
      expect(Array.isArray(backupData.data.coupon_tokens)).toBe(true);
      expect(Array.isArray(backupData.data.coupon_wallets)).toBe(true);
      expect(Array.isArray(backupData.data.coupon_redemptions)).toBe(true);
      expect(Array.isArray(backupData.data.coupon_events)).toBe(true);
      expect(Array.isArray(backupData.data.coupon_rate_limits)).toBe(true);
      expect(Array.isArray(backupData.data.survey_responses)).toBe(true);
      expect(typeof backupData.data.kiosk_state).toBe('object');
      expect(typeof backupData.data.system_settings).toBe('object');
    });

    it('should create backup with valid JSON format', async () => {
      const filepath = await backupService.createBackup();

      // Should not throw when parsing
      expect(() => {
        const content = fs.readFileSync(filepath, 'utf-8');
        JSON.parse(content);
      }).not.toThrow();
    });

    it('should include massage data in backup', async () => {
      // Create a test massage
      db.createMassage({
        name: 'Test Massage',
        short_description: 'Test description',
        long_description: 'Long test description',
        duration: '60 minutes',
        media_type: 'photo',
        media_url: '/uploads/test.jpg',
        purpose_tags: ['Relaxation'],
        sessions: [{ name: 'Single Session', price: 100 }],
        is_featured: true,
        is_campaign: false,
        sort_order: 1,
      });

      // Create backup
      const filepath = await backupService.createBackup();
      const backupContent = fs.readFileSync(filepath, 'utf-8');
      const backupData = JSON.parse(backupContent);

      // Verify massage is in backup
      expect(backupData.data.massages.length).toBeGreaterThan(0);
      const testMassage = backupData.data.massages.find(
        (m: any) => m.name === 'Test Massage'
      );
      expect(testMassage).toBeDefined();
      expect(testMassage.short_description).toBe('Test description');
    });
  });

  describe('cleanOldBackups', () => {
    it('should delete backup files older than 30 days', async () => {
      // Create a backup file
      const filepath = await backupService.createBackup();
      expect(fs.existsSync(filepath)).toBe(true);

      // Modify file timestamp to be 31 days old
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);
      fs.utimesSync(filepath, thirtyOneDaysAgo, thirtyOneDaysAgo);

      // Clean old backups
      const deletedCount = await backupService.cleanOldBackups();

      // Verify file was deleted
      expect(deletedCount).toBe(1);
      expect(fs.existsSync(filepath)).toBe(false);
    });

    it('should not delete backup files newer than 30 days', async () => {
      // Create a backup file
      const filepath = await backupService.createBackup();
      expect(fs.existsSync(filepath)).toBe(true);

      // Clean old backups
      const deletedCount = await backupService.cleanOldBackups();

      // Verify file was not deleted
      expect(deletedCount).toBe(0);
      expect(fs.existsSync(filepath)).toBe(true);
    });
  });

  describe('getBackupFiles', () => {
    it('should return list of backup files', async () => {
      // Create multiple backups
      await backupService.createBackup();
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      await backupService.createBackup();

      // Get backup files
      const files = backupService.getBackupFiles();

      // Verify list
      expect(files.length).toBe(2);
      expect(files[0]).toHaveProperty('filename');
      expect(files[0]).toHaveProperty('filepath');
      expect(files[0]).toHaveProperty('size');
      expect(files[0]).toHaveProperty('created');

      // Verify sorted by date (newest first)
      expect(files[0].created.getTime()).toBeGreaterThanOrEqual(
        files[1].created.getTime()
      );
    });

    it('should return empty array when no backups exist', () => {
      const files = backupService.getBackupFiles();
      expect(files).toEqual([]);
    });
  });

  describe('getLastBackupInfo', () => {
    it('should return info about most recent backup', async () => {
      // Create backup
      await backupService.createBackup();

      // Get last backup info
      const info = backupService.getLastBackupInfo();

      // Verify info
      expect(info).not.toBeNull();
      expect(info).toHaveProperty('filename');
      expect(info).toHaveProperty('created');
      expect(info!.filename).toMatch(/^backup-.*\.json$/);
    });

    it('should return null when no backups exist', () => {
      const info = backupService.getLastBackupInfo();
      expect(info).toBeNull();
    });
  });
});
