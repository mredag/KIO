export function normalizeRoomAvailabilitySignalText(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/\u0131/g, 'i')
    .replace(/\u0130/g, 'i')
    .replace(/\u00fc/g, 'u')
    .replace(/\u00dc/g, 'u')
    .replace(/\u00f6/g, 'o')
    .replace(/\u00d6/g, 'o')
    .replace(/\u015f/g, 's')
    .replace(/\u015e/g, 's')
    .replace(/\u00e7/g, 'c')
    .replace(/\u00c7/g, 'c')
    .replace(/\u011f/g, 'g')
    .replace(/\u011e/g, 'g')
    .replace(/[^\p{L}\p{N}\s+.-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasRoomAvailabilitySignals(...parts: Array<string | null | undefined>): boolean {
  const normalized = normalizeRoomAvailabilitySignalText(parts.filter(Boolean).join(' '));
  if (!normalized) {
    return false;
  }

  return ROOM_AVAILABILITY_PATTERNS.some(pattern => pattern.test(normalized));
}

const ROOM_AVAILABILITY_PATTERNS = [
  /\b(?:cift|couple|iki kisilik|2 kisilik|tek kisilik|1 kisilik)\b.*\b(?:oda\w*|room\w*)\b/,
  /\b(?:oda\w*|room\w*)\b.*\b(?:cift|couple|iki kisilik|2 kisilik|tek kisilik|1 kisilik|var|mevcut|bos)\b/,
  /\b(?:cift|couple)\b.*\bmasaj\b/,
];
