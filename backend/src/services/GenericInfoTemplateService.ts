import { normalizeTurkish } from './InstagramContextService.js';

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
      const match = line.match(/^(\s*[\u2022\-]?\s*)([^\u2192]+?)(\s*\u2192\s*.+)$/);
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
