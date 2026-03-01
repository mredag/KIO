import Database from 'better-sqlite3';
import { normalizeTurkish, KEYWORD_CATEGORY_MAP, MODEL_CONFIG } from './InstagramContextService.js';

export interface ConversationEntry {
  id: string;
  phone: string;
  direction: string;
  message_text: string;
  intent: string | null;
  sentiment: string | null;
  ai_response: string | null;
  response_time_ms: number | null;
  model_used: string | null;
  model_tier: string | null;
  created_at: string;
}

export interface IntentResult {
  categories: string[];
  keywords: string[];
  isGreeting: boolean;
  isComplaint: boolean;
  isCoupon: boolean;
  isAppointment: boolean;
  couponKeyword?: string;
  couponArgs?: string;
}

export interface ModelTierResult {
  tier: 'light' | 'standard' | 'advanced';
  reason: string;
  modelId?: string;
}

export interface MessageAnalysis {
  intent: IntentResult;
  tier: ModelTierResult;
  conversationHistory: ConversationEntry[];
  isIgnored: boolean;
}

// Greeting patterns (after normalization)
const GREETING_PATTERNS = [
  'merhaba', 'selam', 'hey', 'iyi gunler', 'hosca kal',
  'tesekkur', 'sagol', 'tamam', 'ok', 'evet', 'hayir',
];

// Complaint patterns (after normalization)
const COMPLAINT_PATTERNS = [
  'sikayet', 'sikayetim', 'memnun degil', 'kotu', 'berbat',
  'rezalet', 'iade', 'geri', 'sorun', 'problem',
];

// Coupon keywords
const COUPON_KEYWORDS = ['kupon', 'durum', 'kullan'];

// Appointment keywords (after normalization)
const APPOINTMENT_KEYWORDS = ['randevu', 'rezervasyon', 'seans'];

export class WhatsAppContextService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  analyzeMessage(phone: string, messageText: string): MessageAnalysis {
    try {
      const isIgnored = this.checkIgnoreList(phone);
      if (isIgnored) {
        return {
          intent: {
            categories: [],
            keywords: [],
            isGreeting: false,
            isComplaint: false,
            isCoupon: false,
            isAppointment: false,
          },
          tier: { tier: 'standard', reason: 'Ignored phone' },
          conversationHistory: [],
          isIgnored: true,
        };
      }

      const conversationHistory = this.getConversationHistory(phone);
      const intent = this.detectIntentWithContext(messageText, conversationHistory);
      const tier = this.classifyModelTier(messageText, intent.categories);

      return {
        intent,
        tier,
        conversationHistory,
        isIgnored: false,
      };
    } catch (error) {
      console.error('[WhatsAppContextService] analyzeMessage error:', error);
      return {
        intent: {
          categories: ['general', 'faq'],
          keywords: [],
          isGreeting: false,
          isComplaint: false,
          isCoupon: false,
          isAppointment: false,
        },
        tier: { tier: 'standard', reason: 'Varsayılan model (hata durumu) → standard', modelId: MODEL_CONFIG.standard.modelId },
        conversationHistory: [],
        isIgnored: false,
      };
    }
  }

  getConversationHistory(phone: string, limit: number = 10): ConversationEntry[] {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const rows = this.db.prepare(`
        SELECT id, phone, direction, message_text, intent, sentiment,
               ai_response, response_time_ms, model_used, model_tier, created_at
        FROM whatsapp_interactions
        WHERE phone = ?
          AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT ?
      `).all(phone, cutoff, limit) as ConversationEntry[];

      return rows.reverse();
    } catch (error) {
      console.error('[WhatsAppContextService] getConversationHistory error:', error);
      return [];
    }
  }

  detectIntent(messageText: string): IntentResult {
    const normalized = normalizeTurkish(messageText.toLowerCase().trim());
    const matchedCategories: Set<string> = new Set();
    const matchedKeywords: string[] = [];

    // Check KEYWORD_CATEGORY_MAP (same as Instagram)
    for (const [category, keywords] of Object.entries(KEYWORD_CATEGORY_MAP)) {
      for (const keyword of keywords) {
        if (normalized.includes(keyword)) {
          matchedCategories.add(category);
          matchedKeywords.push(keyword);
        }
      }
    }

    const isGreeting = GREETING_PATTERNS.some(p => normalized.includes(p)) && matchedCategories.size === 0;
    const isComplaint = COMPLAINT_PATTERNS.some(p => normalized.includes(p));
    const couponResult = this.isCouponKeyword(messageText);
    const isAppointment = this.isAppointmentIntent(messageText);

    if (matchedCategories.size === 0 && !couponResult.isCoupon && !isAppointment) {
      return {
        categories: ['general', 'faq'],
        keywords: [],
        isGreeting,
        isComplaint,
        isCoupon: couponResult.isCoupon,
        isAppointment,
        couponKeyword: couponResult.keyword,
        couponArgs: couponResult.args,
      };
    }

    return {
      categories: matchedCategories.size > 0 ? [...matchedCategories] : ['general', 'faq'],
      keywords: matchedKeywords,
      isGreeting,
      isComplaint,
      isCoupon: couponResult.isCoupon,
      isAppointment,
      couponKeyword: couponResult.keyword,
      couponArgs: couponResult.args,
    };
  }

  detectIntentWithContext(messageText: string, history: ConversationEntry[]): IntentResult {
    const currentIntent = this.detectIntent(messageText);

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
        const msgTime = new Date(e.created_at).getTime();
        return (Date.now() - msgTime) < 10 * 60 * 1000;
      });

    const contextCategories = new Set(currentIntent.categories);
    const contextKeywords = [...currentIntent.keywords];

    for (const entry of recentInbound) {
      const historyIntent = this.detectIntent(entry.message_text);
      for (const cat of historyIntent.categories) {
        if (TOPIC_CATEGORIES.has(cat) && !contextCategories.has(cat)) {
          contextCategories.add(cat);
          contextKeywords.push(...historyIntent.keywords.filter(k => !contextKeywords.includes(k)));
        }
      }
    }

    return {
      ...currentIntent,
      categories: [...contextCategories],
      keywords: contextKeywords,
    };
  }

  classifyModelTier(messageText: string, categories: string[]): ModelTierResult {
    const normalized = normalizeTurkish(messageText.toLowerCase().trim());

    // 1. Advanced: complaint patterns or long messages (200+ chars)
    if (COMPLAINT_PATTERNS.some(p => normalized.includes(p))) {
      return { tier: 'advanced', reason: 'Şikayet anahtar kelimesi tespit edildi → advanced', modelId: MODEL_CONFIG.advanced.modelId };
    }
    if (normalized.length >= 200) {
      return { tier: 'advanced', reason: 'Uzun mesaj (200+ karakter) → advanced', modelId: MODEL_CONFIG.advanced.modelId };
    }

    // 2. Light: greeting-only (no keyword matches)
    const isGreeting = GREETING_PATTERNS.some(p => normalized.includes(p));
    const hasKeywordMatch = Object.values(KEYWORD_CATEGORY_MAP).some(keywords =>
      keywords.some(kw => normalized.includes(kw))
    );

    if (isGreeting && !hasKeywordMatch) {
      return { tier: 'light', reason: 'Selamlama mesajı, bilgi sorgusu yok → light', modelId: MODEL_CONFIG.light.modelId };
    }

    // 3. Light: single category
    if (categories.length === 1 && MODEL_CONFIG.light.singleCategoryMatch.includes(categories[0])) {
      return { tier: 'light', reason: `Tek kategori: ${categories[0]} → light`, modelId: MODEL_CONFIG.light.modelId };
    }

    // 4. Default: standard
    return { tier: 'standard', reason: 'Çoklu kategori sorgusu (varsayılan) → standard', modelId: MODEL_CONFIG.standard.modelId };
  }

  checkIgnoreList(phone: string): boolean {
    try {
      const row = this.db.prepare(
        'SELECT 1 FROM whatsapp_ignore_list WHERE phone = ?'
      ).get(phone);
      return !!row;
    } catch (error) {
      console.error('[WhatsAppContextService] checkIgnoreList error:', error);
      return false;
    }
  }

  isCouponKeyword(messageText: string): { isCoupon: boolean; keyword?: string; args?: string } {
    const normalized = normalizeTurkish(messageText.toLowerCase().trim());
    const parts = normalized.split(/\s+/);
    const firstWord = parts[0];

    if (firstWord && COUPON_KEYWORDS.includes(firstWord)) {
      const args = parts.slice(1).join(' ').trim() || undefined;
      return { isCoupon: true, keyword: firstWord.toUpperCase(), args };
    }

    return { isCoupon: false };
  }

  isAppointmentIntent(messageText: string): boolean {
    const normalized = normalizeTurkish(messageText.toLowerCase().trim());
    return APPOINTMENT_KEYWORDS.some(kw => normalized.includes(kw));
  }
}
