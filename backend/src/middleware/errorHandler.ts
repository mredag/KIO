import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/LoggerService.js';
import i18n from '../i18n/config.js';

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error handling middleware
 * Requirements: 32.1 - Backend error handling middleware with user-friendly messages
 */
export const errorHandler = (logger?: LoggerService) => {
  return (err: Error | AppError, req: Request, res: Response, _next: NextFunction) => {
    // Default to 500 server error
    let statusCode = 500;
    let message = i18n.t('errors:unexpectedError');
    let details: any = undefined;

    // Handle known AppError instances
    if (err instanceof AppError) {
      statusCode = err.statusCode;
      message = err.message;
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      statusCode = 400;
      message = i18n.t('errors:validationError');
      details = { validation: err.message };
    }

    // Handle database errors
    if (err.message?.includes('SQLITE_') || err.message?.includes('database')) {
      statusCode = 500;
      message = i18n.t('errors:databaseErrorOccurred');
    }

    // Handle authentication errors
    if (err.message?.includes('Unauthorized') || err.message?.includes('authentication')) {
      statusCode = 401;
      message = i18n.t('errors:authenticationRequired');
    }

    // Handle not found errors
    if (err.message?.includes('not found') || err.message?.includes('Not found')) {
      statusCode = 404;
      message = err.message;
    }

    // Log error to database and console
    if (logger) {
      logger.error(err.message, {
        statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack,
        body: req.body,
        query: req.query,
      });
    } else {
      // Fallback to console logging
      console.error('Error:', {
        message: err.message,
        statusCode,
        path: req.path,
        method: req.method,
        stack: err.stack,
      });
    }

    // Send error response
    res.status(statusCode).json({
      error: message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: i18n.t('errors:routeNotFound', { method: req.method, path: req.path }),
  });
};
