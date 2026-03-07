/**
 * WhatsAppPipelineConfigService — Dynamic WhatsApp pipeline configuration stored in mc_policies.
 *
 * Same pattern as PipelineConfigService (Instagram) but with WhatsApp-specific defaults:
 * - Plain text formatting (no markdown)
 * - Appointment flow settings
 * - Ignore list toggle
 * - WhatsApp-specific system prompt with CANNOT-do list
 *
 * Config is stored as JSON in the `actions` column of mc_policies (id: wa_pipeline_config).
 * PATCH updates deep-merge with existing config, so you can update a single field.
 */

import Database from 'better-sqlite3';

export interface DirectResponseTierConfig {
  enabled: boolean;
  modelId: string;
}

export interface WhatsAppPipelineConfig {
  directResponse: {
    enabled: boolean;
    tiers: {
      light: DirectResponseTierConfig;
      standard: DirectResponseTierConfig;
      advanced: DirectResponseTierConfig;
    };
  };
  policy: {
    enabled: boolean;
    maxRetries: number;
    validationModel: string;
    correctionModel: string;
    timeoutMs: number;
    appointmentClaimRule: boolean;
  };
  directPrompt: {
    systemTemplate: string;
    maxResponseLength: number;
  };
  fallbackMessage: string;
  ignoreList: { enabled: boolean };
  appointmentFlow: { enabled: boolean; telegramNotification: boolean };
}

const POLICY_ID = 'wa_pipeline_config';
const POLICY_NAME = 'WhatsApp Pipeline Ayarları';

const DEFAULT_CONFIG: WhatsAppPipelineConfig = {
  directResponse: {
    enabled: true,
    tiers: {
      light: { enabled: true, modelId: 'openai/gpt-4.1-mini' },
      standard: { enabled: true, modelId: 'openai/gpt-4o-mini' },
      advanced: { enabled: false, modelId: 'openai/gpt-4o-mini' },
    },
  },
  policy: {
    enabled: true,
    maxRetries: 2,
    validationModel: 'openai/gpt-4.1-mini',
    correctionModel: 'openai/gpt-4o-mini',
    timeoutMs: 15000,
    appointmentClaimRule: true,
  },
  directPrompt: {
    systemTemplate: `Sen Eform Spor Merkezi'nin WhatsApp asistanısın. SADECE BİLGİ BANKASINI KULLAN.

{{knowledge}}

Kurallar:
- Sadece yukarıdaki bilgileri kullan
- Bilmediğin konularda 'Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58' de
- Randevu oluşturma, ödeme işleme, üyelik değiştirme, terapist atama, müsaitlik garantisi YAPAMAZ
- Düz metin kullan, markdown kullanma
- Kısa ve öz cevap ver (4-5 cümle max)
- Emoji zorunlu degil; dogal ise en fazla 1 emoji kullan`,
    maxResponseLength: 500,
  },
  fallbackMessage: 'Detaylı bilgi için bizi arayabilirsiniz: 0326 502 58 58 📞',
  ignoreList: { enabled: true },
  appointmentFlow: { enabled: true, telegramNotification: true },
};

export class WhatsAppPipelineConfigService {
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
      console.log('[WhatsAppPipelineConfig] Default config created in mc_policies');
    }
  }

  /**
   * Get the current pipeline config. Always reads from DB (SQLite is fast).
   */
  getConfig(): WhatsAppPipelineConfig {
    const row = this.db.prepare(
      'SELECT actions FROM mc_policies WHERE id = ?'
    ).get(POLICY_ID) as { actions: string } | undefined;

    if (!row) {
      this.ensureConfigExists();
      return { ...DEFAULT_CONFIG };
    }

    try {
      const stored = JSON.parse(row.actions);
      return this.mergeWithDefaults(stored);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Update pipeline config. Merges with existing config (partial updates OK).
   */
  updateConfig(partial: Partial<WhatsAppPipelineConfig>): WhatsAppPipelineConfig {
    const current = this.getConfig();
    const merged = this.deepMerge(current, partial) as WhatsAppPipelineConfig;

    this.db.prepare(`
      UPDATE mc_policies SET actions = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(merged), POLICY_ID);

    console.log('[WhatsAppPipelineConfig] Config updated');
    return merged;
  }

  /**
   * Reset config to defaults.
   */
  resetConfig(): WhatsAppPipelineConfig {
    this.db.prepare(`
      UPDATE mc_policies SET actions = ?, updated_at = datetime('now') WHERE id = ?
    `).run(JSON.stringify(DEFAULT_CONFIG), POLICY_ID);

    console.log('[WhatsAppPipelineConfig] Config reset to defaults');
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Check if a specific tier should use direct response.
   */
  shouldUseDirectResponse(tier: 'light' | 'standard' | 'advanced'): boolean {
    const config = this.getConfig();
    return config.directResponse.enabled && config.directResponse.tiers[tier]?.enabled === true;
  }

  /**
   * Build the system prompt for direct response, injecting knowledge context.
   */
  buildDirectSystemPrompt(knowledge: string): string {
    const config = this.getConfig();
    return [
      config.directPrompt.systemTemplate.replace('{{knowledge}}', knowledge || '(veri yok)'),
      '',
      'STIL NORMALIZASYONU:',
      '- Ayni acilisi, ayni emojiyi ve ayni kapanis cumlesini tekrar tekrar kullanma.',
      '- Emoji zorunlu degildir; dogal ise en fazla 1 emoji kullan.',
      '- Telefon veya ek yonlendirme bilgisini sadece gercekten gerekiyorsa ekle.',
    ].join('\n');
  }

  // --- Internal helpers ---

  private mergeWithDefaults(stored: any): WhatsAppPipelineConfig {
    return this.deepMerge(DEFAULT_CONFIG, stored) as WhatsAppPipelineConfig;
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
