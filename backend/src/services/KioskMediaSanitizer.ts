import fs from 'fs';
import path from 'path';

import type { Massage } from '../database/types.js';

export class KioskMediaSanitizer {
  constructor(private readonly uploadsDir: string) {}

  sanitizeMassage(massage: Massage): Massage {
    if (!this.isManagedUpload(massage.media_url)) {
      return massage;
    }

    const filename = path.basename(massage.media_url as string);
    const absolutePath = path.join(this.uploadsDir, filename);

    if (fs.existsSync(absolutePath)) {
      return massage;
    }

    return {
      ...massage,
      media_url: null,
    };
  }

  sanitizeMassages(massages: Massage[]): Massage[] {
    return massages.map((massage) => this.sanitizeMassage(massage));
  }

  private isManagedUpload(mediaUrl: string | null | undefined): boolean {
    return typeof mediaUrl === 'string' && mediaUrl.startsWith('/uploads/');
  }
}
