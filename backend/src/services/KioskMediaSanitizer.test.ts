import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { KioskMediaSanitizer } from './KioskMediaSanitizer.js';

const tempDirs: string[] = [];

function createUploadsDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kio-uploads-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('KioskMediaSanitizer', () => {
  it('keeps non-upload media urls unchanged', () => {
    const sanitizer = new KioskMediaSanitizer(createUploadsDir());
    const massage = {
      id: '1',
      name: 'Test',
      short_description: 'Short',
      long_description: 'Long',
      duration: '60 dk',
      media_type: 'photo',
      media_url: 'https://example.com/image.jpg',
      purpose_tags: [],
      sessions: [],
      is_featured: 0,
      is_campaign: 0,
      layout_template: 'price-list',
      sort_order: 1,
      created_at: '2026-03-16T00:00:00.000Z',
      updated_at: '2026-03-16T00:00:00.000Z',
    };

    expect(sanitizer.sanitizeMassage(massage)).toEqual(massage);
  });

  it('clears missing upload urls before kiosk clients see them', () => {
    const sanitizer = new KioskMediaSanitizer(createUploadsDir());
    const massage = {
      id: '1',
      name: 'Test',
      short_description: 'Short',
      long_description: 'Long',
      duration: '60 dk',
      media_type: 'video',
      media_url: '/uploads/missing.mp4',
      purpose_tags: [],
      sessions: [],
      is_featured: 1,
      is_campaign: 0,
      layout_template: 'price-list',
      sort_order: 1,
      created_at: '2026-03-16T00:00:00.000Z',
      updated_at: '2026-03-16T00:00:00.000Z',
    };

    expect(sanitizer.sanitizeMassage(massage)).toMatchObject({ media_url: null });
  });

  it('keeps upload urls when the file still exists', () => {
    const uploadsDir = createUploadsDir();
    fs.writeFileSync(path.join(uploadsDir, 'existing.mp4'), 'video');
    const sanitizer = new KioskMediaSanitizer(uploadsDir);
    const massage = {
      id: '1',
      name: 'Test',
      short_description: 'Short',
      long_description: 'Long',
      duration: '60 dk',
      media_type: 'video',
      media_url: '/uploads/existing.mp4',
      purpose_tags: [],
      sessions: [],
      is_featured: 1,
      is_campaign: 0,
      layout_template: 'price-list',
      sort_order: 1,
      created_at: '2026-03-16T00:00:00.000Z',
      updated_at: '2026-03-16T00:00:00.000Z',
    };

    expect(sanitizer.sanitizeMassage(massage)).toEqual(massage);
  });
});
