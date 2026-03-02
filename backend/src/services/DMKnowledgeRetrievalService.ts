import Database from 'better-sqlite3';
import type { FollowUpContextHint } from './InstagramContextService.js';

interface KnowledgeRow {
  id: string;
  category: string;
  key_name: string;
  value: string;
  description: string | null;
  updated_at: string;
}

interface IndexedDocument extends KnowledgeRow {
  vector: Map<string, number>;
}

interface PendingDocument extends KnowledgeRow {
  counts: Map<string, number>;
}

interface IndexCache {
  signature: string;
  idf: Map<string, number>;
  documents: IndexedDocument[];
}

export interface SemanticRetrievalTrace {
  enabled: boolean;
  strategy: 'sparse_tfidf_chargram';
  queryText: string;
  candidateCount: number;
  selectedEntries: Array<{
    category: string;
    keyName: string;
    score: number;
  }>;
  latencyMs: number;
  refreshedIndex: boolean;
  skippedReason: string | null;
}

export interface SemanticRetrievalCandidate {
  id: string;
  category: string;
  keyName: string;
  value: string;
  description: string | null;
  score: number;
}

export interface SemanticRetrievalResult {
  knowledgeContext: string;
  addedEntriesCount: number;
  addedCategories: string[];
  trace: SemanticRetrievalTrace;
}

export interface SemanticRetrievalCandidateResult {
  candidates: SemanticRetrievalCandidate[];
  trace: SemanticRetrievalTrace;
}

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
  'iyi',
  'gunler',
  'ki',
  'merhaba',
  'mi',
  'mu',
  'na',
  'nasil',
  'ne',
  'neden',
  'nedir',
  'o',
  'olan',
  'olarak',
  'olur',
  'peki',
  'sagol',
  'sadece',
  'sanki',
  'selam',
  'seklinde',
  'son',
  'su',
  'tamam',
  'tesekkur',
  've',
  'var',
  'varmi',
  'evet',
  'hayir',
  'ya',
  'yani',
]);

export class DMKnowledgeRetrievalService {
  private cache: IndexCache | null = null;

  constructor(private db: Database.Database) {}

  augmentContext(params: {
    baseContextJson: string;
    messageText: string;
    followUpHint: FollowUpContextHint | null;
    activeTopic: string | null;
    primaryCategories: Iterable<string>;
    maxEntries?: number;
    maxCandidates?: number;
    minScore?: number;
  }): SemanticRetrievalResult {
    const maxEntries = Math.max(0, params.maxEntries ?? 3);
    const searchResult = this.findCandidates(params);

    if (searchResult.candidates.length === 0) {
      return {
        knowledgeContext: params.baseContextJson,
        addedEntriesCount: 0,
        addedCategories: [],
        trace: searchResult.trace,
      };
    }

    const mergeResult = this.applyCandidatesToContext(
      params.baseContextJson,
      searchResult.candidates.slice(0, maxEntries),
    );

    return {
      knowledgeContext: mergeResult.knowledgeContext,
      addedEntriesCount: mergeResult.addedEntriesCount,
      addedCategories: mergeResult.addedCategories,
      trace: searchResult.trace,
    };
  }

  findCandidates(params: {
    baseContextJson: string;
    messageText: string;
    followUpHint: FollowUpContextHint | null;
    activeTopic: string | null;
    primaryCategories: Iterable<string>;
    maxCandidates?: number;
    minScore?: number;
  }): SemanticRetrievalCandidateResult {
    const startedAt = Date.now();
    const maxCandidates = Math.max(0, params.maxCandidates ?? 8);
    const minScore = params.minScore ?? 0.18;
    const queryText = this.buildQueryText(params.messageText, params.followUpHint, params.activeTopic);

    const baseTrace: SemanticRetrievalTrace = {
      enabled: true,
      strategy: 'sparse_tfidf_chargram',
      queryText,
      candidateCount: 0,
      selectedEntries: [],
      latencyMs: 0,
      refreshedIndex: false,
      skippedReason: null,
    };

    if (!queryText.trim()) {
      return {
        candidates: [],
        trace: {
          ...baseTrace,
          latencyMs: Date.now() - startedAt,
          skippedReason: 'empty_query',
        },
      };
    }

    const { index, refreshed } = this.getIndex();
    const queryVector = this.buildQueryVector(queryText, index.idf);
    if (queryVector.size === 0) {
      return {
        candidates: [],
        trace: {
          ...baseTrace,
          refreshedIndex: refreshed,
          latencyMs: Date.now() - startedAt,
          skippedReason: 'low_signal_query',
        },
      };
    }

    const currentContext = this.parseContext(params.baseContextJson);
    const blockedCategories = new Set(
      [
        ...Array.from(params.primaryCategories).map(category => category.toLowerCase()),
        ...Object.keys(currentContext).map(category => category.toLowerCase()),
      ],
    );

    const candidates = index.documents
      .filter(document => !blockedCategories.has(document.category.toLowerCase()))
      .map(document => ({
        document,
        score: this.computeCosineSimilarity(queryVector, document.vector),
      }))
      .filter(entry => entry.score >= minScore)
      .sort((a, b) =>
        b.score - a.score
        || a.document.category.localeCompare(b.document.category)
        || a.document.key_name.localeCompare(b.document.key_name),
      )
      .slice(0, maxCandidates)
      .map(({ document, score }) => ({
        id: document.id,
        category: document.category,
        keyName: document.key_name,
        value: document.value,
        description: document.description,
        score: Number(score.toFixed(4)),
      }));

    return {
      candidates,
      trace: {
        ...baseTrace,
        refreshedIndex: refreshed,
        candidateCount: candidates.length,
        selectedEntries: candidates.map(candidate => ({
          category: candidate.category,
          keyName: candidate.keyName,
          score: candidate.score,
        })),
        latencyMs: Date.now() - startedAt,
        skippedReason: candidates.length === 0 ? 'no_matches' : null,
      },
    };
  }

  applyCandidatesToContext(
    baseContextJson: string,
    candidates: SemanticRetrievalCandidate[],
  ): {
    knowledgeContext: string;
    addedEntriesCount: number;
    addedCategories: string[];
  } {
    const currentContext = this.parseContext(baseContextJson);
    const addedCategories = new Set<string>();
    let addedEntriesCount = 0;

    for (const candidate of candidates) {
      if (!currentContext[candidate.category]) {
        currentContext[candidate.category] = {};
      }

      if (currentContext[candidate.category][candidate.keyName]) {
        continue;
      }

      currentContext[candidate.category][candidate.keyName] = candidate.value;
      addedCategories.add(candidate.category);
      addedEntriesCount += 1;
    }

    return {
      knowledgeContext: JSON.stringify(currentContext),
      addedEntriesCount,
      addedCategories: Array.from(addedCategories),
    };
  }

  private getIndex(): { index: IndexCache; refreshed: boolean } {
    const signatureRow = this.db.prepare(`
      SELECT COUNT(*) as entry_count, MAX(updated_at) as max_updated_at
      FROM knowledge_base
      WHERE is_active = 1
    `).get() as { entry_count: number; max_updated_at: string | null } | undefined;

    const entryCount = signatureRow?.entry_count ?? 0;
    const maxUpdatedAt = signatureRow?.max_updated_at ?? '';
    const signature = `${entryCount}:${maxUpdatedAt}`;

    if (this.cache && this.cache.signature === signature) {
      return { index: this.cache, refreshed: false };
    }

    const rows = this.db.prepare(`
      SELECT id, category, key_name, value, description, updated_at
      FROM knowledge_base
      WHERE is_active = 1
      ORDER BY category, key_name
    `).all() as KnowledgeRow[];

    const pendingDocuments = rows.map(row => ({
      ...row,
      counts: this.buildDocumentFeatureCounts(row),
    }));

    const idf = this.buildInverseDocumentFrequency(pendingDocuments);
    const documents = pendingDocuments.map(document => ({
      id: document.id,
      category: document.category,
      key_name: document.key_name,
      value: document.value,
      description: document.description,
      updated_at: document.updated_at,
      vector: this.normalizeCounts(document.counts, idf),
    }));

    this.cache = {
      signature,
      idf,
      documents,
    };

    return {
      index: this.cache,
      refreshed: true,
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

  private buildQueryText(
    messageText: string,
    followUpHint: FollowUpContextHint | null,
    activeTopic: string | null,
  ): string {
    return [
      messageText,
      activeTopic ? `${activeTopic} ${activeTopic}` : '',
      followUpHint?.topicLabel ? `${followUpHint.topicLabel} ${followUpHint.topicLabel}` : '',
      followUpHint?.rewrittenQuestion || '',
      followUpHint?.sourceMessage || '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildDocumentFeatureCounts(row: KnowledgeRow): Map<string, number> {
    const counts = new Map<string, number>();
    this.addTextFeatures(counts, row.key_name, 3);
    this.addTextFeatures(counts, row.value, 2);
    this.addTextFeatures(counts, row.description || '', 1.25);
    return counts;
  }

  private buildQueryVector(queryText: string, idf: Map<string, number>): Map<string, number> {
    const counts = new Map<string, number>();
    this.addTextFeatures(counts, queryText, 1);

    const weighted = new Map<string, number>();
    let norm = 0;

    for (const [feature, count] of counts.entries()) {
      const inverseDocFrequency = idf.get(feature);
      if (!inverseDocFrequency) {
        continue;
      }

      const weight = (1 + Math.log(count)) * inverseDocFrequency;
      weighted.set(feature, weight);
      norm += weight * weight;
    }

    if (norm <= 0) {
      return new Map();
    }

    const divisor = Math.sqrt(norm);
    for (const [feature, weight] of weighted.entries()) {
      weighted.set(feature, weight / divisor);
    }

    return weighted;
  }

  private buildInverseDocumentFrequency(documents: PendingDocument[]): Map<string, number> {
    const frequencies = new Map<string, number>();

    for (const document of documents) {
      for (const feature of document.counts.keys()) {
        frequencies.set(feature, (frequencies.get(feature) || 0) + 1);
      }
    }

    const totalDocs = Math.max(documents.length, 1);
    const idf = new Map<string, number>();

    for (const [feature, frequency] of frequencies.entries()) {
      idf.set(feature, 1 + Math.log((1 + totalDocs) / (1 + frequency)));
    }

    return idf;
  }

  private normalizeCounts(counts: Map<string, number>, idf: Map<string, number>): Map<string, number> {
    const vector = new Map<string, number>();
    let norm = 0;

    for (const [feature, count] of counts.entries()) {
      const inverseDocFrequency = idf.get(feature);
      if (!inverseDocFrequency) {
        continue;
      }

      const weight = (1 + Math.log(count)) * inverseDocFrequency;
      vector.set(feature, weight);
      norm += weight * weight;
    }

    if (norm <= 0) {
      return vector;
    }

    const divisor = Math.sqrt(norm);
    for (const [feature, weight] of vector.entries()) {
      vector.set(feature, weight / divisor);
    }

    return vector;
  }

  private computeCosineSimilarity(left: Map<string, number>, right: Map<string, number>): number {
    if (left.size === 0 || right.size === 0) {
      return 0;
    }

    let dotProduct = 0;
    const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];

    for (const [feature, weight] of smaller.entries()) {
      const otherWeight = larger.get(feature);
      if (otherWeight) {
        dotProduct += weight * otherWeight;
      }
    }

    return dotProduct;
  }

  private addTextFeatures(target: Map<string, number>, text: string, weight: number): void {
    for (const token of this.tokenizeWords(text)) {
      this.incrementFeature(target, `w:${token}`, weight);

      if (token.length >= 4) {
        for (const gram of this.buildCharacterGrams(token)) {
          this.incrementFeature(target, `g:${gram}`, weight * 0.35);
        }
      }
    }
  }

  private tokenizeWords(text: string): string[] {
    const normalized = this.normalizeText(text);
    const matches = normalized.match(/[a-z0-9]+/g) || [];

    return matches
      .filter(token => token.length >= 2)
      .filter(token => !STOPWORDS.has(token));
  }

  private buildCharacterGrams(token: string): string[] {
    const grams: string[] = [];

    for (let index = 0; index <= token.length - 3; index += 1) {
      grams.push(token.slice(index, index + 3));
    }

    return grams;
  }

  private incrementFeature(target: Map<string, number>, key: string, amount: number): void {
    target.set(key, (target.get(key) || 0) + amount);
  }

  private normalizeText(text: string): string {
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
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ' ');
  }
}
