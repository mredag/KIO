/**
 * PriceFormatterService — Formats price lists from KB data for mobile-friendly display.
 *
 * Takes raw KB pricing data (pipe-separated format) and formats it beautifully
 * for Instagram/WhatsApp DM display on mobile devices.
 *
 * Key features:
 * - No hardcoded prices — all data from KB
 * - Mobile-optimized layout (emojis, spacing, grouping)
 * - Category-specific templates (massage, membership, courses, etc.)
 * - Preserves all KB data integrity
 */

export interface FormattedPriceList {
  text: string;
  category: string;
  itemCount: number;
}

export class PriceFormatterService {
  /**
   * Format pricing data based on category.
   * Detects category from KB key and applies appropriate template.
   */
  formatPricing(kbKey: string, rawValue: string): FormattedPriceList {
    // Detect category from KB key
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

    // Fallback: generic formatting
    return this.formatGeneric(rawValue);
  }

  /**
   * SPA Massage pricing — most complex, needs clear grouping.
   * Input: "30dk masaj: 800₺ | 30dk masaj + kese + köpük: 900₺ | ..."
   */
  private formatSpaMassage(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['💆 Masaj Fiyatlarımız:', ''];

    // Group by duration
    const groups = this.groupByDuration(items);

    for (const [duration, groupItems] of Object.entries(groups)) {
      lines.push(`${duration}:`);
      for (const item of groupItems) {
        const price = this.extractPrice(item);
        const desc = this.extractDescription(item);
        lines.push(`  ${desc} → ${price}`);
      }
      lines.push(''); // blank line between groups
    }

    // Extract footer note (after last |)
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

  /**
   * Other massage programs (MIX, Hot Stone, Medical).
   * Input: "MIX Masaj (70dk): 2.000₺ | Sıcak Taş (60dk): 1.600₺ | ..."
   */
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

  /**
   * Individual membership pricing.
   * Input: "Ferdi Üyelik: Aylık 3.000 TL | 3 Aylık 7.500 TL | ..."
   */
  private formatMembershipIndividual(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['🏋️ Ferdi Üyelik Fiyatları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const period = this.extractPeriod(item);
      lines.push(`${period} → ${price}`);
    }

    // Extract footer note
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

  /**
   * Family membership pricing.
   */
  private formatMembershipFamily(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['👨‍👩‍👧 Aile Üyeliği Fiyatları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const period = this.extractPeriod(item);
      lines.push(`${period} → ${price}`);
    }

    // Extract footer note
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

  /**
   * Reformer Pilates pricing.
   */
  private formatReformerPilates(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['🧘 Reformer Pilates:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    // Extract footer note
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

  /**
   * Personal Trainer pricing.
   */
  private formatPT(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['💪 Personal Trainer:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    // Extract footer note
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

  /**
   * Kids courses pricing.
   */
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

  /**
   * Women courses pricing.
   */
  private formatWomenCourses(raw: string): FormattedPriceList {
    const items = this.parseItems(raw);
    const lines: string[] = ['👩 Kadın Kursları:', ''];

    for (const item of items) {
      const price = this.extractPrice(item);
      const desc = this.extractDescription(item);
      lines.push(`${desc} → ${price}`);
    }

    // Extract footer note
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

  /**
   * Generic fallback formatting.
   */
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

  // --- Helper methods ---

  /**
   * Parse pipe-separated items.
   * Handles: "item1 | item2 | item3. Footer note"
   */
  private parseItems(raw: string): string[] {
    // Split by | but preserve text after last period (footer)
    const mainPart = raw.split(/\.\s+[A-Z]/).shift() || raw;
    return mainPart.split('|').map(s => s.trim()).filter(Boolean);
  }

  /**
   * Extract price from item (supports ₺, TL, both).
   */
  private extractPrice(item: string): string {
    const match = item.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*(?:₺|TL)/i);
    return match ? match[0] : '';
  }

  /**
   * Extract description (everything before the colon or price).
   */
  private extractDescription(item: string): string {
    // Remove price part
    const withoutPrice = item.replace(/:\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*(?:₺|TL)/i, '');
    return withoutPrice.trim();
  }

  /**
   * Extract period (Aylık, 3 Aylık, Yıllık, etc.).
   */
  private extractPeriod(item: string): string {
    const match = item.match(/(Aylık|3 Aylık|6 Aylık|Yıllık|Tek ders|Tek seans)/i);
    return match ? match[1] : this.extractDescription(item);
  }

  /**
   * Extract course name (Taekwondo, Jimnastik, etc.).
   */
  private extractCourseName(item: string): string {
    const match = item.match(/^([^:]+):/);
    return match ? match[1].trim() : this.extractDescription(item);
  }

  /**
   * Group massage items by duration (30dk, 40dk, 60dk, 90dk, Kese).
   */
  private groupByDuration(items: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};

    for (const item of items) {
      let duration = '30dk';
      if (item.includes('40dk')) duration = '40dk';
      else if (item.includes('60dk')) duration = '60dk';
      else if (item.includes('90dk')) duration = '90dk';
      else if (item.toLowerCase().includes('kese')) duration = 'Kese Köpük';

      if (!groups[duration]) groups[duration] = [];
      groups[duration].push(item);
    }

    return groups;
  }
}

