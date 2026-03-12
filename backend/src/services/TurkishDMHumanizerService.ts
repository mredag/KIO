import type { ConductState } from './SuspiciousUserService.js';

export interface TurkishDMHumanizerConfig {
  enabled: boolean;
  mode: 'light';
  traceEnabled: boolean;
}

export interface TurkishDMHumanizerTrace {
  enabled: boolean;
  mode: 'light';
  applied: boolean;
  ruleIds: string[];
  inputLength: number;
  outputLength: number;
}

export interface TurkishDMHumanizerResult {
  text: string;
  trace: TurkishDMHumanizerTrace;
}

const PROTECTED_PATTERNS = [
  /https?:\/\/\S+/g,
  /\+?\d{2}\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g,
  /\b\d{3,4}\s?\d{3}\s?\d{2}\s?\d{2}\b/g,
  /\b\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\b/g,
  /\b\d{1,2}:\d{2}\b/g,
  /\b\d+(?:[.,]\d+)?\s*(?:TL|tl|₺|lira)\b/gi,
  /\b\d+\s*(?:dk|dakika|saat)\b/gi,
  /\b18\+\b/g,
  /\bveli\b/gi,
  /\bebeveyn\b/gi,
];

const REDUNDANT_GREETING_PATTERN = /^(merhaba|selamlar?|iyi gunler|iyi aksamlar|iyi sabahlar|hayirli gunler)\b[\s,:;.!-]*/iu;
const SERVILE_OPENER_PATTERN = /^(tabii ki|tabii|tabi ki|tabi|elbette|memnuniyetle)\b[\s,:;.!-]*/iu;
const FACTUAL_SIGNAL_PATTERN = /\b(fiyat|ucret|ne kadar|kac|tl|lira|adres|telefon|konum|saat|acik|kapali|masaj|hamam|sauna|havuz|fitness|pilates|reformer|pt|uyelik|kurs|ders|randevu|yas|18|cocuk|ebeveyn|veli|paket|hizmet)\b/;
const EMOJI_PATTERN = /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E|(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?))*/gu;
const GENERIC_CLOSE_PATTERNS = [
  /^baska (bir )?sorunuz olursa\b/,
  /^baska (bir )?sorunuz varsa\b/,
  /^yardimci olabilecegim baska bir konu varsa\b/,
  /^dilerseniz baska konuda da yardimci olabilirim\b/,
  /^dilerseniz yardimci olabilirim\b/,
  /^her zaman yardimci olmaktan memnuniyet duyarim\b/,
  /^yardimci olmaktan memnuniyet duyarim\b/,
  /^sormak istediginiz baska (bir )?sey olursa\b/,
  /^yazabilirsiniz\b/,
];

const ROBOTIC_REPLACEMENTS = [
  { pattern: /\bbununla birlikte\b/giu, replacement: 'Ayrica' },
  { pattern: /\bbuna ek olarak\b/giu, replacement: 'Ayrica' },
  { pattern: /\bbu dogrultuda\b/giu, replacement: 'Bu nedenle' },
  { pattern: /\btarafimizca\b/giu, replacement: 'Bizim tarafimizdan' },
];

function normalizeComparison(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/\u0131/g, 'i')
    .replace(/[^\p{L}\p{N}\s:+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function maskProtectedTokens(text: string): { maskedText: string; restore: (value: string) => string } {
  const protectedValues: string[] = [];
  let maskedText = text;

  for (const pattern of PROTECTED_PATTERNS) {
    maskedText = maskedText.replace(pattern, (match) => {
      const token = `__HDM_PROTECTED_${protectedValues.length}__`;
      protectedValues.push(match);
      return token;
    });
  }

  return {
    maskedText,
    restore: (value: string) => protectedValues.reduce(
      (restored, match, index) => restored.replaceAll(`__HDM_PROTECTED_${index}__`, match),
      value,
    ),
  };
}

function splitLineIntoSegments(line: string): string[] {
  const segments = line.match(/[^.!?]+[.!?]?/g);
  return segments ? segments.map(segment => segment.trim()).filter(Boolean) : [];
}

function hasSubstantiveContent(segment: string): boolean {
  const normalized = normalizeComparison(segment);
  if (!normalized) {
    return false;
  }

  return FACTUAL_SIGNAL_PATTERN.test(normalized)
    || /\d/.test(normalized)
    || normalized.split(' ').length >= 3;
}

function isGenericCloseSegment(segment: string): boolean {
  const normalized = normalizeComparison(segment);
  return GENERIC_CLOSE_PATTERNS.some(pattern => pattern.test(normalized));
}

function limitEmojis(text: string): { text: string; changed: boolean } {
  let seenEmoji = false;
  let changed = false;

  const nextText = text.replace(EMOJI_PATTERN, (match) => {
    if (!seenEmoji) {
      seenEmoji = true;
      return match;
    }

    changed = true;
    return '';
  });

  return { text: nextText, changed };
}

function normalizeSpacing(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class TurkishDMHumanizerService {
  humanize(params: {
    text: string;
    config?: TurkishDMHumanizerConfig;
    conductState?: ConductState;
  }): TurkishDMHumanizerResult {
    const config = params.config || { enabled: false, mode: 'light', traceEnabled: false };
    const originalText = params.text || '';
    const baseTrace: TurkishDMHumanizerTrace = {
      enabled: config.enabled,
      mode: config.mode,
      applied: false,
      ruleIds: [],
      inputLength: originalText.length,
      outputLength: originalText.length,
    };

    if (!config.enabled || !originalText.trim()) {
      return { text: originalText, trace: baseTrace };
    }

    if (params.conductState && params.conductState !== 'normal') {
      return { text: originalText, trace: baseTrace };
    }

    const ruleIds = new Set<string>();
    const factualSignal = FACTUAL_SIGNAL_PATTERN.test(normalizeComparison(originalText)) || /\d/.test(originalText);
    const masked = maskProtectedTokens(originalText);
    const transformedLines = masked.maskedText
      .split('\n')
      .map((line) => {
        const segments = splitLineIntoSegments(line);
        if (segments.length === 0) {
          return [] as string[];
        }

        return segments.map((segment) => {
          let nextSegment = segment;

          if (factualSignal) {
            const trimmedGreeting = nextSegment.replace(REDUNDANT_GREETING_PATTERN, '');
            if (trimmedGreeting !== nextSegment) {
              nextSegment = trimmedGreeting.trim();
              ruleIds.add('trim_redundant_greeting');
            }
          }

          const trimmedOpener = nextSegment.replace(SERVILE_OPENER_PATTERN, '');
          if (trimmedOpener !== nextSegment) {
            nextSegment = trimmedOpener.trim();
            ruleIds.add('trim_servile_opener');
          }

          return nextSegment;
        }).filter(Boolean);
      });

    const substantiveCount = transformedLines
      .flat()
      .filter(segment => !isGenericCloseSegment(segment))
      .filter(segment => hasSubstantiveContent(segment))
      .length;

    const withoutGenericClose = transformedLines.map((segments) => {
      if (segments.length === 0) {
        return [];
      }

      return segments.filter((segment) => {
        if (substantiveCount === 0 || !isGenericCloseSegment(segment)) {
          return true;
        }

        ruleIds.add('trim_generic_close');
        return false;
      });
    });

    let nextText = withoutGenericClose
      .map(segments => segments.join(' ').trim())
      .filter(Boolean)
      .join('\n');

    for (const replacement of ROBOTIC_REPLACEMENTS) {
      const replaced = nextText.replace(replacement.pattern, replacement.replacement);
      if (replaced !== nextText) {
        nextText = replaced;
        ruleIds.add('soften_robotic_connector');
      }
    }

    const emojiResult = limitEmojis(nextText);
    if (emojiResult.changed) {
      nextText = emojiResult.text;
      ruleIds.add('limit_emoji');
    }

    const unmaskedText = masked.restore(nextText);
    const normalizedText = normalizeSpacing(unmaskedText);
    if (normalizedText !== unmaskedText) {
      ruleIds.add('normalize_spacing');
    }

    const applied = normalizedText !== originalText;

    return {
      text: applied ? normalizedText : originalText,
      trace: {
        enabled: config.enabled,
        mode: config.mode,
        applied,
        ruleIds: Array.from(ruleIds),
        inputLength: originalText.length,
        outputLength: (applied ? normalizedText : originalText).length,
      },
    };
  }
}
