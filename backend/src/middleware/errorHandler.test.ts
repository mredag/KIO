import { describe, expect, it, vi } from 'vitest';

import { errorHandler } from './errorHandler.js';

describe('errorHandler', () => {
  it('returns 404 for missing upload files', () => {
    const handler = errorHandler();
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const req = {
      path: '/uploads/missing.mp4',
      method: 'GET',
      body: {},
      query: {},
    };
    const err = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' });

    handler(err, req as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Media not found',
      })
    );
  });
});
