import type { FollowUpContextHint } from './InstagramContextService.js';
import type { SemanticRetrievalCandidate } from './DMKnowledgeRetrievalService.js';

const RERANK_MODEL = 'google/gemini-2.5-flash-lite';

export interface SemanticRerankTrace {
  enabled: boolean;
  modelId: string;
  candidateCount: number;
  selectedCount: number;
  selectedEntries: Array<{
    category: string;
    keyName: string;
    score: number;
  }>;
  latencyMs: number;
  skippedReason: string | null;
  rationale: string | null;
}

export interface SemanticRerankResult {
  selectedCandidates: SemanticRetrievalCandidate[];
  trace: SemanticRerankTrace;
}

export function formatSelectedEvidenceBlock(candidates: SemanticRetrievalCandidate[]): string {
  if (candidates.length === 0) {
    return '';
  }

  return candidates.map(candidate => {
    const parts = [
      `[${candidate.category}] ${candidate.keyName}`,
      candidate.value,
    ];

    if (candidate.description) {
      parts.push(`Aciklama: ${candidate.description}`);
    }

    return parts.join('\n');
  }).join('\n\n');
}

export class DMKnowledgeRerankerService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  async rerank(params: {
    messageText: string;
    followUpHint: FollowUpContextHint | null;
    activeTopic: string | null;
    requestedCategories: string[];
    candidates: SemanticRetrievalCandidate[];
    maxSelections?: number;
  }): Promise<SemanticRerankResult> {
    const startedAt = Date.now();
    const maxSelections = Math.max(0, params.maxSelections ?? 3);
    const baseTrace: SemanticRerankTrace = {
      enabled: true,
      modelId: this.apiKey ? RERANK_MODEL : 'disabled',
      candidateCount: params.candidates.length,
      selectedCount: 0,
      selectedEntries: [],
      latencyMs: 0,
      skippedReason: null,
      rationale: null,
    };

    if (params.candidates.length === 0 || maxSelections === 0) {
      return {
        selectedCandidates: [],
        trace: {
          ...baseTrace,
          latencyMs: Date.now() - startedAt,
          skippedReason: params.candidates.length === 0 ? 'no_candidates' : 'max_zero',
        },
      };
    }

    if (!this.shouldRunRerank(params)) {
      const selected = this.fallbackSelect(params.candidates, maxSelections);
      return {
        selectedCandidates: selected,
        trace: {
          ...baseTrace,
          modelId: this.apiKey ? RERANK_MODEL : 'disabled',
          selectedCount: selected.length,
          selectedEntries: this.toTraceEntries(selected),
          latencyMs: Date.now() - startedAt,
          skippedReason: 'simple_case',
          rationale: 'Tek veya acik durum; ek LLM rerank atlandi.',
        },
      };
    }

    if (!this.apiKey) {
      const selected = this.fallbackSelect(params.candidates, maxSelections);
      return {
        selectedCandidates: selected,
        trace: {
          ...baseTrace,
          selectedCount: selected.length,
          selectedEntries: this.toTraceEntries(selected),
          latencyMs: Date.now() - startedAt,
          skippedReason: 'no_api_key',
          rationale: 'API anahtari yok; skor bazli siralama kullanildi.',
        },
      };
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'Eform DM KB Reranker',
        },
        body: JSON.stringify({
          model: RERANK_MODEL,
          messages: [
            { role: 'system', content: 'Only return valid JSON.' },
            { role: 'user', content: this.buildPrompt(params, maxSelections) },
          ],
          temperature: 0,
          max_tokens: 250,
          response_format: {
            type: 'json_object',
          },
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const selected = this.fallbackSelect(params.candidates, maxSelections);
        return {
          selectedCandidates: selected,
          trace: {
            ...baseTrace,
            selectedCount: selected.length,
            selectedEntries: this.toTraceEntries(selected),
            latencyMs: Date.now() - startedAt,
            skippedReason: `api_error_${response.status}`,
            rationale: 'Rerank API hatasi; skor bazli secim kullanildi.',
          },
        };
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const parsed = JSON.parse(this.extractJsonText(content)) as {
        selectedIds?: unknown;
        rationale?: unknown;
      };

      const selectedIds = Array.isArray(parsed.selectedIds)
        ? parsed.selectedIds.map(value => String(value).trim()).filter(Boolean)
        : [];
      const byId = new Map(params.candidates.map(candidate => [candidate.id, candidate]));
      const selectedCandidates = selectedIds
        .map(id => byId.get(id))
        .filter((candidate): candidate is SemanticRetrievalCandidate => !!candidate)
        .slice(0, maxSelections);

      const finalSelection = selectedCandidates.length > 0
        ? selectedCandidates
        : [];

      return {
        selectedCandidates: finalSelection,
        trace: {
          ...baseTrace,
          selectedCount: finalSelection.length,
          selectedEntries: this.toTraceEntries(finalSelection),
          latencyMs: Date.now() - startedAt,
          rationale: String(parsed.rationale ?? '').trim() || null,
          skippedReason: null,
        },
      };
    } catch {
      const selected = this.fallbackSelect(params.candidates, maxSelections);
      return {
        selectedCandidates: selected,
        trace: {
          ...baseTrace,
          selectedCount: selected.length,
          selectedEntries: this.toTraceEntries(selected),
          latencyMs: Date.now() - startedAt,
          skippedReason: 'parse_or_network_error',
          rationale: 'Rerank yaniti kullanilamadi; skor bazli secim kullanildi.',
        },
      };
    }
  }

  private shouldRunRerank(params: {
    followUpHint: FollowUpContextHint | null;
    activeTopic: string | null;
    requestedCategories: string[];
    candidates: SemanticRetrievalCandidate[];
  }): boolean {
    if (params.candidates.length > 1) {
      return true;
    }

    if (params.followUpHint || params.activeTopic) {
      return true;
    }

    const requested = new Set(params.requestedCategories);
    return requested.has('pricing') || requested.has('hours') || requested.has('policies');
  }

  private buildPrompt(
    params: {
      messageText: string;
      followUpHint: FollowUpContextHint | null;
      activeTopic: string | null;
      requestedCategories: string[];
      candidates: SemanticRetrievalCandidate[];
    },
    maxSelections: number,
  ): string {
    const activeTopic = params.followUpHint?.topicLabel || params.activeTopic || null;

    return [
      'Sen bir bilgi secim reranker ajanisin.',
      'Amac: Mevcut musteri sorusunu yanitlamaya dogrudan yardim eden EK bilgi adaylarini secmek.',
      'Bu adaylar zaten ana bilgi kategorileri DISINDA kalan destek girisleridir.',
      'Yalnizca musteri sorusuna dogrudan yardim eden adaylari sec.',
      'Genis, alakasiz, cok genel veya sadece dolayli faydali adaylari secme.',
      'Eger hicbiri gercekten yardim etmiyorsa bos liste don.',
      'Sadece JSON don.',
      '',
      'JSON semasi:',
      `{"selectedIds":["id1","id2"],"rationale":"kisa neden"}`,
      '',
      'KURALLAR:',
      `- En fazla ${maxSelections} aday sec.`,
      '- Aktif konu varsa secimi once bu konuya gore yap.',
      '- Yalnizca musteri sorusuna cevap kurmaya yardim eden destek bilgileri sec.',
      '- Soru fiyat/saat odakliysa, sadece konu kapsaminda aciklayici destek girisleri sec; alakasiz politika metinlerini secme.',
      '- Emin degilsen bos liste daha iyidir.',
      '',
      'INPUT:',
      JSON.stringify({
        customerMessage: params.messageText,
        activeTopic,
        rewrittenQuestion: params.followUpHint?.rewrittenQuestion || null,
        requestedCategories: params.requestedCategories,
        candidates: params.candidates.map(candidate => ({
          id: candidate.id,
          category: candidate.category,
          keyName: candidate.keyName,
          score: candidate.score,
          value: candidate.value,
          description: candidate.description,
        })),
      }, null, 2),
    ].join('\n');
  }

  private fallbackSelect(candidates: SemanticRetrievalCandidate[], maxSelections: number): SemanticRetrievalCandidate[] {
    return candidates.slice(0, maxSelections);
  }

  private toTraceEntries(candidates: SemanticRetrievalCandidate[]): Array<{
    category: string;
    keyName: string;
    score: number;
  }> {
    return candidates.map(candidate => ({
      category: candidate.category,
      keyName: candidate.keyName,
      score: candidate.score,
    }));
  }

  private extractJsonText(rawContent: string): string {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed;
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return match[0];
    }

    return trimmed;
  }
}
