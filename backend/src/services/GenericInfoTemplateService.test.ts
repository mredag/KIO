import { describe, expect, it } from 'vitest';
import {
  buildDeterministicAppointmentTemplate,
  buildDeterministicCampaignTemplate,
  buildDeterministicCloseoutTemplate,
  buildDeterministicHoursAppointmentTemplate,
  buildDeterministicHoursTemplate,
  buildDeterministicLocationTemplate,
  buildDeterministicPilatesTemplate,
  buildDeterministicPhoneTemplate,
  buildGenericInfoTemplate,
  formatMassagePricingTemplate,
} from './GenericInfoTemplateService.js';

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

  it('builds a reusable generic info template from stable KB sections', () => {
    const result = buildGenericInfoTemplate({
      massagePricing: 'KLASIK MASAJ:\n\u2022 30dk \u2192 800\u20ba\n\u2022 40dk \u2192 1000\u20ba\n\u2022 60dk \u2192 1300\u20ba\n\u2022 90dk \u2192 2400\u20ba',
      therapistInfo: 'Tum terapistlerimiz kadindir.',
      bringInfo: 'Terlik ve mayo getirmeniz yeterlidir.',
      phoneInfo: '0532 000 00 00',
      locationInfo: 'Steel Towers A Blok 4. Kat, Iskenderun / Hatay',
    });

    expect(result).toContain('Kisaca temel bilgileri paylasayim:');
    expect(result).toContain('Masaj fiyatlarimiz:');
    expect(result).toContain('Terapist bilgisi:');
    expect(result).toContain('Konum: Steel Towers A Blok 4. Kat, Iskenderun / Hatay');
    expect(result).toContain('Detayli bilgi ve randevu: 0532 000 00 00');
    expect(result!.length).toBeLessThanOrEqual(900);
  });

  it('keeps the generic info template under 900 chars with long KB content', () => {
    const result = buildGenericInfoTemplate({
      massagePricing: Array.from({ length: 12 }, (_, i) => `\u2022 ${30 + (i * 10)}dk \u2192 ${800 + (i * 100)}\u20ba`).join('\n'),
      therapistInfo: 'Tum terapistlerimiz profesyonel kadin terapistlerdir ve geleneksel uzak dogu tekniklerinde deneyimlidir. Musteri memnuniyetine odakli calisirlar.',
      bringInfo: 'Terlik, mayo, bikini, yedek camasir ve kisisel bakim urunlerinizi getirmeniz yeterlidir. Bone gerekiyorsa tesisimizde temin edebilirsiniz.',
      phoneInfo: 'Sabit: 0326 502 58 58\nCep/WhatsApp: 0530 250 05 58',
      locationInfo: 'Eform Spor Merkezi, Cay Mahallesi, Tayfur Sokmen Bulvari, Steel Tower Is Merkezi (Steel Towers), A Blok, 4. Kat, Iskenderun / Hatay. Google Maps konumu mevcut.',
    });

    expect(result).toBeTruthy();
    expect(result).toContain('Konum:');
    expect(result).toContain('Detayli bilgi ve randevu:');
    expect(result!.length).toBeLessThanOrEqual(900);
  });

  it('builds deterministic contact and hours snippets', () => {
    expect(buildDeterministicLocationTemplate('Iskenderun merkez, Pac Meydani yani')).toBe('Konumumuz: Iskenderun merkez, Pac Meydani yani');
    expect(buildDeterministicPhoneTemplate('0532 000 00 00')).toBe('Bize su numaralardan ulasabilirsiniz: 0532 000 00 00');
    expect(buildDeterministicHoursTemplate({
      facilityHours: 'Tesis: 09:00-23:00',
      spaHours: 'Spa: 10:00-22:00',
      extraHours: ['Hamam: 10:00-22:00'],
    })).toBe('Tesis: 09:00-23:00\nSpa: 10:00-22:00\nHamam: 10:00-22:00');
    expect(buildDeterministicAppointmentTemplate({
      appointmentInfo: 'Randevu telefonla veya WhatsApp uzerinden olusturulur. Su an online rezervasyon sistemimiz yok.',
      phoneInfo: 'Sabit: 0326 502 58 58\nCep/WhatsApp: 0530 250 05 58',
    })).toBe('Randevu telefonla veya WhatsApp uzerinden olusturulur. Su an online rezervasyon sistemimiz yok.\nSabit: 0326 502 58 58\nCep/WhatsApp: 0530 250 05 58');
  });

  it('builds the deterministic closeout reply', () => {
    expect(buildDeterministicCloseoutTemplate()).toBe('Rica ederiz.');
  });

  it('builds a deterministic campaign snippet from KB campaign info', () => {
    expect(buildDeterministicCampaignTemplate({
      campaignInfo: '🔥 KAMPANYA: 4 kisi gelirse 5. kisiye ayni masaj HEDIYE!',
    })).toBe('🔥 KAMPANYA: 4 kisi gelirse 5. kisiye ayni masaj HEDIYE!');
  });

  it('builds deterministic combined hours and appointment snippets', () => {
    expect(buildDeterministicHoursAppointmentTemplate({
      hoursInfo: 'Tesis: 09:00-23:00\nSpa: 10:00-22:00',
      appointmentInfo: 'Randevu telefon veya WhatsApp uzerinden olusturulur.\n0530 250 05 58',
    })).toBe('Tesis: 09:00-23:00\nSpa: 10:00-22:00\n\nRandevu telefon veya WhatsApp uzerinden olusturulur.\n0530 250 05 58');
  });

  it('builds a deterministic reformer pilates template', () => {
    const result = buildDeterministicPilatesTemplate({
      pilatesDetails: 'Reformer Pilates: Haftada 2 gun, kucuk grup calismasi.',
      pilatesPricing: '3500 TL/ay (Haftada 2 gun)',
      locationInfo: 'Steel Towers A Blok 4. Kat, Iskenderun / Hatay',
      phoneInfo: '0326 502 58 58',
      whatsappInfo: '0530 250 05 58',
    });

    expect(result).toContain('Reformer Pilates bilgilerimiz:');
    expect(result).toContain('Fiyat: 3500 TL/ay (Haftada 2 gun)');
  });
});
