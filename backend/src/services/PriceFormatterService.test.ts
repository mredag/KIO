import { describe, expect, it } from 'vitest';
import { PriceFormatterService } from './PriceFormatterService.js';

describe('PriceFormatterService', () => {
  const service = new PriceFormatterService();
  const arrow = '\u2192';

  it('preserves 4-digit membership prices in multiline KB blocks', () => {
    const result = service.formatPricing(
      'membership_individual',
      [
        'Ferdi Uyelik (Tum Tesis):',
        '',
        '1 Aylik -> 3500 TL',
        '3 Aylik -> 7500 TL',
        '6 Aylik -> 13000 TL',
        'Yillik -> 20000 TL',
      ].join('\n'),
    );

    expect(result.text).toContain(`1 Aylik ${arrow} 3500 TL`);
    expect(result.text).toContain(`3 Aylik ${arrow} 7500 TL`);
    expect(result.text).not.toContain(`1 Aylik ${arrow} 500 TL`);
    expect(result.text).not.toContain(`3 Aylik ${arrow} 500 TL`);
  });

  it('preserves 4-digit single-line prices without truncating to trailing digits', () => {
    const result = service.formatPricing(
      'reformer_pilates',
      'Reformer Pilates: 3500 TL/ay (Haftada 2 gun)',
    );

    expect(result.text).toContain('3500 TL');
    expect(result.text).not.toContain(`${arrow} 500 TL`);
  });

  it('removes shared headings from pipe-separated course entries', () => {
    const result = service.formatPricing(
      'courses_kids',
      'Cocuk Kurslari: Taekwondo aylik 2000 TL | Jimnastik aylik 2000 TL | Yuzme aylik 2500 TL',
    );

    expect(result.text).toContain(`Taekwondo ${arrow} 2000 TL`);
    expect(result.text).toContain(`Jimnastik ${arrow} 2000 TL`);
    expect(result.text).toContain(`Yuzme ${arrow} 2500 TL`);
    expect(result.text).not.toContain(`Cocuk Kurslari ${arrow}`);
  });
});
