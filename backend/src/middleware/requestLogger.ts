import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/LoggerService.js';

/**
 * Request logging middleware
 * Requirements: 32.1 - Request logging for debugging and monitoring
 */
export const requestLogger = (logger: LoggerService) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Log request
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    // Log response when finished
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const level = res.statusCode >= 400 ? 'warn' : 'info';
      
      logger[level](`${req.method} ${req.path} - ${res.statusCode}`, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    });

    next();
  };
};
