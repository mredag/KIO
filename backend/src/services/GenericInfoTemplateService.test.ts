import { describe, expect, it } from 'vitest';
import { formatMassagePricingTemplate } from './GenericInfoTemplateService.js';

describe('GenericInfoTemplateService', () => {
  it('adds masaj label to all duration-based massage pricing rows', () => {
    const result = formatMassagePricingTemplate(
      [
        'KLASIK MASAJ:',
        '\u2022 30dk \u2192 800\u20ba',
        '\u2022 40dk \u2192 1000\u20ba',
        '\u2022 30dk+kese kopuk \u2192 900\u20ba',
        '\u2022 MIX 70dk (7 teknik) \u2192 2000\u20ba',
        '\u2022 Sicak Tas 60dk \u2192 1600\u20ba',
        '\u2022 Medikal 30dk \u2192 1200\u20ba',
        '\u2022 Kese ekleme \u2192 +100\u20ba',
      ].join('\n'),
    );

    expect(result).toContain('\u2022 30dk masaj \u2192 800\u20ba');
    expect(result).toContain('\u2022 40dk masaj \u2192 1000\u20ba');
    expect(result).toContain('\u2022 30dk+kese kopuk masaj \u2192 900\u20ba');
    expect(result).toContain('\u2022 MIX 70dk (7 teknik) masaj \u2192 2000\u20ba');
    expect(result).toContain('\u2022 Sicak Tas 60dk masaj \u2192 1600\u20ba');
    expect(result).toContain('\u2022 Medikal 30dk masaj \u2192 1200\u20ba');
    expect(result).toContain('\u2022 Kese ekleme \u2192 +100\u20ba');
  });

  it('does not touch headings or rows that already contain masaj', () => {
    const result = formatMassagePricingTemplate(
      [
        'KLASIK MASAJ:',
        '\u2022 30dk masaj \u2192 800\u20ba',
        '\u2022 Aromaterapi masaj 50dk \u2192 1800\u20ba',
      ].join('\n'),
    );

    expect(result).toContain('KLASIK MASAJ:');
    expect(result).toContain('\u2022 30dk masaj \u2192 800\u20ba');
    expect(result).toContain('\u2022 Aromaterapi masaj 50dk \u2192 1800\u20ba');
  });
});
