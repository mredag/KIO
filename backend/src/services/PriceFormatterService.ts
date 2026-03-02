/**
 * PriceFormatterService formats KB pricing data for DM responses.
 *
 * It supports both the original pipe-separated seed format and the newer
 * multiline KB blocks that are already structured with arrows/newlines.
 */

export interface FormattedPriceList {
  text: string;
  category: string;
  itemCount: number;
}

export class PriceFormatterService {
  /**
   * Format pricing data based on category.
   */
  formatPricing(kbKey: string, rawValue: string): FormattedPriceList {
    if (kbKey.includes('spa_massage')) {
      return this.formatSpaMassage(rawValue);
    }
    if (kbKey.includes('other_massage')) {
      return this.formatOtherMassage(rawValue);
    }
    if (kbKey.includes('membership_individual')) {
      return this.formatMembershipIndividual(rawValue);
    }
    if (kbKey.includes('membership_family')) {
      return this.formatMembershipFamily(rawValue);
    }
    if (kbKey.includes('reformer_pilates')) {
      return this.formatReformerPilates(rawValue);
    }
    if (kbKey.includes('pt_pricing')) {
      return this.formatPT(rawValue);
    }
    if (kbKey.includes('courses_kids')) {
      return this.formatKidsCourses(rawValue);
    }
    if (kbKey.includes('courses_women')) {
      return this.formatWomenCourses(rawValue);
    }

    return this.formatGeneric(rawValue);
  }

  private formatSpaMassage(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['💆 Masaj Fiyatlarımız:', ''];

    const groups = this.groupByDuration(items);

    for (const [duration, groupItems] of Object.entries(groups)) {
      lines.push(`${duration}:`);
      for (const item of groupItems) {
        const price = this.extractPrice(item);
        const desc = this.extractDescription(item);
        lines.push(`  ${desc} → ${price}`);
      }
      lines.push('');
    }

    const footerMatch = raw.match(/\.\s*(.+)$/);
    if (footerMatch) {
      lines.push(`ℹ️ ${footerMatch[1]}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'spa_massage',
      itemCount: items.length,
    };
  }

  private formatOtherMassage(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['🌟 Özel Masaj Programları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'other_massage',
      itemCount: items.length,
    };
  }

  private formatMembershipIndividual(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['🏋️ Ferdi Üyelik Fiyatları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const period = this.extractPeriod(item);
      lines.push(`${period} → ${price}`);
    }

    const footerMatch = raw.match(/\.\s*(.+)$/);
    if (footerMatch) {
      lines.push('');
      lines.push(`✓ ${footerMatch[1]}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'membership_individual',
      itemCount: items.length,
    };
  }

  private formatMembershipFamily(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['👨‍👩‍👧 Aile Üyeliği Fiyatları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const period = this.extractPeriod(item);
      lines.push(`${period} → ${price}`);
    }

    const footerMatch = raw.match(/\.\s*(.+)$/);
    if (footerMatch) {
      lines.push('');
      lines.push(`ℹ️ ${footerMatch[1]}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'membership_family',
      itemCount: items.length,
    };
  }

  private formatReformerPilates(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['🧘 Reformer Pilates:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    const footerMatch = raw.match(/\.\s*(.+)$/);
    if (footerMatch) {
      lines.push('');
      lines.push(`ℹ️ ${footerMatch[1]}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'reformer_pilates',
      itemCount: items.length,
    };
  }

  private formatPT(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['💪 Personal Trainer:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    const footerMatch = raw.match(/\.\s*(.+)$/);
    if (footerMatch) {
      lines.push('');
      lines.push(`✓ ${footerMatch[1]}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'pt_pricing',
      itemCount: items.length,
    };
  }

  private formatKidsCourses(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['👶 Çocuk Kursları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const course = this.extractCourseName(item);
      lines.push(`${course} → ${price}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'courses_kids',
      itemCount: items.length,
    };
  }

  private formatWomenCourses(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['👩 Kadın Kursları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    const footerMatch = raw.match(/\.\s*(.+)$/);
    if (footerMatch) {
      lines.push('');
      lines.push(`ℹ️ ${footerMatch[1]}`);
    }

    return {
      text: lines.join('\n').trim(),
      category: 'courses_women',
      itemCount: items.length,
    };
  }

  private formatGeneric(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = [];

    for (const item of items) {
      lines.push(item.trim());
    }

    return {
      text: lines.join('\n'),
      category: 'generic',
      itemCount: items.length,
    };
  }

  private parseItems(raw: string): string[] {
    const normalized = raw.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    if (normalized.includes('|')) {
      const parts = normalized
        .split('|')
        .map(part => part.trim())
        .filter(Boolean);

      if (parts.length > 1 && /^[^:\n]{1,60}:\s+.+/.test(parts[0])) {
        const first = parts[0];
        const separatorIndex = first.indexOf(':');
        const remainder = first.slice(separatorIndex + 1).trim();
        if (remainder) {
          parts[0] = remainder;
        }
      }

      return parts;
    }

    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const pricedLines = lines.filter(line => /(?:[:\u2192]|->).*(?:\u20BA|TL)/i.test(line));
    if (pricedLines.length > 0) {
      return pricedLines;
    }

    return [normalized];
  }

  private extractPrice(item: string): string {
    const match = item.match(/(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:\u20BA|TL)/i);
    return match ? match[0] : '';
  }

  private extractDescription(item: string): string {
    const withoutPrice = item.replace(
      /(?:[:\u2192]|->)\s*\d+(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:\u20BA|TL)(?:\s*\/\S+)?/i,
      '',
    );
    return withoutPrice.trim();
  }

  private extractPeriod(item: string): string {
    const match = item.match(/(\d+\s*Ayl[ıi]k|Ayl[ıi]k|Y[ıi]ll[ıi]k|Tek ders|Tek seans)/i);
    return match ? match[1] : this.extractDescription(item);
  }

  private extractCourseName(item: string): string {
    const match = item.match(/^([^:]+):/);
    if (match) {
      return match[1].trim();
    }

    const withoutPrice = item
      .replace(/\d+(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:\u20BA|TL).*/i, '')
      .replace(/\b(?:aylık|aylik|tek ders|tek seans)\b/gi, '')
      .trim();

    return withoutPrice || this.extractDescription(item);
  }

  private groupByDuration(items: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    for (const item of items) {
      let duration = '30dk';
      if (item.includes('40dk')) duration = '40dk';
      else if (item.includes('60dk')) duration = '60dk';
      else if (item.includes('90dk')) duration = '90dk';
      else if (item.toLowerCase().includes('kese')) duration = 'Kese Köpük';

      if (!groups[duration]) {
        groups[duration] = [];
      }
      groups[duration].push(item);
    }

    return groups;
  }
}
