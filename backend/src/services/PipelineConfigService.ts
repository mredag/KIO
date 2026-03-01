/**
 * PipelineConfigService — Dynamic pipeline configuration stored in mc_policies.
 *
 * All DM pipeline behavior (direct response tiers, models, polling intervals,
 * policy skip tiers, prompt templates) is stored as a single JSON policy row.
 * This makes it easy for Jarvis or the admin UI to change any value at runtime.
 *
 * The config is cached in-memory and refreshed on every read (SQLite is fast).
 * PATCH updates merge with existing config, so you can update a single field.
 */

import Database from 'better-sqlite3';

export interface DirectResponseTierConfig {
  enabled: boolean;
  modelId: string;
  maxTokens: number;
  temperature: number;
  skipPolicyValidation: boolean;
}

export interface PipelineConfig {
  // Direct response (bypass OpenClaw) — per-tier settings
  directResponse: {
    enabled: boolean;  // master switch
    tiers: {
      light: DirectResponseTierConfig;
      standard: DirectResponseTierConfig;
      advanced: DirectResponseTierConfig;
    };
  };
  // Polling config
  polling: {
    intervalMs: number;       // default 2000
    maxWaitMs: number;        // default 45000
    stableTimeoutMs: number;  // default 5000
  };
  // Policy Agent config
  policy: {
    enabled: boolean;
    maxRetries: number;       // default 2
    validationModel: string;
    correctionModel: string;  // 'same_as_tier' = use the tier's model
    timeoutMs: number;        // default 15000
  };
  // Prompt template for direct responses
  directPrompt: {
    systemTemplate: string;
    maxResponseLength: number; // chars, for the instruction
  };
  // Fallback message when everything fails
  fallbackMessage: string;
}

const POLICY_ID = 'dm_pipeline_config';
const POLICY_NAME = 'DM Pipeline Optimizasyon Ayarları';

const DEFAULT_CONFIG: PipelineConfig = {
  directResponse: {
    enabled: true,
    tiers: {
      light: {
        enabled: true,
        modelId: 'google/gemini-2.5-flash-lite',
        maxTokens: 400,
        temperature: 0.2,
        skipPolicyValidation: false,
      },
      standard: {
        enabled: true,
        modelId: 'moonshotai/kimi-k2',
        maxTokens: 500,
        temperature: 0.4,
        skipPolicyValidation: false,
      },
      advanced: {
        enabled: false,
        modelId: 'openai/gpt-4o-mini',
        maxTokens: 600,
        temperature: 0.3,
        skipPolicyValidation: false,
      },
    },
  },
  polling: {
    intervalMs: 2000,
    maxWaitMs: 45000,
    stableTimeoutMs: 5000,
  },
  policy: {
    enabled: true,
    maxRetries: 2,
    validationModel: 'google/gemini-2.5-flash-lite',
    correctionModel: 'same_as_tier',
    timeoutMs: 15000,
  },
  directPrompt: {
    systemTemplate: `Sen Eform Spor Merkezi'nin Instagram DM asistanısın. Müşteriye Türkçe yanıt ver.

EN ÖNEMLİ KURAL — DOĞRU BİLGİ:
- Sana verilen bilgileri AYNEN kullan. Fiyat, süre, hizmet adı DEĞİŞTİRME.
- Örnek: "MIX Masaj (50dk): 2.500 TL" yazıyorsa, sen de "MIX Masaj (50dk) 2.500 TL" yaz. Süreyi veya fiyatı DEĞİŞTİRME.
- Bilmediğin bilgiyi YAZMA. Emin değilsen "Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58" de.

SADECE SORULAN SORUYA CEVAP VER:
- Müşteri ne sorduysa SADECE onu yanıtla.
- Müşteri "merhaba" dediyse: kısaca selamla + "Size nasıl yardımcı olabilirim?" de. Başka bilgi VERME.

FİYAT SORUSU:
- Müşteri GENEL fiyat sorduğunda ("fiyat nedir", "ne kadar", "ücret"): Hangi hizmet için fiyat öğrenmek istediğini sor. Örnek: "Merhaba! Hangi hizmetimizin fiyatını öğrenmek istersiniz? Masaj, üyelik, PT dersleri gibi seçeneklerimiz var."
- Müşteri SPESİFİK fiyat sorduğunda ("masaj fiyatları", "üyelik ücreti"): Verilen fiyat listesini AYNEN kopyala. Emoji ve format değiştirme.
- Sonra ekle: "Detaylı bilgi için: 0326 502 58 58 📞"
- Fiyatlar zaten mobil uyumlu formatta hazırlanmış. Sadece kopyala yapıştır.

DİĞER KURALLAR:
- Randevu oluşturma YETKİN YOK. Randevu için: 0326 502 58 58
- Kısa, samimi, profesyonel yanıt ver (max 3-4 cümle, 1-2 emoji)
- Düz metin yaz, markdown kullanma
- "Bilgi bankası", "veri tabanı", "sistem" gibi teknik terimler KULLANMA — müşteri bunları görmemeli

GÜVENLİK FİLTRESİ (ön kontrolden geçmeyen mesajlarda bu prompt çalışmaz):
- Sexual intent skoru > %85 ise müşteriye yanıt engellenir ve bu prompta hiç gelmez.
- Sexual intent skoru %70-%85 arası ise müşteriye "Tekrar eder misiniz? Anlayamadım..." gönderilir ve bu prompta hiç gelmez.
- Bu prompt sadece sexual intent skoru <%70 mesajlar için çalışır.

VERİLEN BİLGİLER:
{{knowledge}}`,
    maxResponseLength: 500,
  },
  fallbackMessage: 'Detaylı bilgi için lütfen bizi arayın: 0326 502 58 58. Size yardımcı olmaktan memnuniyet duyarız! 😊',
};

export class PipelineConfigService {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.ensureConfigExists();
  }

  /**
   * Ensure the config row exists in mc_policies. Idempotent.
   */
  private ensureConfigExists(): void {
    const existing = this.db.prepare(
      'SELECT id FROM mc_policies WHERE id = ?'
    ).get(POLICY_ID);

    if (!existing) {
      this.db.prepare(`
        INSERT INTO mc_policies (id, name, type, conditions, actions, is_active, priority, created_at, updated_at)
        VALUES (?, ?, 'guardrail', '{}', ?, 1, 100, datetime('now'), datetime('now'))
      `).run(POLICY_ID, POLICY_NAME, JSON.stringify(DEFAULT_CONFIG));
      console.log('[PipelineConfig] Default config created in mc_policies');
    }
  }

  /**
   * Get the current pipeline config. Always reads from DB (SQLite is fast).
   */
  getConfig(): PipelineConfig {
    const row = this.db.prepare(
      'SELECT actions FROM mc_policies WHERE id = ?'
    ).get(POLICY_ID) as { actions: string } | undefined;

    if (!row) {
      // Shouldn't happen, but safety net
      this.ensureConfigExists();
      return { ...DEFAULT_CONFIG };
    }

    try {
      const stored = JSON.parse(row.actions);
      // Deep merge with defaults to handle new fields added after initial creation
      return this.mergeWithDefaults(stored);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Update pipeline config. Merges with existing config (partial updates OK).
   */
  updateConfig(partial: Partial<PipelineConfig>): PipelineConfig {
    const current = this.getConfig();
    const merged = this.deepMerge(current, partial) as PipelineConfig;

    this.db.prepare(`
      UPDATE mc_policies SET actions = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(merged), POLICY_ID);

    console.log('[PipelineConfig] Config updated');
    return merged;
  }

  /**
   * Reset config to defaults.
   */
  resetConfig(): PipelineConfig {
    this.db.prepare(`
      UPDATE mc_policies SET actions = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(DEFAULT_CONFIG), POLICY_ID);

    console.log('[PipelineConfig] Config reset to defaults');
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Check if a specific tier should use direct response (bypass OpenClaw).
   */
  shouldUseDirectResponse(tier: 'light' | 'standard' | 'advanced'): boolean {
    const config = this.getConfig();
    return config.directResponse.enabled && config.directResponse.tiers[tier].enabled;
  }

  /**
   * Check if policy validation should be skipped for a tier.
   */
  shouldSkipPolicy(tier: 'light' | 'standard' | 'advanced'): boolean {
    const config = this.getConfig();
    if (!config.policy.enabled) return true;
    // If using direct response for this tier, check tier-specific skip
    if (this.shouldUseDirectResponse(tier)) {
      return config.directResponse.tiers[tier].skipPolicyValidation;
    }
    return false;
  }

  /**
   * Get the model to use for correction based on config.
   */
  getCorrectionModel(tierModelId: string): string {
    const config = this.getConfig();
    if (config.policy.correctionModel === 'same_as_tier') {
      return tierModelId;
    }
    return config.policy.correctionModel;
  }

  /**
   * Build the system prompt for direct response, injecting knowledge context.
   */
  buildDirectSystemPrompt(knowledgeContext: string): string {
    const config = this.getConfig();
    return config.directPrompt.systemTemplate.replace('{{knowledge}}', knowledgeContext || '(veri yok)');
  }

  // --- Internal helpers ---

  private mergeWithDefaults(stored: any): PipelineConfig {
    return this.deepMerge(DEFAULT_CONFIG, stored) as PipelineConfig;
  }

  private deepMerge(target: any, source: any): any {
    if (!source || typeof source !== 'object') return target;
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        target[key] &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key])
      ) {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }
}

export { DEFAULT_CONFIG, POLICY_ID };
