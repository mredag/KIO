import { normalizeTurkish } from './InstagramContextService.js';

export interface GenericInfoTemplateInput {
  massagePricing?: string | null;
  massageAddonInfo?: string | null;
  therapistInfo?: string | null;
  bringInfo?: string | null;
  phoneInfo?: string | null;
  locationInfo?: string | null;
  spaAccessInfo?: string | null;
  facilityOverview?: string | null;
  poolTemperatureInfo?: string | null;
}

export interface DeterministicHoursTemplateInput {
  facilityHours?: string | null;
  spaHours?: string | null;
  extraHours?: string[];
}

export interface DeterministicAppointmentTemplateInput {
  appointmentInfo?: string | null;
  phoneInfo?: string | null;
  whatsappInfo?: string | null;
}

export interface DeterministicCampaignTemplateInput {
  campaignInfo?: string | null;
}

export interface DeterministicHoursAppointmentTemplateInput {
  hoursInfo?: string | null;
  appointmentInfo?: string | null;
}

export interface DeterministicPilatesTemplateInput {
  pilatesDetails?: string | null;
  pilatesPricing?: string | null;
  locationInfo?: string | null;
  phoneInfo?: string | null;
  whatsappInfo?: string | null;
}

export interface DeterministicMassagePricingTemplateInput {
  massagePricing?: string | null;
  phoneInfo?: string | null;
}

const GENERIC_INFO_TEMPLATE_MAX_CHARS = 900;

function shouldAppendMassageLabel(leftSide: string): boolean {
  const normalized = normalizeTurkish(leftSide.toLowerCase());
  if (normalized.includes('masaj')) {
    return false;
  }

  return /\b\d+\s*dk(?:\b|[+])/i.test(leftSide.trim());
}

export function formatMassagePricingTemplate(value: string): string {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map(line => {
      const match = line.match(/^(\s*[\u2022-]?\s*)([^\u2192]+?)(\s*\u2192\s*.+)$/);
      if (!match) {
        return line;
      }

      const [, prefix, leftSide, rightSide] = match;
      const trimmedLeftSide = leftSide.trim();
      if (!shouldAppendMassageLabel(trimmedLeftSide)) {
        return line;
      }

      return `${prefix}${trimmedLeftSide} masaj${rightSide}`;
    })
    .join('\n');
}

export function clipTemplateBlock(value: string, maxLines: number, maxChars: number): string {
  const cleaned = value.replace(/\r/g, '').trim();
  if (!cleaned) {
    return '';
  }

  const lines = cleaned
    .split('\n')
    .map(line => line.trimEnd())
    .filter(Boolean)
    .slice(0, Math.max(1, maxLines));
  let block = lines.join('\n');
  if (block.length > maxChars) {
    block = `${block.slice(0, maxChars - 3).trimEnd()}...`;
  }
  return block;
}

function clipSingleLine(value: string, maxChars: number): string {
  return clipTemplateBlock(value, 4, maxChars).replace(/\s*\n\s*/g, ' ').trim();
}

function buildCompactLocationSummary(value: string): string {
  const lines = value
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const addressLine = lines.find(line => /^adres\s*:/iu.test(line))
    || lines.find(line => !/^konum\s*\(google maps\)/iu.test(line))
    || value;
  const cleaned = addressLine
    .replace(/^adres\s*:\s*/iu, '')
    .replace(/Steel Tower İş Merkezi \(Steel Towers\)/iu, 'Steel Towers')
    .replace(/Steel Tower Is Merkezi \(Steel Towers\)/iu, 'Steel Towers')
    .replace(/Steel Tower İş Merkezi/iu, 'Steel Towers')
    .replace(/Steel Tower Is Merkezi/iu, 'Steel Towers')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  return clipSingleLine(cleaned, 180);
}

function buildCompactPhoneSummary(value: string): string {
  return clipSingleLine(value.replace(/\s*\n\s*/g, ' | '), 160);
}

function buildCompactPhoneLines(value: string): string[] {
  return value
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => clipSingleLine(line, 120))
    .slice(0, 2);
}

function buildCompactTherapistSummary(value: string): string {
  const cleaned = value
    .replace(/\r/g, '')
    .replace(/\n+/g, ' ')
    .replace(/^[\p{Extended_Pictographic}\uFE0F\uFE0E\s]+/u, '')
    .trim();
  const firstSentence = cleaned.match(/[^.!?]+[.!?]?/u)?.[0] || cleaned;
  return clipSingleLine(firstSentence, 110);
}

function buildCompactMassagePricingSummary(value: string): string {
  const formatted = formatMassagePricingTemplate(value)
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const priceLines = formatted
    .filter(line => /\u2192/.test(line))
    .slice(0, 4)
    .map(line => line.replace(/^[\u2022-]\s*/u, '').replace(/\s+/g, ' '));

  if (priceLines.length === 0) {
    return `Masaj fiyatlarimizdan kisa bir ozet: ${clipSingleLine(value, 240)}`;
  }

  return `Masaj fiyatlarimizdan kisa bir ozet: ${clipSingleLine(priceLines.join(', '), 260)}`;
}

function buildCompactMassagePricingLines(value: string): string[] {
  const formatted = formatMassagePricingTemplate(value)
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const priceLines = formatted
    .filter(line => /\u2192/.test(line))
    .slice(0, 4)
    .map(line => line.replace(/^[\u2022-]\s*/u, '').replace(/\s+/g, ' '));

  if (priceLines.length > 0) {
    return priceLines;
  }

  const fallback = clipSingleLine(value, 220);
  return fallback ? [fallback] : [];
}

function buildCompactMassageAddonLine(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = normalizeTurkish(value.toLowerCase());
  const extraPrice = value.match(/\+\s*\d+[.,]?\d*\s*₺/u)?.[0]?.replace(/\s+/g, '');
  if (!extraPrice) {
    return null;
  }

  if (normalized.includes('kese') || normalized.includes('kopuk')) {
    return `Kese kopuk ilavesi: ${extraPrice}`;
  }

  return null;
}

function buildCompactSpaAccessSummary(value: string): string {
  const cleaned = value
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  const firstSentence = cleaned.match(/[^.!?]+[.!?]?/u)?.[0] || cleaned;
  return clipSingleLine(firstSentence, 180);
}

function buildCompactPoolTemperatureLine(value?: string | null): string | null {
  if (!value?.trim()) {
    return null;
  }

  const normalized = normalizeTurkish(value.toLowerCase());
  const rangeMatch = value.match(/(\d{2}\s*[-–]\s*\d{2})/u);
  if (normalized.includes('kis') && rangeMatch) {
    return `Kapali havuz sicakligi kis aylarinda ${rangeMatch[1].replace(/\s+/g, '')} derecedir.`;
  }

  const firstSentence = value
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]?/u)?.[0] || value;
  return clipSingleLine(firstSentence, 120);
}

function buildCompactSpaAccessLines(
  accessInfo?: string | null,
  facilityOverview?: string | null,
  poolTemperatureInfo?: string | null,
): string[] {
  const lines: string[] = [];

  const facilityNormalized = normalizeTurkish((facilityOverview || '').toLowerCase());
  const accessNormalized = normalizeTurkish((accessInfo || '').toLowerCase());
  const mentionsPool = facilityNormalized.includes('havuz') || facilityNormalized.includes('yuzme havuzu');
  const accessAlreadyMentionsPool = accessNormalized.includes('havuz') || accessNormalized.includes('pool');

  if (accessInfo?.trim()) {
    const canPromoteToCombinedSpaLine = mentionsPool
      && !accessAlreadyMentionsPool
      && accessNormalized.includes('masaj alan')
      && accessNormalized.includes('hamam')
      && accessNormalized.includes('sauna')
      && accessNormalized.includes('buhar');

    if (canPromoteToCombinedSpaLine) {
      lines.push('Masaj alanlara hamam/sauna/buhar/kapali havuz ucretsiz.');
    } else {
      lines.push(buildCompactSpaAccessSummary(accessInfo));
    }
  } else if (mentionsPool) {
    lines.push('Spa alanimizda hamam/sauna/buhar/kapali havuz bulunur.');
  }

  const poolTemperatureLine = buildCompactPoolTemperatureLine(poolTemperatureInfo);
  if (poolTemperatureLine) {
    lines.push(poolTemperatureLine);
  }

  return lines.slice(0, 2);
}

function joinSectionsWithinLimit(sections: string[], maxChars: number): string {
  const accepted: string[] = [];
  for (const section of sections) {
    if (!section) {
      continue;
    }
    const candidate = accepted.length > 0
      ? `${accepted.join('\n\n')}\n\n${section}`
      : section;
    if (candidate.length <= maxChars) {
      accepted.push(section);
    }
  }

  if (accepted.length === 0) {
    return '';
  }

  const joined = accepted.join('\n\n');
  if (joined.length <= maxChars) {
    return joined;
  }

  return `${joined.slice(0, maxChars - 3).trimEnd()}...`;
}

export function buildGenericInfoTemplate(input: GenericInfoTemplateInput): string | null {
  const sections: string[] = ['Size kisa bir ozet paylasayim:'];

  if (input.massagePricing?.trim()) {
    const pricingLines = buildCompactMassagePricingLines(input.massagePricing);
    if (pricingLines.length > 0) {
      const addonLine = buildCompactMassageAddonLine(input.massageAddonInfo || input.massagePricing);
      sections.push([
        'Masaj fiyatlari:',
        ...pricingLines.map(line => `\u2022 ${line}`),
        ...(addonLine ? [`\u2022 ${addonLine}`] : []),
      ].join('\n'));
    }
  }

  const spaLines = buildCompactSpaAccessLines(
    input.spaAccessInfo,
    input.facilityOverview,
    input.poolTemperatureInfo,
  );
  if (spaLines.length > 0) {
    sections.push(['Spa alani:', ...spaLines.map(line => `\u2022 ${line}`)].join('\n'));
  }

  if (input.locationInfo?.trim()) {
    sections.push(`Konum:\n\u2022 ${buildCompactLocationSummary(input.locationInfo)}`);
  }

  if (input.phoneInfo?.trim()) {
    const phoneLines = buildCompactPhoneLines(input.phoneInfo);
    if (phoneLines.length > 0) {
      sections.push(['Randevu ve detayli bilgi:', ...phoneLines.map(line => `\u2022 ${line}`)].join('\n'));
    } else {
      sections.push(`Randevu ve detayli bilgi:\n\u2022 ${buildCompactPhoneSummary(input.phoneInfo)}`);
    }
  }

  if (input.therapistInfo?.trim()) {
    sections.push(`Terapistlerimiz:\n\u2022 ${buildCompactTherapistSummary(input.therapistInfo)}`);
  }

  const result = joinSectionsWithinLimit(sections, GENERIC_INFO_TEMPLATE_MAX_CHARS);
  return result && result !== sections[0] ? result : null;
}

export function buildDeterministicLocationTemplate(address: string | null | undefined): string | null {
  if (!address?.trim()) {
    return null;
  }

  return `Konumumuz: ${clipTemplateBlock(address, 3, 420)}`;
}

export function buildDeterministicPhoneTemplate(phone: string | null | undefined): string | null {
  if (!phone?.trim()) {
    return null;
  }

  return `Bize su numaralardan ulasabilirsiniz: ${clipTemplateBlock(phone, 2, 220)}`;
}

export function buildDeterministicHoursTemplate(input: DeterministicHoursTemplateInput): string | null {
  const lines = [
    input.facilityHours?.trim() || '',
    input.spaHours?.trim() || '',
    ...(input.extraHours || []).map(value => value.trim()).filter(Boolean),
  ].filter(Boolean);

  if (lines.length === 0) {
    return null;
  }

  return lines.join('\n');
}

export function buildDeterministicAppointmentTemplate(input: DeterministicAppointmentTemplateInput): string | null {
  const appointmentInfo = input.appointmentInfo?.trim()
    ? clipTemplateBlock(input.appointmentInfo, 4, 320)
    : '';
  const phoneInfo = input.phoneInfo?.trim()
    ? clipTemplateBlock(input.phoneInfo, 3, 220)
    : '';
  const whatsappInfo = !phoneInfo && input.whatsappInfo?.trim()
    ? clipTemplateBlock(input.whatsappInfo, 2, 220)
    : '';

  const lines = [appointmentInfo, phoneInfo, whatsappInfo].filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  if (!appointmentInfo) {
    return `Randevu icin bize ulasabilirsiniz:\n${[phoneInfo, whatsappInfo].filter(Boolean).join('\n')}`;
  }

  return lines.join('\n');
}

export function buildDeterministicCampaignTemplate(input: DeterministicCampaignTemplateInput): string | null {
  if (!input.campaignInfo?.trim()) {
    return null;
  }

  return clipTemplateBlock(input.campaignInfo, 4, 320);
}

export function buildDeterministicHoursAppointmentTemplate(input: DeterministicHoursAppointmentTemplateInput): string | null {
  const sections = [
    input.hoursInfo?.trim() ? clipTemplateBlock(input.hoursInfo, 6, 320) : '',
    input.appointmentInfo?.trim() ? clipTemplateBlock(input.appointmentInfo, 4, 320) : '',
  ].filter(Boolean);

  if (sections.length === 0) {
    return null;
  }

  return sections.join('\n\n');
}

export function buildDeterministicPilatesTemplate(input: DeterministicPilatesTemplateInput): string | null {
  const sections: string[] = ['Reformer Pilates bilgilerimiz:'];

  if (input.pilatesDetails?.trim()) {
    sections.push(clipTemplateBlock(input.pilatesDetails, 4, 320));
  }
  if (input.pilatesPricing?.trim()) {
    sections.push(`Fiyat: ${clipTemplateBlock(input.pilatesPricing, 3, 180)}`);
  }
  if (input.locationInfo?.trim()) {
    sections.push(`Konum: ${clipTemplateBlock(input.locationInfo, 3, 260)}`);
  }

  const contactLines = [
    input.phoneInfo?.trim() ? clipTemplateBlock(input.phoneInfo, 2, 180) : '',
    input.whatsappInfo?.trim() ? clipTemplateBlock(input.whatsappInfo, 2, 180) : '',
  ].filter(Boolean);
  if (contactLines.length > 0) {
    sections.push(`Detayli bilgi ve kayit: ${contactLines.join(' | ')}`);
  }

  return sections.length > 1 ? sections.join('\n\n') : null;
}

export function buildDeterministicMassagePricingTemplate(input: DeterministicMassagePricingTemplateInput): string | null {
  const sections: string[] = [];

  if (input.massagePricing?.trim()) {
    sections.push(buildCompactMassagePricingSummary(input.massagePricing));
  }

  if (input.phoneInfo?.trim()) {
    sections.push(`Detayli bilgi ve randevu: ${buildCompactPhoneSummary(input.phoneInfo)}`);
  }

  const result = joinSectionsWithinLimit(sections, 420);
  return result || null;
}

export function buildDeterministicCloseoutTemplate(): string {
  return 'Rica ederiz.';
}
