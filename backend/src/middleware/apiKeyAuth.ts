import { Request, Response, NextFunction } from 'express';
import i18n from '../i18n/config.js';

/**
 * Extend Express Request to include apiClient information
 */
declare global {
  namespace Express {
    interface Request {
      apiClient?: string;
    }
  }
}

/**
 * API Key authentication middleware for integration endpoints
 * Verifies Bearer token in Authorization header matches N8N_API_KEY
 * Requirements: 16.2, 16.3
 */
export function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  // Check if Authorization header exists
  if (!authHeader) {
    res.status(401).json({
      error: {
        code: 'MISSING_API_KEY',
        message: i18n.t('errors:missingApiKey', {
          defaultValue: 'Missing API key',
        }),
      },
    });
    return;
  }

  // Check if it's a Bearer token
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      error: {
        code: 'INVALID_AUTH_FORMAT',
        message: i18n.t('errors:invalidAuthFormat', {
          defaultValue: 'Invalid authorization format. Expected: Bearer <token>',
        }),
      },
    });
    return;
  }

  const token = parts[1];
  const expectedApiKey = process.env.N8N_API_KEY;

  // Check if N8N_API_KEY is configured
  if (!expectedApiKey) {
    console.error('N8N_API_KEY is not configured in environment variables');
    res.status(500).json({
      error: {
        code: 'SERVER_MISCONFIGURATION',
        message: i18n.t('errors:serverError', {
          defaultValue: 'Internal server error',
        }),
      },
    });
    return;
  }

  // Verify token matches expected API key
  if (token !== expectedApiKey) {
    res.status(401).json({
      error: {
        code: 'INVALID_API_KEY',
        message: i18n.t('errors:invalidApiKey', {
          defaultValue: 'Invalid API key',
        }),
      },
    });
    return;
  }

  // Attach apiClient identifier for logging
  req.apiClient = 'n8n';

  // Authentication successful
  next();
}
