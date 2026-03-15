import { normalizeTurkish } from './InstagramContextService.js';

export interface GenericInfoTemplateInput {
  massagePricing?: string | null;
  therapistInfo?: string | null;
  bringInfo?: string | null;
  phoneInfo?: string | null;
  locationInfo?: string | null;
  spaAccessInfo?: string | null;
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

  return clipSingleLine(addressLine.replace(/^adres\s*:\s*/iu, ''), 180);
}

function buildCompactPhoneSummary(value: string): string {
  return clipSingleLine(value.replace(/\s*\n\s*/g, ' | '), 160);
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
    .filter(line => /→/.test(line))
    .slice(0, 4)
    .map(line => line.replace(/^[\u2022-]\s*/u, '').replace(/\s+/g, ' '));

  if (priceLines.length === 0) {
    return `Masaj fiyatlarimiz: ${clipSingleLine(value, 240)}`;
  }

  return `Masaj fiyatlarimiz: ${clipSingleLine(priceLines.join(' | '), 260)}`;
}

function buildCompactSpaAccessSummary(value: string): string {
  const cleaned = value
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
  const firstSentence = cleaned.match(/[^.!?]+[.!?]?/u)?.[0] || cleaned;
  return clipSingleLine(firstSentence, 180);
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
  const sections: string[] = ['Kisaca temel bilgileri paylasayim:'];

  if (input.massagePricing?.trim()) {
    sections.push(buildCompactMassagePricingSummary(input.massagePricing));
  }
  if (input.spaAccessInfo?.trim()) {
    sections.push(`Spa alani: ${buildCompactSpaAccessSummary(input.spaAccessInfo)}`);
  }
  if (input.locationInfo?.trim()) {
    sections.push(`Konum: ${buildCompactLocationSummary(input.locationInfo)}`);
  }
  if (input.phoneInfo?.trim()) {
    sections.push(`Detayli bilgi ve randevu: ${buildCompactPhoneSummary(input.phoneInfo)}`);
  }
  if (input.therapistInfo?.trim()) {
    sections.push(`Terapist bilgisi: ${buildCompactTherapistSummary(input.therapistInfo)}`);
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
