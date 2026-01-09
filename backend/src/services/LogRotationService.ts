import cron from 'node-cron';
import { DatabaseService } from '../database/DatabaseService.js';

/**
 * LogRotationService for cleaning up old log entries
 * Requirements: 32.1 - Log rotation to prevent database bloat
 */
export class LogRotationService {
  private dbService: DatabaseService;
  private retentionDays: number;

  constructor(dbService: DatabaseService, retentionDays: number = 30) {
    this.dbService = dbService;
    this.retentionDays = retentionDays;
  }

  /**
   * Delete logs older than retention period
   */
  rotateLogs(): number {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      const cutoffDateStr = cutoffDate.toISOString();

      const result = this.dbService.transaction(() => {
        const stmt = this.dbService['db'].prepare(
          'DELETE FROM system_logs WHERE created_at < ?'
        );
        return stmt.run(cutoffDateStr);
      });

      const deletedCount = result.changes;
      
      if (deletedCount > 0) {
        console.log(`Log rotation: Deleted ${deletedCount} old log entries`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to rotate logs:', error);
      return 0;
    }
  }

  /**
   * Schedule daily log rotation at 2 AM
   */
  scheduleRotation(): void {
    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', () => {
      console.log('Running scheduled log rotation...');
      this.rotateLogs();
    });

    console.log(`Log rotation scheduled: Daily at 2:00 AM (retention: ${this.retentionDays} days)`);
  }

  /**
   * Get current log count
   */
  getLogCount(): number {
    const result = this.dbService['db']
      .prepare('SELECT COUNT(*) as count FROM system_logs')
      .get() as any;
    
    return result.count;
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    total: number;
    byLevel: { info: number; warn: number; error: number };
    oldestLog: string | null;
    newestLog: string | null;
  } {
    const total = this.getLogCount();
    
    const byLevel = this.dbService['db']
      .prepare('SELECT level, COUNT(*) as count FROM system_logs GROUP BY level')
      .all() as any[];
    
    const levelCounts = {
      info: 0,
      warn: 0,
      error: 0,
    };
    
    byLevel.forEach((row) => {
      levelCounts[row.level as keyof typeof levelCounts] = row.count;
    });

    const oldest = this.dbService['db']
      .prepare('SELECT created_at FROM system_logs ORDER BY created_at ASC LIMIT 1')
      .get() as any;
    
    const newest = this.dbService['db']
      .prepare('SELECT created_at FROM system_logs ORDER BY created_at DESC LIMIT 1')
      .get() as any;

    return {
      total,
      byLevel: levelCounts,
      oldestLog: oldest?.created_at || null,
      newestLog: newest?.created_at || null,
    };
  }
}
