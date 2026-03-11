import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { UserBlockService } from './UserBlockService.js';

describe('UserBlockService', () => {
  it('marks permanent blocks as permanent during block checks', () => {
    const db = new Database(':memory:');
    const service = new UserBlockService(db);

    service.permanentBlock('instagram', 'ig-hard-ban', 'Explicit abuse');
    const result = service.checkBlock('instagram', 'ig-hard-ban');

    expect(result.isBlocked).toBe(true);
    expect(result.isPermanent).toBe(true);
    expect(result.reason).toBe('Explicit abuse');
  });

  it('keeps ordinary temporary blocks non-permanent', () => {
    const db = new Database(':memory:');
    const service = new UserBlockService(db);

    service.blockUser('instagram', 'ig-temp-ban', 'Temporary block');
    const result = service.checkBlock('instagram', 'ig-temp-ban');

    expect(result.isBlocked).toBe(true);
    expect(result.isPermanent).toBe(false);
    expect(result.blockCount).toBe(1);
  });
});
