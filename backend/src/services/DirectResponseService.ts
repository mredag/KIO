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

import type { PipelineConfig, DirectResponseTierConfig } from './PipelineConfigService.js';

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
    conversationHistory: string;
    customerSummary: string;
    isNewCustomer: boolean;
    tierConfig: DirectResponseTierConfig;
    systemPrompt: string;
  }): Promise<DirectResponseResult> {
    const { customerMessage, conversationHistory, customerSummary, tierConfig, systemPrompt } = params;

    if (!this.apiKey) {
      return {
        response: null, modelId: tierConfig.modelId,
        latencyMs: 0, tokensEstimated: 0, success: false,
        error: 'No OPENROUTER_API_KEY',
      };
    }

    const startTime = Date.now();

    // Build user prompt — minimal, just the customer message + context
    const userParts = [
      `Müşteri mesajı: ${customerMessage}`,
    ];
    if (customerSummary) {
      userParts.push(`\nMüşteri: ${customerSummary}`);
    }
    if (conversationHistory) {
      userParts.push(`\nSon konuşma:\n${conversationHistory}`);
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
            { role: 'system', content: systemPrompt },
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
      const tokensEstimated = estimateTokens(systemPrompt + userPrompt) + estimateTokens(content);

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
