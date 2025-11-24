import { DatabaseService } from '../database/DatabaseService.js';
import { SystemLogInput } from '../database/types.js';

/**
 * LoggerService for structured logging with database persistence
 * Requirements: 32.1 - Structured logging with levels
 */
export class LoggerService {
  private dbService: DatabaseService;

  constructor(dbService: DatabaseService) {
    this.dbService = dbService;
  }

  /**
   * Log an info message
   */
  info(message: string, details?: Record<string, any>): void {
    this.log('info', message, details);
  }

  /**
   * Log a warning message
   */
  warn(message: string, details?: Record<string, any>): void {
    this.log('warn', message, details);
  }

  /**
   * Log an error message
   */
  error(message: string, details?: Record<string, any>): void {
    this.log('error', message, details);
  }

  /**
   * Log an error object
   */
  logError(error: Error, context?: string): void {
    this.log('error', context || error.message, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  /**
   * Internal log method
   */
  private log(level: 'info' | 'warn' | 'error', message: string, details?: Record<string, any>): void {
    try {
      // Log to console
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
      
      if (level === 'error') {
        console.error(logMessage, details || '');
      } else if (level === 'warn') {
        console.warn(logMessage, details || '');
      } else {
        console.log(logMessage, details || '');
      }

      // Log to database
      const logInput: SystemLogInput = {
        level,
        message,
        details,
      };
      
      this.dbService.createLog(logInput);
    } catch (err) {
      // Fallback to console if database logging fails
      console.error('Failed to write log to database:', err);
    }
  }
}
