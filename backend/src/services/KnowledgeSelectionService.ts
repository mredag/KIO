import type { FollowUpContextHint } from './InstagramContextService.js';
import { normalizeTurkish } from './InstagramContextService.js';

export interface KnowledgeSelectionEntry {
  category: string;
  key_name: string;
  value: string;
  description?: string | null;
}

interface ScoredKnowledgeEntry extends KnowledgeSelectionEntry {
  score: number;
}

export interface KnowledgeSelectionResult {
  knowledgeContext: string;
  addedEntriesCount: number;
  addedCategories: string[];
}

const SUPPORT_CATEGORIES = ['faq', 'hours', 'policies'];
const STOPWORDS = new Set([
  'acaba',
  'ama',
  'artik',
  'aslinda',
  'az',
  'bana',
  'ben',
  'bir',
  'birde',
  'bu',
  'da',
  'daha',
  'de',
  'degil',
  'diye',
  'en',
  'gibi',
  'icin',
  'ile',
  'ki',
  'mi',
  'mu',
  'mı',
  'mü',
  'nasil',
  'nedir',
  'ne',
  'olur',
  'olan',
  'olarak',
  'sanki',
  'sadece',
  'seklinde',
  'son',
  'su',
  've',
  'var',
  'varmi',
  'ya',
  'yani',
]);

export class KnowledgeSelectionService {
  constructor(private entries: KnowledgeSelectionEntry[]) {}

  augmentContext(params: {
    baseContextJson: string;
    messageText: string;
    followUpHint: FollowUpContextHint | null;
    primaryCategories: Iterable<string>;
    maxEntries?: number;
  }): KnowledgeSelectionResult {
    const maxEntries = params.maxEntries ?? 2;
    const primaryCategories = new Set(
      Array.from(params.primaryCategories).map(category => category.toLowerCase()),
    );
    const candidateCategories = SUPPORT_CATEGORIES.filter(category => !primaryCategories.has(category));

    if (candidateCategories.length === 0) {
      return {
        knowledgeContext: params.baseContextJson,
        addedEntriesCount: 0,
        addedCategories: [],
      };
    }

    const queryTokens = this.buildQueryTokens(params.messageText, params.followUpHint);
    if (queryTokens.length < 2) {
      return {
        knowledgeContext: params.baseContextJson,
        addedEntriesCount: 0,
        addedCategories: [],
      };
    }

    const currentContext = this.parseContext(params.baseContextJson);
    const candidates = this.entries
      .filter(entry => candidateCategories.includes(entry.category.toLowerCase()))
      .filter(entry => !currentContext[entry.category]?.[entry.key_name]);

    const scoredEntries = candidates
      .map(entry => ({ ...entry, score: this.scoreEntry(entry, queryTokens) }))
      .filter(entry => entry.score >= 2)
      .sort((a, b) => b.score - a.score || a.category.localeCompare(b.category) || a.key_name.localeCompare(b.key_name))
      .slice(0, Math.max(0, maxEntries));

    if (scoredEntries.length === 0) {
      return {
        knowledgeContext: params.baseContextJson,
        addedEntriesCount: 0,
        addedCategories: [],
      };
    }

    const addedCategories = new Set<string>();

    for (const entry of scoredEntries) {
      if (!currentContext[entry.category]) {
        currentContext[entry.category] = {};
      }
      currentContext[entry.category][entry.key_name] = entry.value;
      addedCategories.add(entry.category);
    }

    return {
      knowledgeContext: JSON.stringify(currentContext),
      addedEntriesCount: scoredEntries.length,
      addedCategories: Array.from(addedCategories),
    };
  }

  private parseContext(rawJson: string): Record<string, Record<string, string>> {
    if (!rawJson.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }
      return parsed as Record<string, Record<string, string>>;
    } catch {
      return {};
    }
  }

  private buildQueryTokens(messageText: string, followUpHint: FollowUpContextHint | null): string[] {
    const combined = [
      messageText,
      followUpHint?.topicLabel || '',
      followUpHint?.rewrittenQuestion || '',
      followUpHint?.sourceMessage || '',
    ].filter(Boolean).join(' ');

    return this.tokenize(combined);
  }

  private scoreEntry(entry: KnowledgeSelectionEntry, queryTokens: string[]): number {
    const entryTokens = new Set(this.tokenize([entry.key_name, entry.value, entry.description || ''].join(' ')));
    const keyTokens = new Set(this.tokenize(entry.key_name));

    let overlap = 0;
    let keyOverlap = 0;

    for (const token of queryTokens) {
      if (entryTokens.has(token)) {
        overlap += 1;
      }
      if (keyTokens.has(token)) {
        keyOverlap += 1;
      }
    }

    return overlap + (keyOverlap * 2);
  }

  private tokenize(text: string): string[] {
    const normalized = normalizeTurkish(text.toLowerCase())
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .filter(token => token.length >= 2)
      .filter(token => !STOPWORDS.has(token));

    return Array.from(new Set(normalized));
  }
}
