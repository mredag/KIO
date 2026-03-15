import { describe, expect, it } from 'vitest';
import {
  buildDeterministicAppointmentTemplate,
  buildDeterministicCampaignTemplate,
  buildDeterministicCloseoutTemplate,
  buildDeterministicHoursAppointmentTemplate,
  buildDeterministicHoursTemplate,
  buildDeterministicLocationTemplate,
  buildDeterministicMassagePricingTemplate,
  buildDeterministicPilatesTemplate,
  buildDeterministicPhoneTemplate,
  buildGenericInfoTemplate,
  formatMassagePricingTemplate,
} from './GenericInfoTemplateService.js';

const BULLET = '\u2022';
const ARROW = '\u2192';
const TL = '\u20ba';

describe('GenericInfoTemplateService', () => {
  it('adds masaj label to all duration-based massage pricing rows', () => {
    const result = formatMassagePricingTemplate(
      [
        'KLASIK MASAJ:',
        `${BULLET} 30dk ${ARROW} 800${TL}`,
        `${BULLET} 40dk ${ARROW} 1000${TL}`,
        `${BULLET} 30dk+kese kopuk ${ARROW} 900${TL}`,
        `${BULLET} MIX 70dk (7 teknik) ${ARROW} 2000${TL}`,
        `${BULLET} Sicak Tas 60dk ${ARROW} 1600${TL}`,
        `${BULLET} Medikal 30dk ${ARROW} 1200${TL}`,
        `${BULLET} Kese ekleme ${ARROW} +100${TL}`,
      ].join('\n'),
    );

    expect(result).toContain(`${BULLET} 30dk masaj ${ARROW} 800${TL}`);
    expect(result).toContain(`${BULLET} 40dk masaj ${ARROW} 1000${TL}`);
    expect(result).toContain(`${BULLET} 30dk+kese kopuk masaj ${ARROW} 900${TL}`);
    expect(result).toContain(`${BULLET} MIX 70dk (7 teknik) masaj ${ARROW} 2000${TL}`);
    expect(result).toContain(`${BULLET} Sicak Tas 60dk masaj ${ARROW} 1600${TL}`);
    expect(result).toContain(`${BULLET} Medikal 30dk masaj ${ARROW} 1200${TL}`);
    expect(result).toContain(`${BULLET} Kese ekleme ${ARROW} +100${TL}`);
  });

  it('does not touch headings or rows that already contain masaj', () => {
    const result = formatMassagePricingTemplate(
      [
        'KLASIK MASAJ:',
        `${BULLET} 30dk masaj ${ARROW} 800${TL}`,
        `${BULLET} Aromaterapi masaj 50dk ${ARROW} 1800${TL}`,
      ].join('\n'),
    );

    expect(result).toContain('KLASIK MASAJ:');
    expect(result).toContain(`${BULLET} 30dk masaj ${ARROW} 800${TL}`);
    expect(result).toContain(`${BULLET} Aromaterapi masaj 50dk ${ARROW} 1800${TL}`);
  });

  it('builds a reusable generic info template from stable KB sections', () => {
    const result = buildGenericInfoTemplate({
      massagePricing: `KLASIK MASAJ:\n${BULLET} 30dk ${ARROW} 800${TL}\n${BULLET} 40dk ${ARROW} 1000${TL}\n${BULLET} 60dk ${ARROW} 1300${TL}\n${BULLET} 90dk ${ARROW} 2400${TL}`,
      massageAddonInfo: '30dk masajda kopuk yoktur, kese+kopuk eklemek +100₺ (toplam 900₺).',
      therapistInfo: 'Tum terapistlerimiz kadindir.',
      spaAccessInfo: 'Masaj alan musterilerimize hamam, sauna ve buhar odasi ucretsiz olarak sunuluyor.',
      facilityOverview: 'Tesisimizde yuzme havuzu, hamam, sauna ve buhar odasi bulunur.',
      poolTemperatureInfo: 'Kapali havuz sicakligi kis aylarinda 27-30 derece sicakliktadir.',
      bringInfo: 'Terlik ve mayo getirmeniz yeterlidir.',
      phoneInfo: '0532 000 00 00',
      locationInfo: 'Steel Towers A Blok 4. Kat, Iskenderun / Hatay',
    });

    expect(result).toContain('Size kisa bir ozet paylasayim:');
    expect(result).toContain(`Masaj fiyatlari:\n${BULLET} 30dk masaj ${ARROW} 800${TL}`);
    expect(result).toContain(`${BULLET} Kese kopuk ilavesi: +100₺`);
    expect(result).toContain(`Spa alani:\n${BULLET} Masaj alanlara hamam/sauna/buhar/kapali havuz ucretsiz.`);
    expect(result).toContain(`${BULLET} Kapali havuz sicakligi kis aylarinda 27-30 derecedir.`);
    expect(result).toContain(`Terapistlerimiz:\n${BULLET} Tum terapistlerimiz kadindir.`);
    expect(result).toContain(`Konum:\n${BULLET} Steel Towers A Blok 4. Kat, Iskenderun / Hatay`);
    expect(result).toContain(`Randevu ve detayli bilgi:\n${BULLET} 0532 000 00 00`);
    expect(result!.length).toBeLessThanOrEqual(900);
  });

  it('keeps the generic info template under 900 chars with long KB content', () => {
    const result = buildGenericInfoTemplate({
      massagePricing: Array.from({ length: 12 }, (_, i) => `${BULLET} ${30 + (i * 10)}dk ${ARROW} ${800 + (i * 100)}${TL}`).join('\n'),
      therapistInfo: 'Tum terapistlerimiz profesyonel kadin terapistlerdir ve geleneksel uzak dogu tekniklerinde deneyimlidir. Musteri memnuniyetine odakli calisirlar.',
      bringInfo: 'Terlik, mayo, bikini, yedek camasir ve kisisel bakim urunlerinizi getirmeniz yeterlidir. Bone gerekiyorsa tesisimizde temin edebilirsiniz.',
      phoneInfo: 'Sabit: 0326 502 58 58\nCep/WhatsApp: 0530 250 05 58',
      locationInfo: 'Eform Spor Merkezi, Cay Mahallesi, Tayfur Sokmen Bulvari, Steel Tower Is Merkezi (Steel Towers), A Blok, 4. Kat, Iskenderun / Hatay. Google Maps konumu mevcut.',
      facilityOverview: 'Eform Spor Merkezi: Fitness salonu, yuzme havuzu, hamam, sauna ve buhar odasi bulunur.',
      poolTemperatureInfo: 'Kapali havuz sicakligi kis aylarinda 27-30 derece sicakliktadir.',
    });

    expect(result).toBeTruthy();
    expect(result).toContain(`Konum:\n${BULLET} `);
    expect(result).toContain(`Randevu ve detayli bilgi:\n${BULLET} `);
    expect(result!.length).toBeLessThanOrEqual(900);
  });

  it('keeps the generic info opener focused and strips raw prep guide noise', () => {
    const result = buildGenericInfoTemplate({
      massagePricing: `KLASIK MASAJ:\n${BULLET} 30dk ${ARROW} 800${TL}\n${BULLET} 40dk ${ARROW} 1000${TL}\n${BULLET} 60dk ${ARROW} 1300${TL}\n${BULLET} 90dk ${ARROW} 2400${TL}`,
      therapistInfo: 'Tum masaj terapistlerimiz profesyonel kadin terapistlerdir. Sertifikali ve deneyimli ekibimiz vardir.',
      bringInfo: 'YANIMDA NE GETIREYIM?\nTEMIN EDILENLER:\nHavlu\nTerlik\nSort',
      phoneInfo: 'Sabit: 0326 502 58 58\nCep/WhatsApp: 0530 250 05 58',
      locationInfo: 'Eform Spor Merkezi\nAdres: Cay Mahallesi, Tayfur Sokmen Bulvari, Steel Tower Is Merkezi (Steel Towers), A Blok, 4. Kat, Iskenderun / Hatay\nKonum (Google Maps): https://maps.app.goo.gl/qC4jh7fquXYX3vPA6',
    });

    expect(result).toContain(`Konum:\n${BULLET} Cay Mahallesi, Tayfur Sokmen Bulvari, Steel Towers, A Blok, 4. Kat, Iskenderun / Hatay`);
    expect(result).not.toContain('YANIMDA NE GETIREYIM');
    expect(result).not.toContain('Google Maps');
    expect(result).not.toContain('maps.app.goo.gl');
    expect(result).not.toContain('Hazirlik:');
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
      campaignInfo: 'KAMPANYA: 4 kisi gelirse 5. kisiye ayni masaj HEDIYE!',
    })).toBe('KAMPANYA: 4 kisi gelirse 5. kisiye ayni masaj HEDIYE!');
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

  it('builds a deterministic generic massage pricing template without unnecessary clarifier text', () => {
    const result = buildDeterministicMassagePricingTemplate({
      massagePricing: `KLASIK MASAJ:\n${BULLET} 30dk ${ARROW} 800${TL}\n${BULLET} 40dk ${ARROW} 1000${TL}\n${BULLET} 60dk ${ARROW} 1300${TL}\n${BULLET} 90dk ${ARROW} 2400${TL}`,
      phoneInfo: '0326 502 58 58',
    });

    expect(result).toContain('Masaj fiyatlarimizdan kisa bir ozet:');
    expect(result).toContain(`30dk masaj ${ARROW} 800${TL}`);
    expect(result).toContain('Detayli bilgi ve randevu: 0326 502 58 58');
    expect(result).not.toContain('Hangi masaj');
  });
});
