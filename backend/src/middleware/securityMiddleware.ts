import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

/**
 * Security middleware configuration using helmet
 * Adds various security headers to protect against common vulnerabilities
 * Requirements: 33.1 - Add security headers
 */

/**
 * Configure helmet with appropriate security headers
 * Customized for the kiosk application needs
 */
export const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
      imgSrc: ["'self'", 'data:', 'blob:'], // Allow data URIs for QR codes
      mediaSrc: ["'self'", 'blob:'], // Allow media from uploads
      connectSrc: ["'self'"], // API calls to same origin
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameSrc: ["'self'"], // Allow iframes from same origin
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  
  // Disable COOP for HTTP (only works with HTTPS)
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  
  // X-DNS-Prefetch-Control: Controls browser DNS prefetching
  dnsPrefetchControl: { allow: false },
  
  // X-Frame-Options: Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // Strict-Transport-Security: Force HTTPS (only in production)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  
  // X-Download-Options: Prevent IE from executing downloads
  ieNoOpen: true,
  
  // X-Content-Type-Options: Prevent MIME sniffing
  noSniff: true,
  
  // X-Permitted-Cross-Domain-Policies: Restrict Adobe Flash/PDF
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  
  // Referrer-Policy: Control referrer information
  referrerPolicy: { policy: 'no-referrer' },
  
  // X-XSS-Protection: Enable XSS filter (legacy browsers)
  xssFilter: true,
});

/**
 * Additional custom security headers
 */
export function additionalSecurityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  // Prevent caching of sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
}

/**
 * CORS configuration for the application
 * Requirements: 33.1 - Implement CORS configuration
 */
export const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    // In production, allow same-origin requests (frontend served from same server)
    if (process.env.NODE_ENV === 'production') {
      // Allow any origin that matches the backend port (same-origin)
      const backendPort = process.env.PORT || '3001';
      if (origin.includes(`:${backendPort}`)) {
        callback(null, true);
        return;
      }
    }
    
    // In development, allow localhost with any port
    if (process.env.NODE_ENV !== 'production') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
        return;
      }
    }
    
    // Fallback allowed origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies/sessions
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition'], // For file downloads
  maxAge: 86400, // 24 hours
};

/**
 * Secure session configuration
 * Requirements: 33.1 - Set up secure session configuration
 */
export const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'spa-kiosk-secret-change-in-production',
  name: 'sessionId', // Don't use default 'connect.sid'
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true, // Prevent XSS access to cookie
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' as const, // CSRF protection
    domain: undefined, // Use default (current domain)
    path: '/', // Cookie available for all paths
  },
  rolling: true, // Reset expiration on each request
  proxy: process.env.NODE_ENV === 'production', // Trust proxy in production
};

/**
 * File upload security configuration
 * Requirements: 33.1 - Configure file upload restrictions, 4.3
 */
export const fileUploadLimits = {
  fileSize: 50 * 1024 * 1024, // 50MB max (for videos)
  files: 1, // Only one file at a time
  fields: 10, // Max number of non-file fields
  parts: 20, // Max number of parts (fields + files)
};

/**
 * Allowed file types for upload
 * Requirements: 4.3
 */
export const allowedMimeTypes = {
  video: ['video/mp4'],
  image: ['image/jpeg', 'image/png'],
};

export const allowedExtensions = ['.mp4', '.jpg', '.jpeg', '.png'];

/**
 * Request size limits
 */
export const requestLimits = {
  json: '10mb', // JSON body limit
  urlencoded: '10mb', // URL-encoded body limit
};
