import { describe, expect, it } from 'vitest';

import { KioskMediaSanitizer } from './KioskMediaSanitizer.js';

describe('KioskMediaSanitizer', () => {
  it('leaves already media-free massages unchanged', () => {
    const sanitizer = new KioskMediaSanitizer();
    const massage = {
      id: '1',
      name: 'Test',
      short_description: 'Short',
      long_description: 'Long',
      duration: '60 dk',
      media_type: null,
      media_url: null,
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

  it('strips uploaded or external media before kiosk clients see it', () => {
    const sanitizer = new KioskMediaSanitizer();
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

    expect(sanitizer.sanitizeMassage(massage)).toMatchObject({
      media_type: null,
      media_url: null,
    });
  });
});
