import Database from 'better-sqlite3';
import { ConversationStateService } from './ConversationStateService.js';
import type { ConversationStateRecord } from './ConversationStateService.js';
import { hasAgePolicySignals } from './PolicySignalService.js';
import { hasRoomAvailabilitySignals } from './RoomAvailabilitySignalService.js';

/**
 * Normalize Turkish diacritical characters to ASCII equivalents.
 * This ensures keyword matching works regardless of whether the user
 * types "ücret" or "ucret", "çalışma" or "calisma", etc.
 */
export function normalizeTurkish(text: string): string {
  return text
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ı/g, 'i').replace(/İ/g, 'i');
}
export const KEYWORD_CATEGORY_MAP: Record<string, string[]> = {
  services: ['masaj', 'massage', 'spa', 'hamam', 'sauna', 'buhar', 'fitness',
             'pilates', 'reformer', 'yuzme', 'havuz', 'taekwondo', 'jimnastik',
             'kickboks', 'boks', 'pt', 'personal', 'trainer', 'kurs', 'ders',
             'hizmet', 'servis', 'uyelik', 'membership'],
  pricing: ['fiyat', 'ucret', 'para', 'tl', 'lira', 'kampanya', 'indirim',
            'paket', 'aylik', 'yillik', 'ne kadar', 'kac lira', 'kac tl',
            'price', 'cost'],
  hours: ['saat', 'acik', 'kapali', 'calisma', 'program', 'gun', 'hafta',
          'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi',
          'pazar', 'kacta', 'kaca kadar', 'ne zaman', 'schedule'],
  policies: ['iptal', 'kural', 'yas', 'cocuk', 'ceza', 'politika', 'odeme',
             'nakit', 'kredi', 'kart', 'taksit', 'havlu', 'sort', 'bone',
             'getir', 'yaninda'],
  contact: ['adres', 'nerede', 'konum', 'harita', 'telefon', 'numara',
            'ara', 'iletisim', 'ulasim', 'yol', 'tarif', 'maps', 'address'],
  faq: ['randevu', 'rezervasyon', 'nasil', 'terapist', 'kadin', 'erkek',
        'sicaklik', 'derece', 'havuz sicak', 'pt var mi', 'ne getir'],
};
export interface ConversationEntry {
  direction: 'inbound' | 'outbound';
  messageText: string;
  createdAt: string;
  relativeTime: string;
}

export interface IntentResult {
  categories: string[];
  keywords: string[];
}

export interface FollowUpContextHint {
  topicLabel: string;
  rewrittenQuestion: string;
  sourceMessage: string;
}

export type ResponseMode = 'answer_directly' | 'answer_then_clarify' | 'clarify_only';

export interface ResponseDirective {
  mode: ResponseMode;
  instruction: string;
  rationale: string;
}

export interface ContextualIntentResult extends IntentResult {
  followUpHint: FollowUpContextHint | null;
  responseDirective: ResponseDirective;
}

export const MODEL_CONFIG = {
  light: {
    modelId: 'openai/gpt-4.1-mini',
    patterns: ['merhaba', 'selam', 'hey', 'iyi gunler', 'hosca kal',
               'tesekkur', 'sagol', 'tamam', 'ok', 'evet', 'hayir'],
    singleCategoryMatch: ['hours', 'contact', 'services', 'pricing', 'faq'] as string[],
  },
  standard: {
    modelId: 'openai/gpt-4o-mini',
  },
  advanced: {
    modelId: 'openai/gpt-4o-mini',
    patterns: ['sikayet', 'memnun degil', 'kotu', 'berbat', 'rezalet',
               'iade', 'geri', 'sorun', 'problem', 'complaint'],
    minLength: 200,
  },
};

export type ModelTier = 'light' | 'standard' | 'advanced';

export interface ModelTierResult {
  tier: ModelTier;
  modelId: string;
  reason: string; // Turkish human-readable reason
}


export interface MessageAnalysis {
  conversationHistory: ConversationEntry[];
  formattedHistory: string;
  intentCategories: string[];
  matchedKeywords: string[];  // AI semantic signals (legacy field name kept for compatibility)
  followUpHint: FollowUpContextHint | null;
  activeTopicLabel: string | null;
  conversationState: {
    activeTopic: string;
    activeTopicConfidence: number;
    topicSourceMessage: string | null;
    expiresAt: string;
    usedForPlanning: boolean;
    repairedFromState: boolean;
  } | null;
  responseDirective: ResponseDirective;
  tierReason: string;         // from classifyModelTier
  modelTier: ModelTier;
  modelId: string;
  isNewCustomer: boolean;
  totalInteractions: number;  // all-time count for customer summary
}

interface AIContextPlan extends ContextualIntentResult {
  tier: ModelTier;
  tierReason: string;
  topicSummary: string | null;
  stateRepairApplied: boolean;
}

interface ContextDependency {
  dependsOnPriorTopic: boolean;
  topicLabel: string | null;
  sourceMessage: string | null;
  rationale: string;
}

const VALID_INTENT_CATEGORIES = new Set(['services', 'pricing', 'hours', 'policies', 'contact', 'faq', 'general']);
const VALID_RESPONSE_MODES = new Set<ResponseMode>(['answer_directly', 'answer_then_clarify', 'clarify_only']);
const DEFAULT_RESPONSE_DIRECTIVE: ResponseDirective = {
  mode: 'answer_directly',
  instruction: 'Bu mesaji bagimsiz bir soru olarak ele al. Bildigin net bilgiyi dogrudan ver. Gerekirse en fazla bir kisa netlestirme sorusu sor.',
  rationale: 'Varsayilan guvenli davranis',
};
const DEFAULT_CONTEXT_DEPENDENCY: ContextDependency = {
  dependsOnPriorTopic: false,
  topicLabel: null,
  sourceMessage: null,
  rationale: 'Bagimsiz soru varsayildi',
};

/**
 * Compute Turkish relative time string from a created_at timestamp.
 * e.g., "5 dk önce", "2 saat önce", "3 gün önce"
 */
export function computeRelativeTime(createdAt: string): string {
  const now = Date.now();
  const then = new Date(createdAt).getTime();

  // If the date is invalid, return a fallback
  if (isNaN(then)) {
    return 'bilinmiyor';
  }

  const diffMs = now - then;

  // Future timestamps or very recent (< 1 minute)
  if (diffMs < 60_000) {
    return 'az önce';
  }

  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) {
    return `${diffMinutes} dk önce`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} saat önce`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${diffDays} gün önce`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} ay önce`;
}

export class InstagramContextService {
  private db: Database.Database;
  private conversationStateService: ConversationStateService;

  constructor(db: Database.Database) {
    this.db = db;
    this.conversationStateService = new ConversationStateService(db);
  }

  async analyzeMessage(senderId: string, messageText: string): Promise<MessageAnalysis> {
      try {
        const conversationHistory = this.getRecentContextWindow(this.getConversationHistory(senderId));
        const conversationState = this.conversationStateService.getState('instagram', senderId);
        const totalInteractions = this.getTotalInteractionCount(senderId);
        const formattedHistory = this.formatConversationHistory(conversationHistory);
        const contextPlan = await this.planMessageContextAI(messageText, conversationHistory, conversationState);
        const { tier: modelTier, tierReason } = contextPlan;
        const modelId = MODEL_CONFIG[modelTier].modelId;
        const isNewCustomer = totalInteractions === 0;
        const activeTopicLabel = contextPlan.followUpHint?.topicLabel
          || contextPlan.topicSummary
          || (contextPlan.stateRepairApplied ? conversationState?.activeTopic || null : null);

        return {
          conversationHistory,
          formattedHistory,
          intentCategories: contextPlan.categories,
          matchedKeywords: contextPlan.keywords,
          followUpHint: contextPlan.followUpHint,
          activeTopicLabel,
          conversationState: conversationState ? {
            activeTopic: conversationState.activeTopic,
            activeTopicConfidence: conversationState.activeTopicConfidence,
            topicSourceMessage: conversationState.topicSourceMessage,
            expiresAt: conversationState.expiresAt,
            usedForPlanning: true,
            repairedFromState: contextPlan.stateRepairApplied,
          } : null,
          responseDirective: contextPlan.responseDirective,
          tierReason,
          modelTier,
          modelId,
          isNewCustomer,
          totalInteractions,
        };
      } catch (error) {
        console.error('[InstagramContextService] analyzeMessage error:', error);
        return {
          conversationHistory: [],
          formattedHistory: '',
          intentCategories: ['general', 'faq'],
          matchedKeywords: [],
          followUpHint: null,
          activeTopicLabel: null,
          conversationState: null,
          responseDirective: DEFAULT_RESPONSE_DIRECTIVE,
          tierReason: 'Varsayılan model (hata durumu) → standard',
          modelTier: 'standard',
          modelId: MODEL_CONFIG.standard.modelId,
          isNewCustomer: true,
          totalInteractions: 0,
        };
      }
    }

  saveConversationState(
    senderId: string,
    customerMessage: string,
    assistantResponse: string,
    analysis: MessageAnalysis,
  ): void {
    const activeTopic = analysis.activeTopicLabel?.trim() || null;
    if (!activeTopic) {
      this.conversationStateService.clearState('instagram', senderId);
      return;
    }

    const confidence = analysis.followUpHint
      ? 0.95
      : analysis.conversationState?.repairedFromState
        ? 0.9
        : analysis.intentCategories.includes('services')
          ? 0.82
          : Math.max(analysis.conversationState?.activeTopicConfidence || 0.7, 0.7);

    const ttlMinutes = analysis.followUpHint ? 15 : 12;
    const previousActiveTopic = analysis.conversationState?.activeTopic
      ? normalizeTurkish(analysis.conversationState.activeTopic.toLowerCase())
      : null;
    const currentActiveTopic = normalizeTurkish(activeTopic.toLowerCase());
    const activeTopicChanged = previousActiveTopic !== currentActiveTopic;
    const shouldResetTopicSource = !analysis.followUpHint
      && (activeTopicChanged || analysis.intentCategories.includes('services'));
    const topicSourceMessage = shouldResetTopicSource
      ? customerMessage
      : analysis.followUpHint?.sourceMessage
        || analysis.conversationState?.topicSourceMessage
        || customerMessage;

    this.conversationStateService.saveState({
      channel: 'instagram',
      customerId: senderId,
      activeTopic,
      activeTopicConfidence: confidence,
      topicSourceMessage,
      lastQuestionType: this.classifyConversationQuestionType(analysis),
      pendingCategories: analysis.intentCategories,
      lastCustomerMessage: customerMessage,
      lastAssistantMessage: assistantResponse,
      ttlMinutes,
    });
  }

  private classifyConversationQuestionType(analysis: MessageAnalysis): string {
    if (analysis.followUpHint) {
      return 'follow_up';
    }

    if (this.isModifierOnlyRequest(analysis.intentCategories)) {
      return 'modifier_only';
    }

    if (analysis.intentCategories.includes('services')) {
      return 'service_topic';
    }

    if (analysis.intentCategories.length > 1) {
      return 'multi_intent';
    }

    return analysis.intentCategories[0] || 'general';
  }


  getConversationHistory(senderId: string, limit: number = 20): ConversationEntry[] {
    try {
      // Fetch messages from the last 24 hours — enough context for follow-ups
      const rows = this.db.prepare(`
        SELECT direction, message_text, created_at
        FROM instagram_interactions
        WHERE instagram_id = ?
          AND created_at >= datetime('now', '-24 hours')
        ORDER BY created_at DESC
        LIMIT ?
      `).all(senderId, limit) as { direction: 'inbound' | 'outbound'; message_text: string; created_at: string }[];

      // Reverse to get chronological order (oldest first)
      const entries = rows.reverse().map(row => ({
        direction: row.direction,
        messageText: row.message_text,
        createdAt: row.created_at,
        relativeTime: computeRelativeTime(row.created_at),
      }));

      return this.dedupeHistoryEntries(entries);
    } catch (error) {
      console.error('[InstagramContextService] getConversationHistory error:', error);
      return [];
    }
  }

  /**
   * Get total interaction count for a sender (all time).
   * Used to provide a brief summary instead of loading old messages.
   */
  getTotalInteractionCount(senderId: string): number {
    try {
      const row = this.db.prepare(`
        SELECT COUNT(*) as c FROM instagram_interactions WHERE instagram_id = ?
      `).get(senderId) as { c: number };
      return row.c;
    } catch {
      return 0;
    }
  }

  formatConversationHistory(entries: ConversationEntry[], maxChars: number = 2000): string {
    if (entries.length === 0) {
      return '';
    }

    const formatEntry = (entry: ConversationEntry): string => {
      const label = entry.direction === 'inbound' ? 'müşteri' : 'asistan';
      return `[${entry.relativeTime}] ${label}: ${entry.messageText}`;
    };

    // Format all entries and join
    const allLines = entries.map(formatEntry);
    const fullText = allLines.join('\n');

    if (fullText.length <= maxChars) {
      return fullText;
    }

    // Truncation: always preserve the last 5 entries (or all if fewer than 5)
    const preserveCount = Math.min(5, entries.length);
    const preservedLines = allLines.slice(-preserveCount);

    // Start with preserved lines, try adding older entries from newest to oldest
    const olderLines = allLines.slice(0, -preserveCount);
    const resultLines = [...preservedLines];

    for (let i = olderLines.length - 1; i >= 0; i--) {
      const candidate = [olderLines[i], ...resultLines].join('\n');
      if (candidate.length <= maxChars) {
        resultLines.unshift(olderLines[i]);
      } else {
        break;
      }
    }

    const result = resultLines.join('\n');

    // If even the preserved lines exceed maxChars, truncate from the beginning
    if (result.length > maxChars) {
      return result.slice(result.length - maxChars);
    }

    return result;
  }

  private dedupeHistoryEntries(entries: ConversationEntry[]): ConversationEntry[] {
    const deduped: ConversationEntry[] = [];

    for (const entry of entries) {
      const previous = deduped[deduped.length - 1];
      const isExactDuplicate = previous
        && previous.direction === entry.direction
        && previous.messageText === entry.messageText
        && previous.createdAt === entry.createdAt;

      if (!isExactDuplicate) {
        deduped.push(entry);
      }
    }

    return deduped;
  }

  private getRecentContextWindow(history: ConversationEntry[], limit: number = 8, maxAgeMinutes: number = 10): ConversationEntry[] {
    const dedupedHistory = this.dedupeHistoryEntries(history);
    const cutoffMs = Date.now() - (maxAgeMinutes * 60 * 1000);
    const recentHistory = dedupedHistory.filter(entry => {
      const timestamp = new Date(entry.createdAt).getTime();
      return !Number.isNaN(timestamp) && timestamp >= cutoffMs;
    });

    if (recentHistory.length === 0) {
      return [];
    }

    if (recentHistory.length <= limit) {
      return recentHistory;
    }

    return recentHistory.slice(-limit);
  }

  private buildContextPlannerPrompt(
    messageText: string,
    history: ConversationEntry[],
    conversationState: ConversationStateRecord | null,
  ): string {
    const payload = {
      currentMessage: messageText,
      recentHistory: this.getRecentContextWindow(history).map(entry => ({
        direction: entry.direction,
        messageText: entry.messageText,
        relativeTime: entry.relativeTime,
      })),
      activeConversationState: conversationState ? {
        activeTopic: conversationState.activeTopic,
        confidence: conversationState.activeTopicConfidence,
        sourceMessage: conversationState.topicSourceMessage,
        lastQuestionType: conversationState.lastQuestionType,
        pendingCategories: conversationState.pendingCategories,
        lastCustomerMessage: conversationState.lastCustomerMessage,
        lastAssistantMessage: conversationState.lastAssistantMessage,
      } : null,
    };

    return [
      'Sen bir Instagram DM icin hizli ve guvenilir yanit plani ureten Turkce analiz motorusun.',
      'Gorevin, yanit uretecek modele yapisal bir karar paketi hazirlamak.',
      '',
      'Her zaman asagidaki alanlari doldur:',
      '- categories: Yanit icin gereken bilgi kategorileri. Gecerli degerler: services, pricing, hours, policies, contact, faq, general',
      '- semanticSignals: Literal keyword degil, kisa semantik niyet etiketleri',
      '- topicSummary: Mevcut mesajin asil is konusunu tanimlayan kisa konu etiketi (ornegin "reformer pilates", "masaj hizmeti"). Belirsizse null.',
      '- contextDependency: { dependsOnPriorTopic, topicLabel, sourceMessage, rationale }',
      '- responseDirective.mode: answer_directly, answer_then_clarify, clarify_only',
      '- responseDirective.instruction: Yanit modeline verilecek kisa operasyon talimati',
      '- responseDirective.rationale: Neden bu davranis secildi',
      '- tier: light, standard, advanced',
      '- tierReason: Tier seciminin kisa nedeni',
      '',
      'Zorunlu kurallar:',
      '- En yeni 1-2 mesaj en guclu baglamdir; daha eski mesajlar sadece ayni kisa konusma zincirindeyse dikkate alinmali.',
      '- activeConversationState varsa bunu siki, kompakt hafiza olarak kullan; ancak yeni mesaj acikca yeni konu aciyorsa eski durumu zorla tasima.',
      '- Konusma gecmisini sadece mevcut mesaj eksik, bagimsiz okunamayan veya acikca onceki konuya referans veren bir devam mesajiysa kullan.',
      '- Eger onceki bir spesifik hizmete dayaniyorsan contextDependency.dependsOnPriorTopic=true olmalidir.',
      '- contextDependency.dependsOnPriorTopic=true ise categories MUTLAKA services icermeli, topicLabel bos olamaz, sourceMessage o baglami kuran onceki musteri mesaji olmalidir.',
      '- Onceki konuyu sadece responseDirective icinde gizli sekilde anlatma; bagimliligi contextDependency alaninda acikca yaz.',
      '- Onceki asistan yanitinda "net bilgi veremiyorum", "arayin" veya benzeri belirsizlik gecse bile bunu yeni talimat gibi tekrar etme; mevcut mesaji ve gereken bilgi kategorilerini oncele.',
      '- Mesaj spesifik bir hizmet veya konu belirtiyorsa topicSummary bunu kisa ve dogal sekilde belirtmelidir.',
      '- Mesaj fiyat + saat gibi birden fazla genis niyet iceriyorsa, net bir referans yoksa bunu yeni bir soru olarak ele al.',
      '- Belirsiz durumda spesifik hizmet uydurma, eski konuyu zorla tasima.',
      '- Mesaj masaj/spa baglaminda sure, uzun sureli, kisa sureli, dk veya seans gibi bir tercih belirtiyorsa categories pricing de icermeli; sure secenekleri fiyat listesiyle birlikte dusunulmeli.',
      '- Mesaj yas, 18+, cocuk, veli veya ebeveyn izni soruyorsa categories MUTLAKA policies icermeli; aktif konu olsa bile policy bilgisini atlama.',
      '- Mumsen cevaplanabilen kismi cevaplat; sadece gerekli ise sonunda tek bir kisa netlestirme sorusu oner.',
      '- Yanit sadece gecerli JSON olsun.',
      '',
      'JSON semasi ornegi:',
      '{',
      '  "categories": ["services", "pricing", "hours"],',
      '  "semanticSignals": ["recent_follow_up", "topic_specific_info_request"],',
      '  "topicSummary": "taekwondo dersleri",',
      '  "contextDependency": {',
      '    "dependsOnPriorTopic": true,',
      '    "topicLabel": "taekwondo dersleri",',
      '    "sourceMessage": "taekwondo dersleri ?",',
      '    "rationale": "Mevcut mesaj kisa ve onceki hizmet sorusunun devamidir."',
      '  },',
      '  "responseDirective": {',
      '    "mode": "answer_then_clarify",',
      '    "instruction": "Aktif konu olarak taekwondo derslerini ele al. Bildigin fiyat ve saat bilgisini ver; eksikse sadece gerekli kisim icin netlestir.",',
      '    "rationale": "Baglam onceki mesajdan net olarak geliyor."',
      '  },',
      '  "tier": "standard",',
      '  "tierReason": "Baglama dayali standart bilgi talebi"',
      '}',
      '',
      'INPUT:',
      JSON.stringify(payload, null, 2),
    ].join('\n');
  }

  private extractJsonText(rawContent: string): string {
    const trimmed = rawContent.trim();
    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }

    return trimmed;
  }

  private normalizeCategories(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return ['general', 'faq'];
    }

    const categories = value
      .map(item => String(item).trim().toLowerCase())
      .filter(category => VALID_INTENT_CATEGORIES.has(category));

    const deduped = [...new Set(categories)];
    return deduped.length > 0 ? deduped : ['general', 'faq'];
  }

  private normalizeSemanticSignals(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const signals = value
      .map(item => String(item).trim().toLowerCase())
      .filter(Boolean)
      .map(signal => signal.replace(/\s+/g, '_'));

    return [...new Set(signals)].slice(0, 8);
  }

  private normalizeTopicSummary(value: unknown, contextDependency: ContextDependency): string | null {
    const topicSummary = String(value ?? '').trim();
    if (topicSummary) {
      return topicSummary.slice(0, 80);
    }

    return contextDependency.dependsOnPriorTopic ? contextDependency.topicLabel : null;
  }

  private normalizeContextDependency(value: unknown): ContextDependency {
    if (!value || typeof value !== 'object') {
      return DEFAULT_CONTEXT_DEPENDENCY;
    }

    const raw = value as Record<string, unknown>;
    const dependsOnPriorTopic = Boolean(raw.dependsOnPriorTopic);
    const topicLabel = String(raw.topicLabel ?? '').trim() || null;
    const sourceMessage = String(raw.sourceMessage ?? '').trim() || null;
    const rationale = String(raw.rationale ?? '').trim() || DEFAULT_CONTEXT_DEPENDENCY.rationale;

    if (!dependsOnPriorTopic || !topicLabel || !sourceMessage) {
      return {
        dependsOnPriorTopic: false,
        topicLabel: null,
        sourceMessage: null,
        rationale,
      };
    }

    return {
      dependsOnPriorTopic: true,
      topicLabel,
      sourceMessage,
      rationale,
    };
  }

  private normalizeFollowUpHint(value: unknown): FollowUpContextHint | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const raw = value as Record<string, unknown>;
    const topicLabel = String(raw.topicLabel ?? '').trim();
    const rewrittenQuestion = String(raw.rewrittenQuestion ?? '').trim();
    const sourceMessage = String(raw.sourceMessage ?? '').trim();

    if (!topicLabel || !rewrittenQuestion || !sourceMessage) {
      return null;
    }

    return {
      topicLabel,
      rewrittenQuestion,
      sourceMessage,
    };
  }

  private buildDerivedFollowUpHint(messageText: string, contextDependency: ContextDependency): FollowUpContextHint | null {
    if (!contextDependency.dependsOnPriorTopic || !contextDependency.topicLabel || !contextDependency.sourceMessage) {
      return null;
    }

    const cleanedMessage = messageText.trim().replace(/\s+/g, ' ');
    if (!cleanedMessage) {
      return null;
    }

    return {
      topicLabel: contextDependency.topicLabel,
      rewrittenQuestion: `${contextDependency.topicLabel} icin ${cleanedMessage}`,
      sourceMessage: contextDependency.sourceMessage,
    };
  }

  private applyContextDependencyToCategories(categories: string[], contextDependency: ContextDependency): string[] {
    const deduped = [...new Set(categories)];

    if (contextDependency.dependsOnPriorTopic && !deduped.includes('services')) {
      deduped.unshift('services');
    }

    return deduped.length > 0 ? deduped : ['general', 'faq'];
  }

  private applyContextDependencyToDirective(
    responseDirective: ResponseDirective,
    contextDependency: ContextDependency,
  ): ResponseDirective {
    if (!contextDependency.dependsOnPriorTopic || !contextDependency.topicLabel) {
      return responseDirective;
    }

    const anchoredInstruction = responseDirective.instruction.includes(contextDependency.topicLabel)
      ? responseDirective.instruction
      : `Aktif konu: ${contextDependency.topicLabel}. ${responseDirective.instruction}`;

    const anchoredRationale = responseDirective.rationale.includes(contextDependency.topicLabel)
      ? responseDirective.rationale
      : `${responseDirective.rationale} Aktif konu onceki mesajdan: ${contextDependency.topicLabel}.`;

    return {
      ...responseDirective,
      instruction: anchoredInstruction,
      rationale: anchoredRationale,
    };
  }

  private buildGroundedFollowUpDirectiveInstruction(topicLabel: string, categories: string[]): string {
    const wantsPricing = categories.includes('pricing');
    const wantsHours = categories.includes('hours');
    const wantsPolicies = categories.includes('policies');
    const wantsContact = categories.includes('contact');

    const requestedFacts: string[] = [];
    if (wantsPricing) requestedFacts.push('fiyat');
    if (wantsHours) requestedFacts.push('saat');
    if (wantsPolicies) requestedFacts.push('kural');
    if (wantsContact) requestedFacts.push('iletisim');

    const factSummary = requestedFacts.length > 0
      ? requestedFacts.join(' ve ')
      : 'istenen';

    return `Aktif konu: ${topicLabel}. Verilen bilgilerde ${topicLabel} icin net ${factSummary} bilgisi varsa once onu dogrudan ver. Sadece istenen detay verilen bilgilerde acikca yoksa kisa netlestirme yap veya telefonla teyit oner.`;
  }

  private applyGroundedFollowUpGuard(plan: AIContextPlan): void {
    if (!plan.followUpHint) {
      return;
    }

    const hasFactualFollowUp = plan.categories.some(category =>
      ['pricing', 'hours', 'policies', 'contact'].includes(category),
    );
    if (!hasFactualFollowUp) {
      return;
    }

    const normalizedInstruction = normalizeTurkish(plan.responseDirective.instruction.toLowerCase());
    const repeatsOldUncertainty = normalizedInstruction.includes('onceki mesaj')
      || normalizedInstruction.includes('verilemedigi')
      || normalizedInstruction.includes('tekrar telefon')
      || normalizedInstruction.includes('tekrar vererek');
    const forcesRedirection = normalizedInstruction.includes('telefon')
      || normalizedInstruction.includes('aray')
      || normalizedInstruction.includes('yonlendir');

    if (!repeatsOldUncertainty && !forcesRedirection) {
      return;
    }

    plan.responseDirective = {
      mode: plan.responseDirective.mode === 'clarify_only' ? 'answer_then_clarify' : plan.responseDirective.mode,
      instruction: this.buildGroundedFollowUpDirectiveInstruction(plan.followUpHint.topicLabel, plan.categories),
      rationale: `Aktif konu belli. Onceki yanittaki belirsizlik tekrar edilmemeli; guncel verilen bilgiler once kullanilmali.`,
    };
  }

  private applyPolicyPrioritySignals(plan: AIContextPlan, messageText: string): void {
    const shouldPrioritizePolicies = hasAgePolicySignals(
      messageText,
      plan.followUpHint?.rewrittenQuestion,
      plan.followUpHint?.topicLabel,
      plan.topicSummary,
    );
    if (!shouldPrioritizePolicies) {
      return;
    }

    if (!plan.categories.includes('policies')) {
      plan.categories = ['policies', ...plan.categories];
    }

    if (!plan.keywords.includes('policy_age_signal')) {
      plan.keywords.push('policy_age_signal');
    }

    const normalizedInstruction = normalizeTurkish(plan.responseDirective.instruction.toLowerCase());
    if (!normalizedInstruction.includes('yas') && !normalizedInstruction.includes('18')) {
      plan.responseDirective = {
        ...plan.responseDirective,
        instruction: `${plan.responseDirective.instruction} Yas, 18+ ve ebeveyn/veli kurali soruluyorsa verilen politikalari acikca kontrol et; belgesiz sekilde "yas siniri yok" deme.`.trim(),
        rationale: `${plan.responseDirective.rationale} Yas/minor sinyali oldugu icin policy bilgisi zorunlu.`,
      };
    }
  }

  private applyMassagePricingSignals(plan: AIContextPlan, messageText: string): void {
    const normalizedMessage = normalizeTurkish(messageText.toLowerCase());
    const normalizedTopic = normalizeTurkish([
      plan.followUpHint?.topicLabel || '',
      plan.followUpHint?.rewrittenQuestion || '',
      plan.topicSummary || '',
    ].join(' ').toLowerCase());

    const mentionsMassageContext = /\b(?:masaj|massage|spa|hamam|kese|kopuk|medikal|sicak tas|mix)\b/.test(
      `${normalizedMessage} ${normalizedTopic}`,
    );
    if (!mentionsMassageContext) {
      return;
    }

    const hasDurationSignal = /\b(?:uzun|kisa)\s*sure(?:li)?\b/.test(normalizedMessage)
      || /\b(?:sure|sureli|dakika|dk|seans)\b/.test(normalizedMessage)
      || /\b\d+\s*(?:dk|dakika)\b/.test(normalizedMessage)
      || plan.keywords.includes('duration_specific');
    if (!hasDurationSignal) {
      return;
    }

    if (!plan.categories.includes('pricing')) {
      plan.categories = ['pricing', ...plan.categories];
    }

    if (!plan.keywords.includes('massage_duration_pricing_signal')) {
      plan.keywords.push('massage_duration_pricing_signal');
    }

    const normalizedInstruction = normalizeTurkish(plan.responseDirective.instruction.toLowerCase());
    if (!normalizedInstruction.includes('fiyat')) {
      plan.responseDirective = {
        ...plan.responseDirective,
        instruction: `${plan.responseDirective.instruction} Masaj suresi veya uzun/kisa secenek soruluyorsa ilgili fiyat bilgisini de kullan; fiyat listesi varsa sure seceneklerini onunla eslestir.`.trim(),
        rationale: `${plan.responseDirective.rationale} Masaj sure/sureli sinyali fiyat bilgisini gerektiriyor.`,
      };
    }
  }

  private applyRoomAvailabilitySignals(plan: AIContextPlan, messageText: string): void {
    const shouldPrioritizeRoomFaq = hasRoomAvailabilitySignals(
      messageText,
      plan.followUpHint?.rewrittenQuestion,
      plan.followUpHint?.topicLabel,
      plan.topicSummary,
    ) || plan.keywords.includes('room_availability_inquiry');

    if (!shouldPrioritizeRoomFaq) {
      return;
    }

    if (!plan.categories.includes('faq')) {
      plan.categories = ['faq', ...plan.categories];
    }

    if (!plan.keywords.includes('room_availability_signal')) {
      plan.keywords.push('room_availability_signal');
    }

    const normalizedInstruction = normalizeTurkish(plan.responseDirective.instruction.toLowerCase());
    if (plan.responseDirective.mode === 'clarify_only'
      || normalizedInstruction.includes('netlestir')
      || normalizedInstruction.includes('bilgi iste')
      || normalizedInstruction.includes('var mi diye sor')) {
      plan.responseDirective = {
        mode: 'answer_directly',
        instruction: 'Masaj odasi secenekleri soruluyorsa verilen FAQ bilgisini dogrudan kullan. Tek kisilik ve iki kisilik oda oldugunu net soyle. Cift olarak masaj yaptirmak isteyenler icin iki kisilik oda oldugunu acikca belirt. Bu soruyu musteriye geri sorma.',
        rationale: 'Oda secenegi sorusu mevcut FAQ bilgisiyle dogrudan cevaplanabilir.',
      };
    }
  }

  private isModifierOnlyRequest(categories: string[]): boolean {
    if (categories.length === 0) {
      return false;
    }

    const modifierCategories = new Set(['pricing', 'hours', 'contact', 'policies']);
    return categories.every(category => modifierCategories.has(category));
  }

  private getLatestCustomerEntry(history: ConversationEntry[]): ConversationEntry | null {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].direction === 'inbound') {
        return history[i];
      }
    }

    return null;
  }

  private getLatestAssistantEntry(history: ConversationEntry[]): ConversationEntry | null {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].direction === 'outbound') {
        return history[i];
      }
    }

    return null;
  }

  private shouldAttemptContextRepair(plan: AIContextPlan, history: ConversationEntry[]): boolean {
    if (plan.followUpHint) {
      return false;
    }

    if (!this.isModifierOnlyRequest(plan.categories)) {
      return false;
    }

    const latestCustomerEntry = this.getLatestCustomerEntry(history);
    if (!latestCustomerEntry) {
      return false;
    }

    const latestTimestamp = new Date(latestCustomerEntry.createdAt).getTime();
    if (Number.isNaN(latestTimestamp)) {
      return false;
    }

    return (Date.now() - latestTimestamp) <= (2 * 60 * 1000);
  }

  private countMeaningfulWords(messageText: string): number {
    return normalizeTurkish(messageText.toLowerCase())
      .split(/\s+/)
      .map(token => token.trim())
      .filter(Boolean)
      .length;
  }

  private shouldAttemptStateRepair(
    plan: AIContextPlan,
    messageText: string,
    conversationState: ConversationStateRecord | null,
  ): boolean {
    if (!conversationState || plan.followUpHint) {
      return false;
    }

    if (!conversationState.activeTopic || conversationState.activeTopicConfidence < 0.55) {
      return false;
    }

    if (this.isModifierOnlyRequest(plan.categories)) {
      return true;
    }

    const wordCount = this.countMeaningfulWords(messageText);
    if (wordCount > 4) {
      return false;
    }

    if (plan.topicSummary) {
      return false;
    }

    return plan.responseDirective.mode === 'clarify_only' || !plan.categories.includes('services');
  }

  private shouldOverrideFollowUpWithState(
    plan: AIContextPlan,
    conversationState: ConversationStateRecord | null,
  ): boolean {
    if (!conversationState || !plan.followUpHint) {
      return false;
    }

    const nonServiceCategories = plan.categories.filter(category => category !== 'services');
    if (!this.isModifierOnlyRequest(nonServiceCategories)) {
      return false;
    }

    if (!conversationState.activeTopic || conversationState.activeTopicConfidence < 0.75) {
      return false;
    }

    if (!conversationState.lastCustomerMessage) {
      return false;
    }

    const normalizedPlanTopic = normalizeTurkish(plan.followUpHint.topicLabel.toLowerCase());
    const normalizedStateTopic = normalizeTurkish(conversationState.activeTopic.toLowerCase());

    if (!normalizedPlanTopic || normalizedPlanTopic === normalizedStateTopic) {
      return false;
    }

    return conversationState.lastQuestionType === 'service_topic'
      || conversationState.pendingCategories.includes('services');
  }

  private buildStateFollowUpHint(
    messageText: string,
    conversationState: ConversationStateRecord,
  ): FollowUpContextHint | null {
    if (!conversationState.activeTopic) {
      return null;
    }

    const cleanedMessage = messageText.trim();
    if (!cleanedMessage) {
      return null;
    }

    return {
      topicLabel: conversationState.activeTopic,
      rewrittenQuestion: `${conversationState.activeTopic} icin ${cleanedMessage}`,
      sourceMessage: conversationState.lastCustomerMessage || conversationState.topicSourceMessage || conversationState.activeTopic,
    };
  }

  private async repairImplicitFollowUpAI(messageText: string, history: ConversationEntry[]): Promise<ContextDependency> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    const latestCustomerEntry = this.getLatestCustomerEntry(history);
    if (!apiKey || !latestCustomerEntry) {
      return DEFAULT_CONTEXT_DEPENDENCY;
    }

    const latestAssistantEntry = this.getLatestAssistantEntry(history);
    const prompt = [
      'Sen kisa takip mesaji cozumleyicisisin.',
      'Mevcut mesajin bir onceki musteri konusunun devami olup olmadigini belirle.',
      'Sadece JSON don.',
      '',
      'JSON semasi:',
      '{"dependsOnPriorTopic": true, "topicLabel": "kisa konu etiketi", "sourceMessage": "onceki musteri mesaji", "rationale": "kisa neden"}',
      'veya',
      '{"dependsOnPriorTopic": false, "topicLabel": null, "sourceMessage": null, "rationale": "bagimsiz soru"}',
      '',
      'Kurallar:',
      '- Mevcut mesaj yalnizca fiyat/saat/iletisim gibi eksik bir takip sorusuysa ve son musteri mesaji spesifik bir hizmet konu baslattiysa true don.',
      '- Mevcut mesaj yeni bir hizmet adi getiriyorsa false don.',
      '- topicLabel, onceki konuyu tanimlayan kisa ve dogal bir hizmet etiketi olsun.',
      '- sourceMessage, son musteri mesajinin aynisi olsun.',
      '',
      'INPUT:',
      JSON.stringify({
        currentMessage: messageText,
        latestCustomerMessage: latestCustomerEntry.messageText,
        latestAssistantMessage: latestAssistantEntry?.messageText || null,
      }, null, 2),
    ].join('\n');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'SPA Context Repair',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Only return valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 180,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return DEFAULT_CONTEXT_DEPENDENCY;
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return DEFAULT_CONTEXT_DEPENDENCY;
      }

      return this.normalizeContextDependency(JSON.parse(this.extractJsonText(content)));
    } catch {
      return DEFAULT_CONTEXT_DEPENDENCY;
    }
  }

  private async repairImplicitFollowUpFromStateAI(
    messageText: string,
    conversationState: ConversationStateRecord,
  ): Promise<ContextDependency> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || !conversationState.activeTopic) {
      return DEFAULT_CONTEXT_DEPENDENCY;
    }

    const prompt = [
      'Sen kisa takip mesaji cozumleyicisisin.',
      'Mevcut mesajin aktif konusma durumundaki konunun devami olup olmadigini belirle.',
      'Sadece JSON don.',
      '',
      'JSON semasi:',
      '{"dependsOnPriorTopic": true, "topicLabel": "aktif konu", "sourceMessage": "baglami kuran onceki musteri mesaji", "rationale": "kisa neden"}',
      'veya',
      '{"dependsOnPriorTopic": false, "topicLabel": null, "sourceMessage": null, "rationale": "bagimsiz soru"}',
      '',
      'Kurallar:',
      '- Mesaj aktif konuya dair fiyat, saat, uygunluk, tercih, onay veya kisa takip niteligindeyse true don.',
      '- Mesaj acikca yeni bir hizmet konusu, selamlama, tesekkur veya uygunsuz/cinsel istekse false don.',
      '- True donersen topicLabel mevcut aktif konu ile ayni olmali.',
      '- True donersen sourceMessage onceki musteri baglam mesaji olmali.',
      '',
      'INPUT:',
      JSON.stringify({
        currentMessage: messageText,
        activeConversationState: {
          activeTopic: conversationState.activeTopic,
          confidence: conversationState.activeTopicConfidence,
          sourceMessage: conversationState.topicSourceMessage,
          lastQuestionType: conversationState.lastQuestionType,
          pendingCategories: conversationState.pendingCategories,
          lastCustomerMessage: conversationState.lastCustomerMessage,
          lastAssistantMessage: conversationState.lastAssistantMessage,
        },
      }, null, 2),
    ].join('\n');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'SPA State Context Repair',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Only return valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 180,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        return DEFAULT_CONTEXT_DEPENDENCY;
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return DEFAULT_CONTEXT_DEPENDENCY;
      }

      return this.normalizeContextDependency(JSON.parse(this.extractJsonText(content)));
    } catch {
      return DEFAULT_CONTEXT_DEPENDENCY;
    }
  }

  private normalizeResponseDirective(value: unknown): ResponseDirective {
    if (!value || typeof value !== 'object') {
      return DEFAULT_RESPONSE_DIRECTIVE;
    }

    const raw = value as Record<string, unknown>;
    const modeValue = String(raw.mode ?? '').trim() as ResponseMode;
    const mode = VALID_RESPONSE_MODES.has(modeValue) ? modeValue : DEFAULT_RESPONSE_DIRECTIVE.mode;
    const instruction = String(raw.instruction ?? '').trim() || DEFAULT_RESPONSE_DIRECTIVE.instruction;
    const rationale = String(raw.rationale ?? '').trim() || DEFAULT_RESPONSE_DIRECTIVE.rationale;

    return {
      mode,
      instruction,
      rationale,
    };
  }

  private normalizeModelTier(value: unknown): ModelTier {
    const tier = String(value ?? '').trim().toLowerCase();
    if (tier === 'light' || tier === 'standard' || tier === 'advanced') {
      return tier;
    }

    return 'standard';
  }

  private buildFallbackResponseDirective(categories: string[]): ResponseDirective {
    if (categories.includes('pricing') && categories.includes('hours') && !categories.includes('services')) {
      return {
        mode: 'answer_then_clarify',
        instruction: 'Saat gibi net bilgileri ver. Fiyat kapsami belirsizse sadece bir kisa netlestirme sorusu sor.',
        rationale: 'Coklu niyet var, fiyat kapsami belirsiz olabilir.',
      };
    }

    if (categories.includes('pricing') && !categories.includes('services')) {
      return {
        mode: 'answer_then_clarify',
        instruction: 'Eger fiyat kapsaminda belirsizlik varsa tek cumlelik bir netlestirme sorusu sor; aksi halde dogrudan cevap ver.',
        rationale: 'Fiyat sorusu konu belirtmiyor olabilir.',
      };
    }

    return DEFAULT_RESPONSE_DIRECTIVE;
  }


  /**
   * Legacy single-message intent detector kept as a fallback utility.
   */
  private async legacyDetectIntentAI(messageText: string): Promise<IntentResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('[InstagramContextService] No API key - using conservative AI recovery');
      return { categories: ['general', 'faq'], keywords: [] };
    }

    try {
      const prompt = `Müşteri mesajını analiz et ve hangi kategorilere ait olduğunu belirle.

Kategoriler:
- services: Hizmetler (masaj, spa, fitness, havuz, kurslar, PT, üyelik)
- pricing: Fiyat bilgisi (ne kadar, ücret, fiyat, kampanya)
- hours: Çalışma saatleri, müsaitlik, açık/kapalı, ne zaman (ÖNEMLİ: "müsait mi", "açık mı", "gelebilir miyim", "saat kaçta" gibi sorular HOURS kategorisidir)
- policies: Kurallar, iptal, ödeme, yaş sınırı, getirmesi gerekenler
- contact: İletişim, adres, telefon, konum, nerede
- faq: Genel sorular, randevu nasıl alınır, terapist bilgisi

Müşteri mesajı: "${messageText}"

SADECE JSON yanıt ver, başka hiçbir şey yazma:
{"categories": ["kategori1", "kategori2"], "confidence": 0.95}

Eğer hiçbir kategoriye uymuyorsa: {"categories": ["general", "faq"], "confidence": 0.5}`;

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'SPA Intent Detection'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 100,
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('Empty response from API');
      }

      const parsed = JSON.parse(content);
      const categories = Array.isArray(parsed.categories) ? parsed.categories : ['general', 'faq'];

      return { categories, keywords: [] };
    } catch (error) {
      console.error('[InstagramContextService] AI intent detection failed:', error);
      console.log('[InstagramContextService] Falling back to conservative AI recovery for message:', messageText.substring(0, 50));
      return { categories: ['general', 'faq'], keywords: [] };
    }
  }

  private async buildRecoveryContextPlan(messageText: string, history: ConversationEntry[]): Promise<AIContextPlan> {
    const currentIntent = await this.legacyDetectIntentAI(messageText);
    const recentInbound = this.getRecentInboundForContext(history);
    const historyIntents = await Promise.all(
      recentInbound.map(entry => this.legacyDetectIntentAI(entry.messageText)),
    );
    const contextCategories = new Set(currentIntent.categories);
    const hasModifier = currentIntent.categories.some(category => ['pricing', 'hours', 'contact', 'policies'].includes(category));
    const hasTopic = currentIntent.categories.includes('services');

    if (hasModifier && !hasTopic) {
      for (const historyIntent of historyIntents) {
        if (historyIntent.categories.includes('services')) {
          contextCategories.add('services');
          break;
        }
      }
    }

    const categories = [...contextCategories];
    const isGeneralRecovery = categories.length === 2
      && categories.includes('general')
      && categories.includes('faq');
    const modelTier: ModelTier = isGeneralRecovery ? 'light' : 'standard';

    const plan: AIContextPlan = {
      categories,
      keywords: currentIntent.keywords,
      followUpHint: null,
      topicSummary: null,
      responseDirective: this.buildFallbackResponseDirective(categories),
      tier: modelTier,
      tierReason: modelTier === 'light'
        ? 'AI kurtarma plani: guvenli genel netlestirme'
        : 'AI kurtarma plani: baglamli varsayilan standart',
      stateRepairApplied: false,
    };
    this.applyPolicyPrioritySignals(plan, messageText);
    this.applyMassagePricingSignals(plan, messageText);
    this.applyRoomAvailabilitySignals(plan, messageText);
    return plan;
  }

  private buildFallbackContextPlan(messageText: string, history: ConversationEntry[]): AIContextPlan {
    const currentIntent = this.detectIntentKeywords(messageText);
    const recentInbound = this.getRecentInboundForContext(history);
    const historyIntents = recentInbound.map(entry => this.detectIntentKeywords(entry.messageText));
    const contextCategories = new Set(currentIntent.categories);
    const hasModifier = currentIntent.categories.some(category => ['pricing', 'hours', 'contact', 'policies'].includes(category));
    const hasTopic = currentIntent.categories.includes('services');

    if (hasModifier && !hasTopic) {
      for (const historyIntent of historyIntents) {
        if (historyIntent.categories.includes('services')) {
          contextCategories.add('services');
          break;
        }
      }
    }

    const categories = [...contextCategories];
    const tier = this.classifyModelTier(messageText, categories);

    const plan: AIContextPlan = {
      categories,
      keywords: currentIntent.keywords,
      followUpHint: null,
      topicSummary: null,
      responseDirective: this.buildFallbackResponseDirective(categories),
      tier: tier.tier,
      tierReason: `${tier.reason} (legacy fallback)`,
      stateRepairApplied: false,
    };
    this.applyPolicyPrioritySignals(plan, messageText);
    this.applyMassagePricingSignals(plan, messageText);
    this.applyRoomAvailabilitySignals(plan, messageText);
    return plan;
  }

  private parseAIContextPlan(rawContent: string, messageText: string): AIContextPlan {
    const parsed = JSON.parse(this.extractJsonText(rawContent)) as Record<string, unknown>;
    const contextDependency = this.normalizeContextDependency(parsed.contextDependency);
    const topicSummary = this.normalizeTopicSummary(parsed.topicSummary, contextDependency);
    const categories = this.applyContextDependencyToCategories(
      this.normalizeCategories(parsed.categories),
      contextDependency,
    );
    const explicitFollowUpHint = this.normalizeFollowUpHint(parsed.followUpHint);
    const responseDirective = this.applyContextDependencyToDirective(
      this.normalizeResponseDirective(parsed.responseDirective),
      contextDependency,
    );
    const derivedFollowUpHint = explicitFollowUpHint || this.buildDerivedFollowUpHint(messageText, contextDependency);
    const normalizedCategories = derivedFollowUpHint && !categories.includes('services')
      ? ['services', ...categories]
      : categories;

    return {
      categories: normalizedCategories,
      keywords: this.normalizeSemanticSignals(parsed.semanticSignals),
      followUpHint: derivedFollowUpHint,
      topicSummary,
      responseDirective,
      tier: this.normalizeModelTier(parsed.tier),
      tierReason: String(parsed.tierReason ?? '').trim() || 'AI varsayilan plan -> standard',
      stateRepairApplied: false,
    };
  }

  private async planMessageContextAI(
    messageText: string,
    history: ConversationEntry[],
    conversationState: ConversationStateRecord | null = null,
  ): Promise<AIContextPlan> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('[InstagramContextService] No API key - using AI recovery planner');
      return this.buildRecoveryContextPlan(messageText, history);
    }

    try {
      const prompt = this.buildContextPlannerPrompt(messageText, history, conversationState);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'SPA Context Planner',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Only return valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 350,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('Empty response from API');
      }

      const plan = this.parseAIContextPlan(content, messageText);
      if (this.shouldAttemptContextRepair(plan, history)) {
        const repairedDependency = await this.repairImplicitFollowUpAI(messageText, history);
        const repairedFollowUpHint = this.buildDerivedFollowUpHint(messageText, repairedDependency);
        if (repairedFollowUpHint) {
          plan.followUpHint = repairedFollowUpHint;
          plan.categories = this.applyContextDependencyToCategories(plan.categories, repairedDependency);
          plan.responseDirective = this.applyContextDependencyToDirective(plan.responseDirective, repairedDependency);
          console.log('[InstagramContextService] AI context repair resolved: "%s" -> "%s"',
            repairedFollowUpHint.sourceMessage,
            repairedFollowUpHint.rewrittenQuestion);
        }
      }
      if (this.shouldAttemptStateRepair(plan, messageText, conversationState)) {
        const repairedDependency = await this.repairImplicitFollowUpFromStateAI(messageText, conversationState!);
        const repairedFollowUpHint = this.buildDerivedFollowUpHint(messageText, repairedDependency);
        if (repairedFollowUpHint) {
          plan.followUpHint = repairedFollowUpHint;
          plan.topicSummary = plan.topicSummary || repairedFollowUpHint.topicLabel;
          plan.categories = this.applyContextDependencyToCategories(plan.categories, repairedDependency);
          plan.responseDirective = this.applyContextDependencyToDirective(plan.responseDirective, repairedDependency);
          plan.stateRepairApplied = true;
          console.log('[InstagramContextService] State context repair resolved: "%s" -> "%s"',
            repairedFollowUpHint.sourceMessage,
            repairedFollowUpHint.rewrittenQuestion);
        }
      }
      if (this.shouldOverrideFollowUpWithState(plan, conversationState)) {
        const overriddenFollowUpHint = this.buildStateFollowUpHint(messageText, conversationState!);
        if (overriddenFollowUpHint) {
          plan.followUpHint = overriddenFollowUpHint;
          plan.topicSummary = conversationState!.activeTopic;
          plan.categories = this.applyContextDependencyToCategories(plan.categories, {
            dependsOnPriorTopic: true,
            topicLabel: conversationState!.activeTopic,
            sourceMessage: overriddenFollowUpHint.sourceMessage,
            rationale: 'Aktif konusma durumu, planlanan konudan daha yeni ve daha guvenilir.',
          });
          plan.responseDirective = this.applyContextDependencyToDirective(plan.responseDirective, {
            dependsOnPriorTopic: true,
            topicLabel: conversationState!.activeTopic,
            sourceMessage: overriddenFollowUpHint.sourceMessage,
            rationale: 'Aktif konusma durumu, planlanan konudan daha yeni ve daha guvenilir.',
          });
          console.log('[InstagramContextService] Follow-up conflict override: "%s" -> "%s"',
            overriddenFollowUpHint.sourceMessage,
            overriddenFollowUpHint.rewrittenQuestion);
        }
      }
      if (plan.followUpHint) {
        console.log('[InstagramContextService] AI follow-up plan resolved: "%s" -> "%s"',
          plan.followUpHint.sourceMessage,
          plan.followUpHint.rewrittenQuestion);
      }

      this.applyPolicyPrioritySignals(plan, messageText);
      this.applyMassagePricingSignals(plan, messageText);
      this.applyRoomAvailabilitySignals(plan, messageText);
      this.applyGroundedFollowUpGuard(plan);

      return plan;
    } catch (error) {
      console.error('[InstagramContextService] AI context planner failed:', error);
      console.log('[InstagramContextService] Falling back to AI recovery planner for message:', messageText.substring(0, 80));
      return this.buildRecoveryContextPlan(messageText, history);
    }
  }

  async detectIntentAI(messageText: string): Promise<IntentResult> {
    const plan = await this.planMessageContextAI(messageText, []);
    return {
      categories: plan.categories,
      keywords: plan.keywords,
    };
  }

  /**
   * Original keyword-based intent detection (fallback).
   */
  detectIntentKeywords(messageText: string): IntentResult {
    const normalized = normalizeTurkish(messageText.toLowerCase().trim());
    const matchedCategories: Set<string> = new Set();
    const matchedKeywords: string[] = [];

    for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          matchedCategories.add(category);
          matchedKeywords.push(keyword);
        }
      }
    }

    if (hasAgePolicySignals(messageText)) {
      matchedCategories.add('policies');
      if (!matchedKeywords.includes('policy_age_signal')) {
        matchedKeywords.push('policy_age_signal');
      }
    }

    if (hasRoomAvailabilitySignals(messageText)) {
      matchedCategories.add('faq');
      if (!matchedKeywords.includes('room_availability_signal')) {
        matchedKeywords.push('room_availability_signal');
      }
    }

    if (matchedCategories.size === 0) {
      return { categories: ['general', 'faq'], keywords: [] };
    }

    return {
      categories: [...matchedCategories],
      keywords: matchedKeywords,
    };
  }

  /**
   * Extract matched keywords from message (for backward compatibility).
   */
  private extractKeywords(messageText: string): string[] {
    const normalized = normalizeTurkish(messageText.toLowerCase().trim());
    const matched: string[] = [];

    for (const keywords of Object.values(KEYWORD_CATEGORY_MAP)) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          matched.push(keyword);
        }
      }
    }

    return matched;
  }

  /**
   * Synchronous wrapper for backward compatibility.
   * @deprecated Use detectIntentAI() instead for better accuracy.
   */
  detectIntent(messageText: string): IntentResult {
    return this.detectIntentKeywords(messageText);
  }

  /**
   * Context-aware intent detection with AI: merges current message intent with
   * recent conversation context. Handles follow-up messages like
   * "ücret nedir?" after "taekwondo kursu varmı?" by carrying forward
   * topic categories from the last 3 inbound messages (within 10 minutes).
   * 
   * Uses AI-powered intent detection for better accuracy.
   */
  private getRecentInboundForContext(history: ConversationEntry[]): ConversationEntry[] {
    return history
      .filter(entry => entry.direction === 'inbound')
      .slice(-3)
      .filter(entry => {
        const msgTime = new Date(entry.createdAt).getTime();
        return (Date.now() - msgTime) < 10 * 60 * 1000;
      });
  }

  private buildPricingFollowUpHint(
    currentIntent: IntentResult,
    recentInbound: ConversationEntry[],
  ): FollowUpContextHint | null {
    const asksPricing = currentIntent.categories.includes('pricing');
    const alreadySpecific = currentIntent.categories.includes('services');

    if (!asksPricing || alreadySpecific) {
      return null;
    }

    for (let i = recentInbound.length - 1; i >= 0; i--) {
      const topicLabel = this.resolvePricingTopicFromHistory(recentInbound[i].messageText);
      if (!topicLabel) {
        continue;
      }

      return {
        topicLabel,
        rewrittenQuestion: `${topicLabel} fiyatlari nedir?`,
        sourceMessage: recentInbound[i].messageText,
      };
    }

    return null;
  }

  private resolvePricingTopicFromHistory(messageText: string): string | null {
    const normalized = normalizeTurkish(messageText.toLowerCase());
    const topicRules: Array<{ label: string; matches?: string[]; regexes?: RegExp[] }> = [
      { label: 'MIX masaj', matches: ['mix'] },
      { label: 'sicak tas masaji', matches: ['sicak tas'] },
      { label: 'medikal masaj', matches: ['medikal'] },
      { label: 'bali masaji', matches: ['bali'] },
      { label: 'endonezya masaji', matches: ['endonezya'] },
      { label: 'uzakdogu masaji', matches: ['uzakdogu'] },
      { label: 'masaj', matches: ['masaj', 'massage', 'spa', 'hamam', 'sauna', 'buhar', 'kese', 'kopuk'] },
      { label: 'aile uyeligi', matches: ['aile uyeligi', 'aile uyelik', 'aile'] },
      { label: 'ferdi uyelik', matches: ['ferdi uyelik', 'ferdi', 'uyelik', 'membership'] },
      { label: 'reformer pilates', matches: ['reformer', 'pilates'] },
      { label: 'personal trainer', matches: ['personal trainer', 'trainer'] },
      { label: 'PT', regexes: [/\bpt\b/] },
      { label: 'taekwondo kursu', matches: ['taekwondo'] },
      { label: 'jimnastik kursu', matches: ['jimnastik'] },
      { label: 'kickboks kursu', matches: ['kickboks'] },
      { label: 'boks kursu', matches: ['boks'] },
      { label: 'cocuk kurslari', matches: ['cocuk', 'kurs'] },
      { label: 'kadin yuzme', matches: ['kadin yuzme'] },
      { label: 'fitness', matches: ['fitness'] },
      { label: 'havuz', matches: ['havuz', 'yuzme'] },
    ];

    for (const rule of topicRules) {
      const keywordMatch = rule.matches?.some(keyword => normalized.includes(keyword));
      const regexMatch = rule.regexes?.some(regex => regex.test(normalized));
      if (keywordMatch || regexMatch) {
        return rule.label;
      }
    }

    return null;
  }

  private enrichIntentWithConversationContext(
    currentIntent: IntentResult,
    recentInbound: ConversationEntry[],
    historyIntents: IntentResult[],
  ): ContextualIntentResult {
    const MODIFIER_CATEGORIES = new Set(['pricing', 'hours', 'contact', 'policies']);
    const TOPIC_CATEGORIES = new Set(['services']);
    const hasModifier = currentIntent.categories.some(category => MODIFIER_CATEGORIES.has(category));
    const hasTopic = currentIntent.categories.some(category => TOPIC_CATEGORIES.has(category));
    const followUpHint = this.buildPricingFollowUpHint(currentIntent, recentInbound);

    if (!hasModifier || hasTopic) {
      return {
        ...currentIntent,
        followUpHint,
        responseDirective: this.buildFallbackResponseDirective(currentIntent.categories),
      };
    }

    const contextCategories = new Set(currentIntent.categories);
    const contextKeywords = [...currentIntent.keywords];

    for (const historyIntent of historyIntents) {
      for (const category of historyIntent.categories) {
        if (TOPIC_CATEGORIES.has(category) && !contextCategories.has(category)) {
          contextCategories.add(category);
          contextKeywords.push(...historyIntent.keywords.filter(keyword => !contextKeywords.includes(keyword)));
        }
      }
    }

    if (contextCategories.size > currentIntent.categories.length) {
      console.log('[InstagramContextService] Follow-up detected: enriched categories %j -> %j',
        currentIntent.categories, [...contextCategories]);
    }

    if (followUpHint) {
      console.log('[InstagramContextService] Pricing follow-up resolved: "%s" -> "%s"',
        followUpHint.sourceMessage,
        followUpHint.rewrittenQuestion);
    }

    return {
      categories: [...contextCategories],
      keywords: contextKeywords,
      followUpHint,
      responseDirective: this.buildFallbackResponseDirective([...contextCategories]),
    };
  }

  async detectIntentWithContextAI(messageText: string, history: ConversationEntry[]): Promise<ContextualIntentResult> {
    const plan = await this.planMessageContextAI(messageText, history);
    return {
      categories: plan.categories,
      keywords: plan.keywords,
      followUpHint: plan.followUpHint,
      responseDirective: plan.responseDirective,
    };
  }

  /**
   * Context-aware intent detection: merges current message intent with
   * recent conversation context. Handles follow-up messages like
   * "ücret nedir?" after "taekwondo kursu varmı?" by carrying forward
   * topic categories from the last 3 inbound messages (within 10 minutes).
   * 
   * @deprecated Use detectIntentWithContextAI() for better accuracy.
   */
  detectIntentWithContext(messageText: string, history: ConversationEntry[]): ContextualIntentResult {
    const fallbackPlan = this.buildFallbackContextPlan(messageText, history);
    return {
      categories: fallbackPlan.categories,
      keywords: fallbackPlan.keywords,
      followUpHint: fallbackPlan.followUpHint,
      responseDirective: fallbackPlan.responseDirective,
    };
  }

  serializeIntentResult(result: IntentResult): string {
    return JSON.stringify({
      categories: result.categories,
      keywords: result.keywords,
    });
  }


  parseIntentResult(serialized: string): IntentResult {
    const parsed = JSON.parse(serialized);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.keywords)
    ) {
      throw new Error('Invalid IntentResult JSON: must have categories and keywords arrays');
    }

    return {
      categories: parsed.categories.map((c: unknown) => String(c)),
      keywords: parsed.keywords.map((k: unknown) => String(k)),
    };
  }

  classifyModelTier(messageText: string, categories: string[]): ModelTierResult {
      const normalized = normalizeTurkish(messageText.toLowerCase().trim());

      // 1. Check advanced: complaint patterns or long messages (200+ chars)
      const hasAdvancedPattern = MODEL_CONFIG.advanced.patterns.some(p => normalized.includes(p));
      if (hasAdvancedPattern) {
        return { tier: 'advanced', modelId: MODEL_CONFIG.advanced.modelId, reason: 'Şikayet anahtar kelimesi tespit edildi → advanced' };
      }
      if (normalized.length >= MODEL_CONFIG.advanced.minLength) {
        return { tier: 'advanced', modelId: MODEL_CONFIG.advanced.modelId, reason: 'Uzun mesaj (200+ karakter) → advanced' };
      }

      // 2. Check light: greeting-only (no KEYWORD_CATEGORY_MAP matches)
      const hasLightPattern = MODEL_CONFIG.light.patterns.some(p => normalized.includes(p));
      const hasKeywordMatch = Object.values(KEYWORD_CATEGORY_MAP).some(keywords =>
        keywords.some(kw => normalized.includes(kw))
      );

      if (hasLightPattern && !hasKeywordMatch) {
        return { tier: 'light', modelId: MODEL_CONFIG.light.modelId, reason: 'Selamlama mesajı, bilgi sorgusu yok → light' };
      }

      // 3. Check light: single category match in singleCategoryMatch list
      if (
        categories.length === 1 &&
        MODEL_CONFIG.light.singleCategoryMatch.includes(categories[0])
      ) {
        return { tier: 'light', modelId: MODEL_CONFIG.light.modelId, reason: `Tek kategori: ${categories[0]} → light` };
      }

      // 4. Check light: common 2-category FAQ combos that are truly simple
      // NOTE: services+pricing is NOT light — price queries need standard model for accurate KB usage
      const LIGHT_CATEGORY_COMBOS: string[][] = [
        ['services', 'hours'],     // "X ne zaman açık?"
        ['services', 'faq'],       // "X nasıl?" / "X var mı?"
        ['pricing', 'faq'],        // "fiyat nasıl?"
      ];

      if (categories.length === 2) {
        const sorted = [...categories].sort();
        const isLightCombo = LIGHT_CATEGORY_COMBOS.some(combo => {
          const sortedCombo = [...combo].sort();
          return sorted[0] === sortedCombo[0] && sorted[1] === sortedCombo[1];
        });
        if (isLightCombo) {
          return { tier: 'light', modelId: MODEL_CONFIG.light.modelId, reason: `Basit FAQ kombinasyonu: ${categories.join('+')} → light` };
        }
      }

      // 5. Default: standard (3+ categories or non-FAQ combos)
      return { tier: 'standard', modelId: MODEL_CONFIG.standard.modelId, reason: 'Çoklu kategori sorgusu (varsayılan) → standard' };
    }

  /**
   * Format raw KB JSON into clean, readable Turkish text for the AI prompt.
   * 
   * WHY: Raw JSON like {"contact":{"address":"..."}} is hard for LLMs to parse
   * correctly. They sometimes ignore the JSON values and hallucinate from training
   * data instead. Plain text with clear labels eliminates this failure mode.
   * 
   * PRICING: Uses PriceFormatterService for mobile-optimized price lists with
   * emojis, grouping, and proper spacing. All other categories use plain text.
   */
  static async formatKnowledgeForPrompt(knowledgeJson: string): Promise<string> {
    try {
      const data = JSON.parse(knowledgeJson);
      if (typeof data !== 'object' || data === null) return knowledgeJson;

      // Dynamic import for ESM compatibility
      const { PriceFormatterService } = await import('./PriceFormatterService.js');
      const priceFormatter = new PriceFormatterService();

      const CATEGORY_LABELS: Record<string, string> = {
        services: 'HİZMETLER',
        pricing: 'FİYATLAR',
        hours: 'ÇALIŞMA SAATLERİ',
        contact: 'İLETİŞİM',
        policies: 'POLİTİKALAR',
        faq: 'SIK SORULAN SORULAR',
        general: 'GENEL BİLGİ',
      };

      const sections: string[] = [];

      for (const [category, entries] of Object.entries(data)) {
        if (typeof entries !== 'object' || entries === null) continue;
        const label = CATEGORY_LABELS[category] || category.toUpperCase();

        // Special handling for pricing category — use PriceFormatterService
        if (category === 'pricing') {
          const lines: string[] = [`[${label}]`];
          
          for (const [key, value] of Object.entries(entries as Record<string, string>)) {
            if (typeof value === 'string' && value.trim()) {
              // Format each pricing entry using the service
              const formatted = priceFormatter.formatPricing(key, value);
              lines.push(formatted.text);
              lines.push(''); // blank line between price categories
            }
          }

          if (lines.length > 1) {
            sections.push(lines.join('\n').trim());
          }
        } else {
          // Standard formatting for non-pricing categories
          const lines: string[] = [`[${label}]`];

          for (const [, value] of Object.entries(entries as Record<string, string>)) {
            if (typeof value === 'string' && value.trim()) {
              lines.push(`• ${value}`);
            }
          }

          if (lines.length > 1) {
            sections.push(lines.join('\n'));
          }
        }
      }

      return sections.join('\n\n');
    } catch (err) {
      // If JSON parsing or formatting fails, return as-is
      console.error('[InstagramContextService] formatKnowledgeForPrompt error:', err);
      return knowledgeJson;
    }
  }

}
