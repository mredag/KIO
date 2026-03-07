export function normalizePolicySignalText(text: string): string {
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

export function hasAgePolicySignals(...parts: Array<string | null | undefined>): boolean {
  const normalized = normalizePolicySignalText(parts.filter(Boolean).join(' '));
  if (!normalized) {
    return false;
  }

  return AGE_POLICY_SIGNAL_PATTERNS.some(pattern => pattern.test(normalized));
}

export function hasNoAgeRestrictionClaim(text: string): boolean {
  const normalized = normalizePolicySignalText(text);
  if (!normalized) {
    return false;
  }

  return NO_AGE_RESTRICTION_PATTERNS.some(pattern => pattern.test(normalized));
}

export function hasAgeRestrictionEvidenceLine(text: string): boolean {
  const normalized = normalizePolicySignalText(text);
  if (!normalized) {
    return false;
  }

  return AGE_RESTRICTION_EVIDENCE_PATTERNS.some(pattern => pattern.test(normalized));
}

const AGE_POLICY_SIGNAL_PATTERNS = [
  /\byas(?:a|i|in|ina)?\b/,
  /\byas siniri\b/,
  /\b18\s*(?:\+|yas|yas ve|yas ustu|yas uzeri|yas alti)\b/,
  /\b18\+\b/,
  /\bcocuk\b/,
  /\bebeveyn\b/,
  /\bveli\b/,
  /\bresit\b/,
  /\bminor\b/,
  /\byetiskin\b/,
];

const NO_AGE_RESTRICTION_PATTERNS = [
  /\byasa?\s+b[a]?kmi?yoruz\b/,
  /\byas\s+siniri\s+yok\b/,
  /\byas\s+fark\s+etmez\b/,
  /\bher\s+yas\b/,
  /\bherkes\b.*\b(?:gelebilir|alabilir|yararlanabilir|girebilir|yaptirabilir|tercih edebilir|kullanabilir)\b/,
  /\bistedigi\s+masaji\s+tercih\s+edebilir\b/,
];

const AGE_RESTRICTION_EVIDENCE_PATTERNS = [
  /\byas\s+siniri\b/,
  /\b\d{1,2}\s*\+\b/,
  /\b\d{1,2}\s*yas\s*(?:ve\s*)?(?:uzeri|ustu|alti)\b/,
  /\b\d{1,2}\s*-\s*\d{1,2}\s*yas\b/,
  /\bebeveyn\b/,
  /\bveli\b/,
];
