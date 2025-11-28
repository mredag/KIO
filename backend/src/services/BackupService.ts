import { DatabaseService } from '../database/DatabaseService.js';
import * as fs from 'fs';
import * as path from 'path';
import * as cron from 'node-cron';

/**
 * BackupService class for managing database backups
 * Handles daily automated backups and manual backup triggers
 */
export class BackupService {
  private backupDir: string;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(private db: DatabaseService, backupDir: string = './data/backups') {
    this.backupDir = backupDir;
    this.ensureBackupDirectory();
  }

  /**
   * Ensure backup directory exists
   */
  private ensureBackupDirectory(): void {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of all database tables
   * Exports to JSON format with timestamp
   * @returns Path to the created backup file
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    try {
      // Export all tables to JSON
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          massages: this.db.getMassages(),
          survey_templates: this.db.getSurveyTemplates(),
          survey_responses: this.db.getSurveyResponses(),
          kiosk_state: this.db.getKioskState(),
          system_settings: this.db.getSettings(),
          coupon_tokens: this.db.getAllCouponTokens(),
          coupon_wallets: this.db.getAllCouponWallets(),
          coupon_redemptions: this.db.getAllCouponRedemptions(),
          coupon_events: this.db.getAllCouponEvents(),
          coupon_rate_limits: this.db.getAllCouponRateLimits(),
        },
      };

      // Write to file
      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2), 'utf-8');

      // Log the backup creation
      this.db.createLog({
        level: 'info',
        message: 'Database backup created',
        details: { filename, filepath },
      });

      return filepath;
    } catch (error) {
      // Log the error
      this.db.createLog({
        level: 'error',
        message: 'Failed to create database backup',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  /**
   * Schedule daily backups at 2 AM Istanbul time
   */
  scheduleDaily(): void {
    // Stop existing cron job if any
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Schedule backup at 2:00 AM Istanbul time daily
    // Cron format: minute hour day month weekday
    // Note: node-cron uses system timezone, ensure TZ=Europe/Istanbul is set
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      try {
        await this.createBackup();
        await this.cleanOldBackups();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    }, {
      timezone: 'Europe/Istanbul'
    });

    this.db.createLog({
      level: 'info',
      message: 'Daily backup schedule initialized',
      details: { schedule: '2:00 AM Istanbul time daily' },
    });
  }

  /**
   * Clean up old backup files (older than 30 days)
   */
  async cleanOldBackups(): Promise<number> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    try {
      const files = fs.readdirSync(this.backupDir);

      for (const file of files) {
        if (file.startsWith('backup-') && file.endsWith('.json')) {
          const filepath = path.join(this.backupDir, file);
          const stats = fs.statSync(filepath);

          if (stats.mtimeMs < thirtyDaysAgo) {
            fs.unlinkSync(filepath);
            deletedCount++;
          }
        }
      }

      if (deletedCount > 0) {
        this.db.createLog({
          level: 'info',
          message: 'Old backup files cleaned',
          details: { deletedCount },
        });
      }

      return deletedCount;
    } catch (error) {
      this.db.createLog({
        level: 'error',
        message: 'Failed to clean old backup files',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  /**
   * Get list of available backup files
   */
  getBackupFiles(): Array<{ filename: string; filepath: string; size: number; created: Date }> {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backupFiles = files
        .filter((file) => file.startsWith('backup-') && file.endsWith('.json'))
        .map((file) => {
          const filepath = path.join(this.backupDir, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            filepath,
            size: stats.size,
            created: stats.mtime,
          };
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime());

      return backupFiles;
    } catch (error) {
      this.db.createLog({
        level: 'error',
        message: 'Failed to list backup files',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      return [];
    }
  }

  /**
   * Get the most recent backup file info
   */
  getLastBackupInfo(): { filename: string; created: Date } | null {
    const files = this.getBackupFiles();
    return files.length > 0 ? { filename: files[0].filename, created: files[0].created } : null;
  }

  /**
   * Stop the scheduled backup job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }
}
