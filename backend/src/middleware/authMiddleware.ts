import { Request, Response, NextFunction } from 'express';
import i18n from '../i18n/config.js';

/**
 * Extend Express Session to include user information
 */
declare module 'express-session' {
  interface SessionData {
    user?: {
      username: string;
    };
  }
}

/**
 * Authentication middleware to protect admin routes
 * Verifies that user has valid session
 * Requirements: 12.4
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.session && req.session.user) {
    // User is authenticated
    next();
  } else {
    // User is not authenticated
    res.status(401).json({ error: i18n.t('errors:unauthorizedLogin') });
  }
}
