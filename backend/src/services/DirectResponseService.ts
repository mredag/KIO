/**
 * DirectResponseService — Calls OpenRouter directly, bypassing OpenClaw gateway.
 *
 * Used for "light" tier messages (greetings, simple queries) where the full
 * OpenClaw pipeline (session creation → agent context loading → JSONL polling)
 * adds ~8-10s of overhead for no benefit.
 *
 * This service uses the same pattern as ResponsePolicyService.generateCorrectedResponse()
 * but is purpose-built for primary response generation.
 *
 * Typical latency: ~1.5-3s (vs ~10-12s through OpenClaw)
 */

import type { DirectResponseTierConfig } from './PipelineConfigService.js';
import type { FollowUpContextHint } from './InstagramContextService.js';
import type { ResponseDirective } from './InstagramContextService.js';

export interface DirectResponseResult {
  response: string | null;
  modelId: string;
  latencyMs: number;
  tokensEstimated: number;
  success: boolean;
  error?: string;
}

export class DirectResponseService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Generate a response directly via OpenRouter API.
   */
  async generate(params: {
    customerMessage: string;
    knowledgeContext: string;
    selectedEvidence?: string;
    conversationHistory: string;
    followUpHint?: FollowUpContextHint | null;
    responseDirective?: ResponseDirective;
    customerSummary: string;
    isNewCustomer: boolean;
    tierConfig: DirectResponseTierConfig;
    systemPrompt: string;
  }): Promise<DirectResponseResult> {
    const {
      customerMessage,
      selectedEvidence,
      conversationHistory,
      followUpHint,
      responseDirective,
      customerSummary,
      tierConfig,
      systemPrompt,
    } = params;

    if (!this.apiKey) {
      return {
        response: null, modelId: tierConfig.modelId,
        latencyMs: 0, tokensEstimated: 0, success: false,
        error: 'No OPENROUTER_API_KEY',
      };
    }

    const startTime = Date.now();

    // Build ENHANCED system prompt with conversation history at the TOP
    // This makes the AI more aware of context before reading the customer message
    const systemParts = [];
    if (conversationHistory) {
      console.log('[DirectResponse] Conversation history length:', conversationHistory.length, 'chars');
      console.log('[DirectResponse] History preview:', conversationHistory.substring(0, 200));
      systemParts.push(`═══════════════════════════════════════════════════════════════`);
      systemParts.push(`KONUŞMA GEÇMİŞİ (SON MESAJLAR):`);
      systemParts.push(`═══════════════════════════════════════════════════════════════`);
      systemParts.push(conversationHistory);
      systemParts.push('');
      systemParts.push(`ŞİMDİ müşteri yeni bir mesaj gönderdi. Yukarıdaki konuşma geçmişini KULLAN.`);
      systemParts.push(`═══════════════════════════════════════════════════════════════`);
      systemParts.push('');
    } else {
      console.log('[DirectResponse] NO conversation history provided');
    }
    if (responseDirective) {
      console.log('[DirectResponse] Applying response directive:', responseDirective.mode);
      systemParts.push('YANIT PLANI:');
      systemParts.push(`- Mod: ${responseDirective.mode}`);
      systemParts.push(`- Talimat: ${responseDirective.instruction}`);
      systemParts.push(`- Gerekce: ${responseDirective.rationale}`);
      systemParts.push('- Sorulmayan bilgiyi yayma, tek adimlik netlestirme disina cikma.');
      systemParts.push('');
    }
    if (followUpHint) {
      console.log('[DirectResponse] Applying follow-up hint:', followUpHint.rewrittenQuestion);
      systemParts.push('DEVAM EDEN KONU KURALI:');
      systemParts.push(`- Konu zaten belli: ${followUpHint.topicLabel}.`);
      systemParts.push(`- Bu yeni mesaji "${followUpHint.rewrittenQuestion}" olarak yorumla.`);
      systemParts.push('- Musteriye tekrar "hangi hizmet" diye sorma.');
      systemParts.push('- Sadece bu aktif konuya ait bilgiyi ver.');
      systemParts.push('- Eger verilen bilgiler aktif konu icin net cevap iceriyorsa, konusma gecmisinde daha once "net bilgi veremiyorum" denmis olsa bile bu guncel bilgiyi kullan.');
      systemParts.push('');
    }
    if (selectedEvidence?.trim()) {
      console.log('[DirectResponse] Applying selected evidence:', selectedEvidence.substring(0, 160));
      systemParts.push('ONCELIKLI KANIT:');
      systemParts.push('- Once bu secilmis kanittaki bilgileri kullan.');
      systemParts.push('- Genis bilgi baglamini sadece eksik kalan noktayi tamamlamak icin kullan.');
      systemParts.push(selectedEvidence.trim());
      systemParts.push('');
    }
    systemParts.push('KISMEN CEVAP KURALI:');
    systemParts.push('- Musteri birden fazla detay soruyorsa ve verilen bilgiler bunlarin sadece bir kismini kapsiyorsa, bildigin kisimlari ver.');
    systemParts.push('- Sadece eksik kalan kisim icin "bu konuda net bilgi veremiyorum" diyebilirsin.');
    systemParts.push('- Tum yaniti telefon yonlendirmesine cevirme; once eldeki net bilgiyi kullan.');
    systemParts.push('');
    systemParts.push(systemPrompt);
    const enhancedSystemPrompt = systemParts.join('\n');

    // Build user prompt — just the customer message + summary
    const userParts = [
      `Müşteri mesajı: ${customerMessage}`,
    ];
    if (followUpHint) {
      userParts.push(`\nKod notu: Bu mesaj onceki "${followUpHint.topicLabel}" konusunun devamidir.`);
      userParts.push(`\nBu mesaji su net soru gibi ele al: ${followUpHint.rewrittenQuestion}`);
    }
    if (responseDirective) {
      userParts.push(`\nYanit modu: ${responseDirective.mode}`);
      userParts.push(`\nYanit talimati: ${responseDirective.instruction}`);
    }
    if (selectedEvidence?.trim()) {
      userParts.push('\nOncelikli kanit aktif soruya dogrudan yardim eden secilmis bilgilerdir.');
    }
    if (customerSummary) {
      userParts.push(`\nMüşteri: ${customerSummary}`);
    }
    const userPrompt = userParts.join('');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://spa-kiosk.local',
          'X-Title': 'Eform Direct DM',
        },
        body: JSON.stringify({
          model: tierConfig.modelId,
          messages: [
            { role: 'system', content: enhancedSystemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: tierConfig.temperature,
          max_tokens: tierConfig.maxTokens,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[DirectResponse] OpenRouter error:', response.status, errBody);
        return {
          response: null, modelId: tierConfig.modelId,
          latencyMs, tokensEstimated: 0, success: false,
          error: `API error ${response.status}`,
        };
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      const estimateTokens = (text: string) => Math.ceil(text.length / 3);
      const tokensEstimated = estimateTokens(enhancedSystemPrompt + userPrompt) + estimateTokens(content);

      console.log('[DirectResponse] Generated in %dms via %s (%d chars)',
        latencyMs, tierConfig.modelId, content.length);

      return {
        response: content || null,
        modelId: tierConfig.modelId,
        latencyMs,
        tokensEstimated,
        success: !!content,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[DirectResponse] Network error:', err?.message);
      return {
        response: null, modelId: tierConfig.modelId,
        latencyMs, tokensEstimated: 0, success: false,
        error: err?.message || 'Network error',
      };
    }
  }
}
