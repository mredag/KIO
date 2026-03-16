import type { Massage } from '../database/types.js';

/**
 * Kiosk clients are intentionally media-free. The live kiosk experience should
 * never depend on uploaded images/videos or on filesystem state.
 */
export class KioskMediaSanitizer {
  sanitizeMassage(massage: Massage): Massage {
    if (!massage.media_type && !massage.media_url) {
      return massage;
    }

    return {
      ...massage,
      media_type: null,
      media_url: null,
    };
  }

  sanitizeMassages(massages: Massage[]): Massage[] {
    return massages.map((massage) => this.sanitizeMassage(massage));
  }
}
