import { describe, expect, it } from 'vitest';
import { TurkishDMHumanizerService, type TurkishDMHumanizerConfig } from './TurkishDMHumanizerService.js';

const ENABLED_CONFIG: TurkishDMHumanizerConfig = {
  enabled: true,
  mode: 'light',
  traceEnabled: true,
};

describe('TurkishDMHumanizerService', () => {
  const service = new TurkishDMHumanizerService();

  it('returns the original text unchanged when disabled', () => {
    const result = service.humanize({
      text: 'Elbette, masaj fiyatimiz 1500 TL.',
      config: {
        enabled: false,
        mode: 'light',
        traceEnabled: true,
      },
      conductState: 'normal',
    });

    expect(result.text).toBe('Elbette, masaj fiyatimiz 1500 TL.');
    expect(result.trace.applied).toBe(false);
  });

  it('removes servile openers and redundant greetings from factual replies', () => {
    const result = service.humanize({
      text: 'Merhaba! Elbette, masaj fiyatlarimiz 1500 TL.',
      config: ENABLED_CONFIG,
      conductState: 'normal',
    });

    expect(result.text).toBe('masaj fiyatlarimiz 1500 TL.');
    expect(result.trace.ruleIds).toContain('trim_redundant_greeting');
    expect(result.trace.ruleIds).toContain('trim_servile_opener');
  });

  it('removes generic soft closes when there is substantive content', () => {
    const result = service.humanize({
      text: 'Adresimiz Haraparasi Mahallesi. Baska sorunuz olursa yardimci olabilirim.',
      config: ENABLED_CONFIG,
      conductState: 'normal',
    });

    expect(result.text).toBe('Adresimiz Haraparasi Mahallesi.');
    expect(result.trace.ruleIds).toContain('trim_generic_close');
  });

  it('preserves protected factual tokens like phone numbers and prices', () => {
    const result = service.humanize({
      text: 'Elbette, fiyatimiz 1.500 TL. Telefon: 0326 502 58 58.',
      config: ENABLED_CONFIG,
      conductState: 'normal',
    });

    expect(result.text).toContain('1.500 TL');
    expect(result.text).toContain('0326 502 58 58');
  });

  it('preserves URLs instead of splitting them during sentence cleanup', () => {
    const result = service.humanize({
      text: 'Konum: https://maps.app.goo.gl/qC4jh7fquXYX3vPA6',
      config: ENABLED_CONFIG,
      conductState: 'normal',
    });

    expect(result.text).toBe('Konum: https://maps.app.goo.gl/qC4jh7fquXYX3vPA6');
    expect(result.text).not.toContain('maps. app. goo. gl');
  });

  it('does not mutate guarded conduct replies', () => {
    const result = service.humanize({
      text: 'Merhaba! Elbette, fiyatimiz 1500 TL.',
      config: ENABLED_CONFIG,
      conductState: 'guarded',
    });

    expect(result.text).toBe('Merhaba! Elbette, fiyatimiz 1500 TL.');
    expect(result.trace.applied).toBe(false);
  });

  it('keeps at most one emoji', () => {
    const result = service.humanize({
      text: 'Masaj fiyatimiz 1500 TL. 😊 📞',
      config: ENABLED_CONFIG,
      conductState: 'normal',
    });

    expect(result.text).toBe('Masaj fiyatimiz 1500 TL. 😊');
    expect(result.trace.ruleIds).toContain('limit_emoji');
  });

  it('softens robotic connectors without touching protected time ranges', () => {
    const result = service.humanize({
      text: 'Bununla birlikte tesisimiz 08:00-00:00 aciktir.',
      config: ENABLED_CONFIG,
      conductState: 'normal',
    });

    expect(result.text).toBe('Ayrica tesisimiz 08:00-00:00 aciktir.');
    expect(result.trace.ruleIds).toContain('soften_robotic_connector');
  });
});
