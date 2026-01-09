import cron from 'node-cron';
import { DatabaseService } from '../database/DatabaseService.js';
import { GoogleSheetsService } from './GoogleSheetsService.js';
import { SurveyResponse } from '../database/types.js';

/**
 * SyncQueueService manages the background synchronization of survey responses
 * to Google Sheets with exponential backoff retry strategy
 */
export class SyncQueueService {
  private db: DatabaseService;
  private sheets: GoogleSheetsService;
  private cronJob: cron.ScheduledTask | null = null;
  private isProcessing = false;

  constructor(db: DatabaseService, sheets: GoogleSheetsService) {
    this.db = db;
    this.sheets = sheets;
  }

  /**
   * Process the sync queue - fetch unsynced responses and attempt to sync them
   * Implements exponential backoff retry strategy:
   * - Attempt 1: Retry in 5 min
   * - Attempt 2: Retry in 10 min
   * - Attempt 3: Retry in 20 min
   * - Attempt 4+: Retry in 30 min
   */
  async processQueue(): Promise<void> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('Sync queue processing already in progress, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Check if Google Sheets is initialized
      if (!this.sheets.isReady()) {
        console.log('Google Sheets service not initialized, skipping sync');
        this.db.createLog({
          level: 'info',
          message: 'Sync queue skipped - Google Sheets not configured',
        });
        return;
      }

      // Get system settings for sheet configuration
      const settings = this.db.getSettings();

      if (!settings.sheets_sheet_id || !settings.sheets_sheet_name) {
        console.log('Google Sheets not configured, skipping sync');
        return;
      }

      // Get unsynced responses
      const unsyncedResponses = this.db.getSurveyResponses({ synced: false });

      if (unsyncedResponses.length === 0) {
        console.log('No unsynced responses to process');
        return;
      }

      console.log(`Processing ${unsyncedResponses.length} unsynced responses`);

      let successCount = 0;
      let failureCount = 0;

      for (const response of unsyncedResponses) {
        // Check if we should retry based on exponential backoff
        if (!this.shouldRetry(response)) {
          continue;
        }

        try {
          // Prepare row data for Google Sheets
          const rowData = this.prepareRowData(response);

          // Attempt to append to Google Sheets
          await this.sheets.appendRow(
            settings.sheets_sheet_id,
            settings.sheets_sheet_name,
            rowData
          );

          // Mark as synced on success
          this.db.updateSurveyResponseSyncStatus(response.id, true);
          successCount++;

          console.log(`Successfully synced response ${response.id}`);
        } catch (error) {
          // Increment sync attempts on failure
          this.db.updateSurveyResponseSyncStatus(response.id, false, true);
          failureCount++;

          console.error(
            `Failed to sync response ${response.id}:`,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      // Log sync results
      this.db.createLog({
        level: 'info',
        message: 'Sync queue processing completed',
        details: {
          total: unsyncedResponses.length,
          success: successCount,
          failed: failureCount,
        },
      });

      console.log(
        `Sync completed: ${successCount} succeeded, ${failureCount} failed`
      );
    } catch (error) {
      console.error('Error processing sync queue:', error);
      this.db.createLog({
        level: 'error',
        message: 'Sync queue processing error',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Determine if a response should be retried based on exponential backoff
   * @param response - The survey response to check
   * @returns true if should retry, false otherwise
   */
  private shouldRetry(response: SurveyResponse): boolean {
    // Always try if never attempted
    if (response.sync_attempts === 0) {
      return true;
    }

    // If no last attempt timestamp, retry
    if (!response.last_sync_attempt) {
      return true;
    }

    // Calculate backoff delay based on attempt count
    const backoffMinutes = this.getBackoffDelay(response.sync_attempts);
    const lastAttemptTime = new Date(response.last_sync_attempt).getTime();
    const now = Date.now();
    const minutesSinceLastAttempt = (now - lastAttemptTime) / (1000 * 60);

    return minutesSinceLastAttempt >= backoffMinutes;
  }

  /**
   * Get the backoff delay in minutes based on attempt count
   * - Attempt 1: 5 minutes
   * - Attempt 2: 10 minutes
   * - Attempt 3: 20 minutes
   * - Attempt 4+: 30 minutes (max)
   */
  private getBackoffDelay(attempts: number): number {
    switch (attempts) {
      case 1:
        return 5;
      case 2:
        return 10;
      case 3:
        return 20;
      default:
        return 30; // Max backoff
    }
  }

  /**
   * Prepare survey response data for Google Sheets row
   * @param response - The survey response to format
   * @returns Array of values for the row
   */
  private prepareRowData(response: SurveyResponse): any[] {
    // Get survey template to understand the structure
    const survey = this.db.getSurveyById(response.survey_id);

    // Translate survey type to Turkish
    const surveyType = survey?.type === 'satisfaction' ? 'Memnuniyet' : 'Keşif';

    const rowData: any[] = [
      response.created_at, // Timestamp first for easy sorting
      survey?.title || 'Bilinmeyen Anket', // Turkish title instead of internal name
      surveyType, // Turkish type
    ];

    // Add question and answer pairs for better readability
    if (survey && survey.questions) {
      for (const question of survey.questions) {
        const answer = response.answers[question.id];
        // Add question text as column header context
        rowData.push(question.text);
        // Add the actual answer
        rowData.push(answer !== undefined ? answer : '');
      }
    } else {
      // Fallback: add all answers as JSON
      rowData.push(JSON.stringify(response.answers));
    }

    return rowData;
  }

  /**
   * Schedule the sync queue to run every 5 minutes using cron
   */
  scheduleSync(): void {
    if (this.cronJob) {
      console.log('Sync queue already scheduled');
      return;
    }

    // Run every 5 minutes: */5 * * * *
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      console.log('Running scheduled sync queue processing...');
      await this.processQueue();
    });

    console.log('Sync queue scheduled to run every 5 minutes');

    // Also run immediately on startup
    setTimeout(() => {
      console.log('Running initial sync queue processing...');
      this.processQueue().catch((error) => {
        console.error('Initial sync queue processing failed:', error);
      });
    }, 5000); // Wait 5 seconds after startup
  }

  /**
   * Stop the scheduled sync job
   */
  stopSync(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Sync queue scheduling stopped');
    }
  }

  /**
   * Get the current sync queue status
   */
  getQueueStatus(): {
    pendingCount: number;
    isProcessing: boolean;
  } {
    const unsyncedResponses = this.db.getSurveyResponses({ synced: false });
    return {
      pendingCount: unsyncedResponses.length,
      isProcessing: this.isProcessing,
    };
  }
}
