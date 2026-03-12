export function normalizeMembershipInclusionSignalText(text: string): string {
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

export function hasMembershipInclusionSignals(...parts: Array<string | null | undefined>): boolean {
  const normalized = normalizeMembershipInclusionSignalText(parts.filter(Boolean).join(' '));
  if (!normalized) {
    return false;
  }

  return MEMBERSHIP_INCLUSION_PATTERNS.some(pattern => pattern.test(normalized));
}

export function hasExplicitMembershipInclusionEvidenceLine(text: string): boolean {
  const normalized = normalizeMembershipInclusionSignalText(text);
  if (!normalized) {
    return false;
  }

  return MEMBERSHIP_EVIDENCE_PATTERNS.some(pattern => pattern.test(normalized));
}

const MEMBERSHIP_INCLUSION_PATTERNS = [
  /\b(?:uyelik|uyeligi|uyelikte|uyelikler|membership|abonelik)\b.*\b(?:icer(?:ik|igi|iginde|isinde)|dahil|kaps(?:ar|iyor|aminda)|yararlan(?:abil|ilir|abileceg)|imkan(?:lar|lari)?|olanak(?:lar|lari)?|neler(?:dir)?|hangi alan(?:lar)?|faydalan(?:abil|ilir)|kullanim(?:i)?|icinde|icerisinde)\b/,
  /\b(?:icer(?:ik|igi|iginde|isinde)|dahil|kapsam(?:i|inda)|yararlan(?:abil|ilir|abileceg)|imkan(?:lar|lari)?|olanak(?:lar|lari)?|neler(?:dir)?|hangi alan(?:lar)?|faydalan(?:abil|ilir)|kullanim(?:i)?)\b.*\b(?:uyelik|uyeligi|uyelikte|uyelikler|membership|abonelik)\b/,
];

const MEMBERSHIP_EVIDENCE_PATTERNS = [
  /\b(?:uyelik|uyelikler|membership|abonelik)\b.*\b(?:kaps(?:ar|iyor|amistir)|dahil(?:dir)?|icer(?:ir|iginde)|yararlan(?:abilir|abilirsiniz)|kullanim(?:i|ini)|erisim)\b/,
  /\btum\s+uyelikler\b.*\b(?:kaps(?:ar|iyor)|dahil(?:dir)?|yararlan(?:abilir|abilirsiniz)|kullanim(?:i|ini)|erisim)\b/,
];
