import Database from 'better-sqlite3';

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

export const MODEL_CONFIG = {
  light: {
    modelId: 'google/gemini-2.5-flash-lite',
    patterns: ['merhaba', 'selam', 'hey', 'iyi gunler', 'hosca kal',
               'tesekkur', 'sagol', 'tamam', 'ok', 'evet', 'hayir'],
    singleCategoryMatch: ['hours', 'contact', 'services', 'pricing', 'faq'] as string[],
  },
  standard: {
    modelId: 'moonshotai/kimi-k2',
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
  matchedKeywords: string[];  // from detectIntent
  tierReason: string;         // from classifyModelTier
  modelTier: ModelTier;
  modelId: string;
  isNewCustomer: boolean;
  totalInteractions: number;  // all-time count for customer summary
}

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

  constructor(db: Database.Database) {
    this.db = db;
  }

  analyzeMessage(senderId: string, messageText: string): MessageAnalysis {
      try {
        const conversationHistory = this.getConversationHistory(senderId);
        const totalInteractions = this.getTotalInteractionCount(senderId);
        const formattedHistory = this.formatConversationHistory(conversationHistory);
        const intentResult = this.detectIntentWithContext(messageText, conversationHistory);
        const { tier: modelTier, modelId, reason: tierReason } = this.classifyModelTier(messageText, intentResult.categories);
        const isNewCustomer = totalInteractions === 0;

        return {
          conversationHistory,
          formattedHistory,
          intentCategories: intentResult.categories,
          matchedKeywords: intentResult.keywords,
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
          tierReason: 'Varsayılan model (hata durumu) → standard',
          modelTier: 'standard',
          modelId: MODEL_CONFIG.standard.modelId,
          isNewCustomer: true,
          totalInteractions: 0,
        };
      }
    }


  getConversationHistory(senderId: string, limit: number = 10): ConversationEntry[] {
    try {
      // Only fetch messages from the last 24 hours — older context wastes tokens
      const rows = this.db.prepare(`
        SELECT direction, message_text, created_at
        FROM instagram_interactions
        WHERE instagram_id = ?
          AND created_at >= datetime('now', '-24 hours')
        ORDER BY created_at DESC
        LIMIT ?
      `).all(senderId, limit) as { direction: 'inbound' | 'outbound'; message_text: string; created_at: string }[];

      // Reverse to get chronological order (oldest first)
      return rows.reverse().map(row => ({
        direction: row.direction,
        messageText: row.message_text,
        createdAt: row.created_at,
        relativeTime: computeRelativeTime(row.created_at),
      }));
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


  detectIntent(messageText: string): IntentResult {
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

    if (matchedCategories.size === 0) {
      return { categories: ['general', 'faq'], keywords: [] };
    }

    return {
      categories: [...matchedCategories],
      keywords: matchedKeywords,
    };
  }

  /**
   * Context-aware intent detection: merges current message intent with
   * recent conversation context. Handles follow-up messages like
   * "ücret nedir?" after "taekwondo kursu varmı?" by carrying forward
   * topic categories from the last 3 inbound messages (within 10 minutes).
   */
  detectIntentWithContext(messageText: string, history: ConversationEntry[]): IntentResult {
    const currentIntent = this.detectIntent(messageText);

    // Follow-up detection: if current message has a "modifier" category
    // (pricing, hours, contact) but no "topic" category (services),
    // check recent inbound messages for topic context.
    const MODIFIER_CATEGORIES = new Set(['pricing', 'hours', 'contact', 'policies']);
    const TOPIC_CATEGORIES = new Set(['services']);

    const hasModifier = currentIntent.categories.some(c => MODIFIER_CATEGORIES.has(c));
    const hasTopic = currentIntent.categories.some(c => TOPIC_CATEGORIES.has(c));

    // Only enrich if we have a modifier without a topic (follow-up pattern)
    if (!hasModifier || hasTopic) {
      return currentIntent;
    }

    // Look at last 3 inbound messages within 10 minutes for topic context
    const recentInbound = history
      .filter(e => e.direction === 'inbound')
      .slice(-3)
      .filter(e => {
        const msgTime = new Date(e.createdAt).getTime();
        return (Date.now() - msgTime) < 10 * 60 * 1000; // 10 minutes
      });

    const contextCategories = new Set(currentIntent.categories);
    const contextKeywords = [...currentIntent.keywords];

    for (const entry of recentInbound) {
      const historyIntent = this.detectIntent(entry.messageText);
      for (const cat of historyIntent.categories) {
        if (TOPIC_CATEGORIES.has(cat) && !contextCategories.has(cat)) {
          contextCategories.add(cat);
          contextKeywords.push(...historyIntent.keywords.filter(k => !contextKeywords.includes(k)));
        }
      }
    }

    if (contextCategories.size > currentIntent.categories.length) {
      console.log('[InstagramContextService] Follow-up detected: enriched categories %j → %j',
        currentIntent.categories, [...contextCategories]);
    }

    return {
      categories: [...contextCategories],
      keywords: contextKeywords,
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

          for (const [_key, value] of Object.entries(entries as Record<string, string>)) {
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
