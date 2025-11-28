/**
 * API Key Authentication Middleware Tests
 * 
 * Tests API key authentication for integration endpoints
 * Requirements: 16.2, 16.3
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { apiKeyAuth } from './apiKeyAuth.js';

describe('apiKeyAuth middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.N8N_API_KEY;
    
    // Set test API key
    process.env.N8N_API_KEY = 'test-api-key-12345';

    // Setup mock request, response, and next
    mockReq = {
      headers: {},
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.N8N_API_KEY = originalEnv;
    } else {
      delete process.env.N8N_API_KEY;
    }
  });

  it('should reject request with missing Authorization header', () => {
    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'MISSING_API_KEY',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid Authorization format', () => {
    mockReq.headers = {
      authorization: 'InvalidFormat',
    };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_AUTH_FORMAT',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with wrong token type', () => {
    mockReq.headers = {
      authorization: 'Basic dGVzdDp0ZXN0',
    };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_AUTH_FORMAT',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should reject request with invalid API key', () => {
    mockReq.headers = {
      authorization: 'Bearer wrong-api-key',
    };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_API_KEY',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should accept request with valid API key', () => {
    mockReq.headers = {
      authorization: 'Bearer test-api-key-12345',
    };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockReq.apiClient).toBe('n8n');
  });

  it('should return 500 if N8N_API_KEY is not configured', () => {
    delete process.env.N8N_API_KEY;

    mockReq.headers = {
      authorization: 'Bearer some-key',
    };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'SERVER_MISCONFIGURATION',
        }),
      })
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should attach apiClient identifier for logging', () => {
    mockReq.headers = {
      authorization: 'Bearer test-api-key-12345',
    };

    apiKeyAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockReq.apiClient).toBe('n8n');
    expect(mockNext).toHaveBeenCalled();
  });
});
