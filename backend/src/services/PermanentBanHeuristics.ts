import { normalizeTurkish } from './InstagramContextService.js';
import type { ConductState } from './SuspiciousUserService.js';

export interface PermanentBanEvaluation {
  shouldBan: boolean;
  reason: string | null;
  category: 'severe_abuse' | 'moderate_repeat_abuse' | 'vulgar_sexual_spam' | null;
  matchedTerms: string[];
}

export interface PermanentBanParams {
  messageText: string;
  conductStateBefore: ConductState;
  offenseCountAfter: number;
}

const SEVERE_ABUSE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:orospu cocugu|anani sik(?:eyim|erim)?|amina koy(?:ayim|im)|siktir git|pezevenk|pic kurusu)\b/u, 'severe_abuse'],
  [/\b(?:ibne|yavsak)\b/u, 'hate_or_slur'],
];

const MODERATE_ABUSE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:salak|aptal|gerizekali|gerzek|mal|serefsiz|karaktersiz)\b/u, 'insult'],
  [/\b(?:sapik|rezil|haysiyetsiz|terbiyesiz)\b/u, 'abusive_wording'],
  [/\b(?:oc|pic)\b/u, 'short_slur'],
];

const EXPLICIT_VULGAR_SEXUAL_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:porno)\b/u, 'porno'],
  [/\b(?:sikis|sex|seks|sakso|oral|anal|escort)\b/u, 'explicit_sexual'],
  [/\b(?:yarak|yarrak|amcik|got)\b/u, 'vulgar_body_term'],
];

function normalizeAbuseText(text: string): string {
  return normalizeTurkish(text.toLocaleLowerCase('tr-TR'))
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectMatches(normalized: string, patterns: Array<[RegExp, string]>): string[] {
  const matches = new Set<string>();
  for (const [pattern, label] of patterns) {
    if (pattern.test(normalized)) {
      matches.add(label);
    }
  }
  return Array.from(matches);
}

function countExplicitVulgarSexualHits(normalized: string): number {
  let score = 0;
  for (const [pattern] of EXPLICIT_VULGAR_SEXUAL_PATTERNS) {
    if (pattern.test(normalized)) {
      score += 1;
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const repeatedPorn = tokens.filter(token => token === 'porno').length >= 3;
  if (repeatedPorn) {
    score += 1;
  }

  return score;
}

export function evaluatePermanentBanCandidate(params: PermanentBanParams): PermanentBanEvaluation {
  const normalized = normalizeAbuseText(params.messageText);
  if (!normalized) {
    return {
      shouldBan: false,
      reason: null,
      category: null,
      matchedTerms: [],
    };
  }

  const severeMatches = collectMatches(normalized, SEVERE_ABUSE_PATTERNS);
  if (severeMatches.length > 0) {
    return {
      shouldBan: true,
      reason: 'High-confidence abusive slur/hate-speech wording detected.',
      category: 'severe_abuse',
      matchedTerms: severeMatches,
    };
  }

  const moderateMatches = collectMatches(normalized, MODERATE_ABUSE_PATTERNS);
  if (moderateMatches.length > 0
    && (params.conductStateBefore === 'final_warning'
      || params.conductStateBefore === 'silent'
      || params.offenseCountAfter >= 3)) {
    return {
      shouldBan: true,
      reason: 'Repeated abusive wording detected after prior misconduct.',
      category: 'moderate_repeat_abuse',
      matchedTerms: moderateMatches,
    };
  }

  const vulgarSexualScore = countExplicitVulgarSexualHits(normalized);
  if (vulgarSexualScore >= 2
    && (params.conductStateBefore === 'final_warning'
      || params.conductStateBefore === 'silent'
      || params.offenseCountAfter >= 5)) {
    return {
      shouldBan: true,
      reason: 'Repeated vulgar sexual spam detected after prior warnings.',
      category: 'vulgar_sexual_spam',
      matchedTerms: collectMatches(normalized, EXPLICIT_VULGAR_SEXUAL_PATTERNS),
    };
  }

  return {
    shouldBan: false,
    reason: null,
    category: null,
    matchedTerms: [],
  };
}
