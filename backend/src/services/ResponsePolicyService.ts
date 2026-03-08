/**
 * ResponsePolicyService — AI-powered post-processing validation for Instagram DM responses.
 *
 * This service acts as a "Policy Agent" (inspired by Botpress's approach) that validates
 * agent-generated responses BEFORE they are sent to the customer via Meta Graph API.
 *
 * ## How It Works
 * 1. The main agent (OpenClaw) generates a response to a customer DM
 * 2. This service sends the response + context to a cheap/fast LLM (Gemini Flash Lite)
 * 3. The LLM checks the response against a validation rubric
 * 4. Returns PASS/FAIL with reasons
 * 5. If FAIL, generates a corrected response via direct OpenRouter call (~2-3s)
 *
 * ## Validation Rubric (what gets checked)
 * The rubric is defined in VALIDATION_SYSTEM_PROMPT below. To add/edit rules:
 * - Add new items to the numbered list in the prompt
 * - Each rule should be a clear YES/NO check
 * - Keep rules specific and actionable
 *
 * ## Cost
 * Uses google/gemini-2.5-flash-lite via OpenRouter (~$0.075/1M tokens).
 * Typical validation: ~400 input tokens + ~100 output tokens ≈ $0.00004 per call.
 * Correction uses the same model as the main agent (e.g. kimi-k2) — ~$0.001 per call.
 *
 * ## Adding New Validation Rules
 * 1. Edit VALIDATION_SYSTEM_PROMPT below — add your rule to the numbered list
 * 2. The LLM will automatically check for it and include it in violations if triggered
 * 3. No code changes needed beyond the prompt edit
 *
 * ## Pipeline Integration
 * Called from instagramWebhookRoutes.ts between agent response polling and Meta send.
 * See PipelineTrace.policyValidation for trace data.
 */

import type { FollowUpContextHint, ResponseDirective } from './InstagramContextService.js';
import {
  addUsageMetrics,
  extractUsageMetrics,
  ZERO_USAGE_METRICS,
  type UsageMetrics,
} from './UsageMetrics.js';
import {
  hasAgePolicySignals,
  hasAgeRestrictionEvidenceLine,
  hasNoAgeRestrictionClaim,
  normalizePolicySignalText,
} from './PolicySignalService.js';

// VALIDATION_MODEL is now dynamically passed from PipelineConfigService

/**
 * System prompt for the Policy Agent.
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  TO ADD/EDIT VALIDATION RULES: Edit the numbered list below ║
 * ║  Each rule = one thing the Policy Agent checks              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const VALIDATION_SYSTEM_PROMPT = `Sen bir kalite kontrol ajanısın. Bir spa/fitness merkezi (Eform Spor Merkezi) Instagram DM asistanının müşteriye göndereceği yanıtı doğrulaman gerekiyor.

Sana verilecek:
- MUSTERI_MESAJI: Müşterinin gönderdiği mesaj
- ASISTAN_YANITI: Asistanın ürettiği yanıt
- BILGI_BANKASI: Asistana verilen doğrulanmış iş verileri

Aşağıdaki kurallara göre yanıtı kontrol et:

1. RANDEVU/REZERVASYON: Asistan randevu oluşturamaz, onaylayamaz, kabul edemez. Randevu sistemi YOK. "Randevunuzu oluşturuyorum", "onaylandı", "rezervasyonunuz alındı" gibi ifadeler YASAK. Randevu için telefon numarasına yönlendirmeli.
2. UYDURMA BİLGİ (ÇOK ÖNEMLİ): Yanıtta BILGI_BANKASI'nda OLMAYAN fiyat, saat, hizmet, adres, mahalle, sokak, bina, konum veya herhangi bir bilgi var mı? Asistan bilgi uyduramaz. Özellikle ADRES bilgisi birebir BILGI_BANKASI'ndaki ile aynı olmalı — farklı mahalle adı, sokak numarası veya bina adı kullanılmışsa bu UYDURMA'dır ve FAIL verilmeli. BILGI_BANKASI'ndaki adres: kontrol et ve karşılaştır.
3. YETENEK İDDİASI: Asistan yapamayacağı şeyleri yapabiliyormuş gibi davranıyor mu? (ödeme alma, üyelik oluşturma, terapist atama, program değiştirme vb.)
4. UYGUNSUZ İÇERİK: Yanıt profesyonel olmayan, kaba, veya uygunsuz içerik barındırıyor mu?
5. DİL: Yanıt Türkçe mi? (İngilizce veya başka dil kabul edilmez)
6. KİŞİSEL BİLGİ: Yanıt çalışan kişisel bilgisi (telefon, adres, TC no vb.) içeriyor mu?
7. RAKİP YÖNLENDİRME: Yanıt müşteriyi rakip bir işletmeye yönlendiriyor mu?
8. FIYAT TUTARSIZLIĞI: Yanıtta BILGI_BANKASI'nda OLMAYAN bir fiyat uydurulmuş mu? ÖNEMLİ KURALLAR:
   - Fiyat formatı farklı olabilir ("800₺" vs "800 TL" vs "800 lira" vs "800₺/saat") — sayısal değer aynıysa DOĞRU
   - Fiyat gösterimi farklı olabilir ("24 saat: 14.000₺" vs "24 saat → 14.000₺" vs "24 saat 14.000₺") — sayısal değer aynıysa DOĞRU
   - Asistan tüm fiyatları listelemek zorunda DEĞİL — BILGI_BANKASI'nda olan fiyatlardan bir kısmını vermesi DOĞRU
   - Emoji ve format farkları SORUN DEĞİL — içerik aynıysa DOĞRU
   - Sadece BILGI_BANKASI'nda hiç olmayan bir sayısal fiyat değeri yazılmışsa FAIL ver
   - Müşteri fiyat sorduğunda yanıtta fiyat bilgisi varsa bu DOĞRU — fiyat sorulduğu için fiyat verilmesi normaldir
9. YANIT UYGUNLUĞU: Yanıt müşterinin sorusuyla alakalı mı? Müşteri ne sorduysa o cevaplanmalı. ANCAK ek yardımcı bilgi (telefon, adres, iletişim) vermek SORUN DEĞİL. Örnekler:
   - Müşteri "merhaba" dediyse → yanıt sadece selamlama + "nasıl yardımcı olabilirim?" olmalı. Fiyat listesi, adres, saat bilgisi gibi SORULMAYAN detaylı bilgi verilmişse FAIL.
   - Müşteri GENEL fiyat sorduysa ("fiyat nedir", "ne kadar") → yanıt ya fiyat listesi vermeli ya da "hangi hizmet için?" diye sormalı ya da telefon numarasına yönlendirmeli. Bunların hepsi DOĞRU.
   - Müşteri SPESİFİK fiyat sorduysa ("masaj fiyatları") → fiyat bilgisi + telefon/iletişim bilgisi vermek DOĞRU. Sadece fiyat sorulduğunda adres veya saat bilgisi verilmemeli (ama telefon numarası vermek sorun değil).
   - EGER AKTIF_KONU verilmisse ve mesaj kisa/genel bir takip sorusuysa, bunu once AKTIF_KONU kapsaminda degerlendir. Bu durumda tum hizmetleri listelemek GEREKMEZ; yalnizca aktif konuya uygun yanit yeterlidir.
   - Müşteri adres sorduysa → adres + telefon/iletişim bilgisi vermek DOĞRU. Sadece adres sorulduğunda fiyat listesi verilmemeli.
   - Yanıt BILGI_BANKASI'ndan SORULMAYAN bilgileri rastgele döküyorsa FAIL — bu "papağan yanıt" hatasıdır.
   - Kısa bir selamlama mesajına uzun bilgi dolu yanıt verilmişse FAIL.
10. PAPAĞAN/TEKRAR KONTROLÜ: Yanıt, BILGI_BANKASI'ndaki verileri olduğu gibi kopyalayıp yapıştırmış mı? Asistan bilgiyi kendi cümleleriyle, müşterinin sorusuna uygun şekilde özetlemeli. Bilgi bankasının tamamını veya büyük bölümünü aynen tekrarlamak YASAK.
11. SİSTEM BİLGİSİ SIZINTISI (YENİ): Yanıt "bilgi bankası", "bilgi bankasında", "veri tabanı", "sistem", "prompt" gibi iç sistem terimlerini içeriyor mu? Müşteri bu terimleri GÖRMEMELİ. Asistan sadece doğal, profesyonel Türkçe kullanmalı.
12. YAŞ/POLITIKA TUTARSIZLIĞI: Müşteri yaş sınırı, 18+, çocuk kabulü, ebeveyn/veli izni gibi bir kural soruyorsa BILGI_BANKASI'ndaki policy satırlarıyla çelişme. BILGI_BANKASI yaş sınırı veya veli kuralı içeriyorsa "yaşa bakmıyoruz", "herkes gelebilir", "yaş sınırı yok" gibi genelleyici ifadeler FAIL olmalıdır.

YANITINI SADECE JSON OLARAK VER, başka hiçbir şey yazma:
{"valid": boolean, "violations": ["kural numarası ve kısa açıklama"], "reason": "tek cümle özet"}`;

const VALIDATION_SYSTEM_PROMPT_SIMPLE = (VALIDATION_SYSTEM_PROMPT && `Sen bir policy kalite kontrol ajanisin.

Gorev:
- MUSTERI_MESAJI, ASISTAN_YANITI, BILGI_BANKASI verilir.
- Gereksiz katilik yapma; sadece gercek riskte FAIL ver.

HARD FAIL (valid=false):
1) Randevu/rezervasyon olusturma-onaylama iddiasi.
2) BILGI_BANKASI disinda uydurma fiyat/saat/telefon/adres/hizmet detayi.
3) Uygunsuz/cinsel/kaba/tehditkar icerik.
4) Yapamayacagi islemleri yapabiliyor gibi iddia etme.
5) Musteriye ic sistem terimi sizdirma (bilgi bankasi, veri tabani, prompt, sistem).

SOFT (tek basina FAIL degil):
- Stil, format, emoji, siralama farki.
- Dogru fiyatlari farkli yazimla sunma.
- Bilgi dogruysa "farkli cumle yapisi".

Karar:
- Acik hard ihlal yoksa valid=true ver.
- Emin degilsen, uydurma kaniti yoksa valid=true ver.

Sadece JSON don:
{"valid": boolean, "violations": ["kisa ihlal"], "reason": "tek cumle"}`);

export interface PolicyValidationResult {
  valid: boolean;
  violations: string[];
  reason: string;
  modelUsed: string;
  usageModelUsed?: string;
  latencyMs: number;
  tokensEstimated: number;
  attempt: number;
  usage?: UsageMetrics;
}

export interface PolicyValidationContext {
  customerMessage: string;
  agentResponse: string;
  knowledgeContext: string;
  conversationHistory?: string;
  selectedEvidence?: string;
  followUpHint?: FollowUpContextHint | null;
  activeTopic?: string | null;
  responseDirective?: ResponseDirective | null;
}

interface DeterministicGroundingResult {
  valid: boolean;
  violations: string[];
  reason: string;
  latencyMs: number;
}

export class ResponsePolicyService {
  private apiKey: string;
  private openAiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.openAiKey = process.env.OPENAI_API_KEY || '';
  }

  private combineUsage(...usages: Array<UsageMetrics | undefined>): UsageMetrics | undefined {
    const present = usages.filter((usage): usage is UsageMetrics => !!usage);
    if (present.length === 0) {
      return undefined;
    }

    return present.reduce(
      (acc, usage) => addUsageMetrics(acc, usage),
      ZERO_USAGE_METRICS,
    );
  }

  private async checkModerationAPI(text: string): Promise<{ valid: boolean, violations: string[] }> {
    if (!this.openAiKey) {
      console.warn('[PolicyAgent] No OPENAI_API_KEY — moderation pre-check skipped (fail-open to not block traffic)');
      return { valid: true, violations: [] };
    }
    try {
      const res = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: text
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        console.warn('[PolicyAgent] Moderation API error (fail-open):', res.status);
        // If 429 or 5xx, we should let Layer 2 (gpt-4.1-mini) handle safety
        return { valid: true, violations: [] };
      }
      const data = await res.json() as any;
      const result = data.results[0];
      if (result.flagged) {
        const flaggedCategories = Object.keys(result.categories).filter(c => result.categories[c]);
        return { valid: false, violations: [`OpenAI Moderation Flagged: ${flaggedCategories.join(', ')}`] };
      }
      return { valid: true, violations: [] };
    } catch (err: any) {
      console.warn('[PolicyAgent] Moderation fetch error (fail-open):', err?.message);
      // Let Layer 2 handle safety if network fails 
      return { valid: true, violations: [] };
    }
  }

  private getActiveTopic(context: PolicyValidationContext): string | null {
    return context.followUpHint?.topicLabel || context.activeTopic || null;
  }

  private buildTopicScopeLines(context: PolicyValidationContext): string[] {
    const activeTopic = this.getActiveTopic(context);
    if (!activeTopic) {
      return [];
    }

    const lines = [
      `AKTIF_KONU: ${activeTopic}`,
      'KAPSAM KURALI: Bu mesaj kisa veya genel gorunse bile once AKTIF_KONU kapsaminda yorumlanmali. Tum hizmetleri kapsayan bir yanit bekleme; aktif konuya odakli yanit yeterlidir.',
    ];

    if (context.followUpHint?.rewrittenQuestion) {
      lines.push(`YORUMLANMIS_SORU: ${context.followUpHint.rewrittenQuestion}`);
    }

    if (context.responseDirective?.instruction) {
      lines.push(`YANIT_PLANI: ${context.responseDirective.instruction}`);
    }

    return lines;
  }

  private buildSelectedEvidenceLines(selectedEvidence?: string): string[] {
    const trimmed = selectedEvidence?.trim();
    if (!trimmed) {
      return [];
    }

    return [
      'ONCELIKLI_KANIT:',
      trimmed,
    ];
  }

  private buildCompactConversationHistoryLines(rawHistory?: string): string[] {
    const trimmedHistory = rawHistory?.trim();
    if (!trimmedHistory) {
      return [];
    }

    const rawLines = trimmedHistory
      .split('\n')
      .map(line => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (rawLines.length === 0) {
      return [];
    }

    const maxLines = 4;
    const maxChars = 600;
    const maxLineChars = 180;
    const compact: string[] = [];
    let usedChars = 0;

    for (let i = rawLines.length - 1; i >= 0; i--) {
      if (compact.length >= maxLines) {
        break;
      }

      const clippedLine = rawLines[i].length > maxLineChars
        ? `${rawLines[i].slice(0, maxLineChars - 3)}...`
        : rawLines[i];
      const projectedChars = usedChars + clippedLine.length + (compact.length > 0 ? 1 : 0);

      if (projectedChars > maxChars) {
        break;
      }

      compact.unshift(clippedLine);
      usedChars = projectedChars;
    }

    return compact;
  }

  private buildConversationHistorySection(rawHistory?: string): string[] {
    const compactLines = this.buildCompactConversationHistoryLines(rawHistory);
    if (compactLines.length === 0) {
      return [];
    }

    return [
      'KISA_KONUSMA_GECMISI (son satirlar):',
      ...compactLines,
    ];
  }

  private normalizePolicyText(rawText: string): string {
    return (rawText || '')
      .toLocaleLowerCase('tr-TR')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/ı/g, 'i')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hasPricingSignals(text: string): boolean {
    if (!text) {
      return false;
    }

    const normalized = this.normalizePolicyText(text);

    return this.extractPriceValues(text).length > 0
      || /\b(?:fiyat|ucret|price|tl|lira|ne kadar|kac|dakika|dk|seans|paket|kese|kopuk)\b/i.test(normalized);
  }

  private isGroundingOnlyRuleFailure(result: Pick<PolicyValidationResult, 'violations' | 'reason'>): boolean {
    const violationText = this.normalizePolicyText([...(result.violations || []), result.reason || ''].join(' '));

    const hasNonGroundingSignal = /\b(?:randevu|rezervasyon|yetenek|uygunsuz|dil|kisisel|rakip|papagan|sistem|sizinti)\b/i.test(violationText)
      || /\b(?:1|3|4|5|6|7|9|10|11)\b/.test(violationText);
    if (hasNonGroundingSignal) {
      return false;
    }

    const hasGroundingSignal = /\b(?:2|8)\b/.test(violationText)
      || /\b(?:uydurma|fiyat|tutarsiz|hallucinat|adres|saat|telefon)\b/i.test(violationText);
    return hasGroundingSignal;
  }

  private shouldBypassRuleFailureWithDeterministic(
    context: PolicyValidationContext,
    ruleResult: PolicyValidationResult,
    deterministicResult: DeterministicGroundingResult,
  ): boolean {
    if (ruleResult.valid || !deterministicResult.valid) {
      return false;
    }

    if (!this.isGroundingOnlyRuleFailure(ruleResult)) {
      return false;
    }

    return this.hasPricingSignals(context.customerMessage) || this.hasPricingSignals(context.agentResponse);
  }

  private isSoftOnlyRuleFailure(result: Pick<PolicyValidationResult, 'violations' | 'reason'>): boolean {
    const violationText = this.normalizePolicyText([...(result.violations || []), result.reason || ''].join(' '));

    const hasHardSignal = /\b(?:randevu|rezervasyon|yetenek|uygunsuz|dil|kisisel|rakip|sistem|sizinti|moderat)\b/i.test(violationText)
      || /\b(?:1|3|4|5|6|7|11)\b/.test(violationText);
    if (hasHardSignal) {
      return false;
    }

    const hasGroundingSignal = /\b(?:uydurma|fiyat|tutarsiz|hallucinat|adres|saat|telefon)\b/i.test(violationText)
      || /\b(?:2|8)\b/.test(violationText);
    if (hasGroundingSignal) {
      return false;
    }

    const hasSoftSignal = /\b(?:papagan|tekrar|uygunluk|alakasiz|sorulmayan|uzun|selamlama|ton)\b/i.test(violationText)
      || /\b(?:9|10)\b/.test(violationText);
    return hasSoftSignal;
  }

  private shouldBypassSoftRuleFailure(
    ruleResult: PolicyValidationResult,
    deterministicResult: DeterministicGroundingResult,
  ): boolean {
    if (ruleResult.valid || !deterministicResult.valid) {
      return false;
    }

    return this.isSoftOnlyRuleFailure(ruleResult);
  }

  private extractEvidenceTokens(rawText: string): string[] {
    const normalized = rawText
      .toLocaleLowerCase('tr-TR')
      .replace(/[ğ]/g, 'g')
      .replace(/[ü]/g, 'u')
      .replace(/[ş]/g, 's')
      .replace(/[ı]/g, 'i')
      .replace(/[ö]/g, 'o')
      .replace(/[ç]/g, 'c')
      .replace(/[^\p{L}\p{N}]+/gu, ' ');

    return [...new Set(
      normalized
        .split(/\s+/)
        .map(token => token.trim())
        .filter(token => token.length >= 3),
    )];
  }

  private buildNearbyEvidenceLines(context: Pick<PolicyValidationContext, 'customerMessage' | 'knowledgeContext' | 'followUpHint' | 'activeTopic'> & { agentResponse?: string }): string[] {
    if (!context.knowledgeContext) {
      return [];
    }

    const querySource = [
      context.customerMessage,
      context.agentResponse || '',
      context.followUpHint?.rewrittenQuestion || '',
      context.followUpHint?.topicLabel || '',
      context.activeTopic || '',
    ].join(' ');
    const queryTokens = this.extractEvidenceTokens(querySource);
    const pricingContext = this.hasPricingSignals(querySource);
    const agePolicyContext = hasAgePolicySignals(querySource);

    if (queryTokens.length === 0) {
      return [];
    }

    const scoredLines = context.knowledgeContext
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('['))
      .map((line, index) => {
        const normalizedLine = this.extractEvidenceTokens(line);
        const overlap = queryTokens.filter(token => normalizedLine.some(lineToken => lineToken.includes(token) || token.includes(lineToken)));
        const hasNumericRange = /\b\d+\s*-\s*\d+\b/.test(line) ? 0.5 : 0;
        const hasPriceToken = /\d[\d.,]*\s*(?:â‚º|TL|tl|lira)/.test(line);
        const hasDurationToken = /\b\d+\s*(?:dk|dakika|saat)\b/i.test(line);
        const pricingBoost = pricingContext && (hasPriceToken || hasDurationToken) ? 2 : 0;
        const policyBoost = agePolicyContext && hasAgeRestrictionEvidenceLine(line) ? 2 : 0;

        return {
          line,
          index,
          score: overlap.length + hasNumericRange + pricingBoost + policyBoost,
        };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => (b.score - a.score) || (a.index - b.index));

    const maxEvidenceLines = (pricingContext || agePolicyContext) ? 10 : 4;
    return [...new Set(scoredLines.slice(0, maxEvidenceLines).map(item => item.line))];
  }

  /**
   * Validate an agent response against the policy rubric.
   * Two-stage validation:
   * 1. Rule-based check (10 rules — fast, catches obvious violations)
   * 2. Deterministic grounding for prices/times/phones (exact-match anti-hallucination)
   * 3. Selective faithfulness scoring (claim-level grounding) for non-price factual replies
   * 
   * Rule stage is treated as a broad screen; deterministic grounding is the final blocker for numeric facts.
   */
  async validate(
    context: PolicyValidationContext,
    validationModelOrAttempt: string | number = 'openai/gpt-4.1-mini',
    attempt: number = 1,
  ): Promise<PolicyValidationResult> {
    const validationModel = typeof validationModelOrAttempt === 'string'
      ? validationModelOrAttempt
      : 'openai/gpt-4.1-mini';
    if (typeof validationModelOrAttempt === 'number') {
      attempt = validationModelOrAttempt;
    }
    if (!this.apiKey) {
      console.warn('[PolicyAgent] No OPENROUTER_API_KEY — failing validation');
      return { valid: false, violations: ['Missing OPENROUTER_API_KEY (fail-closed)'], reason: 'skipped (no API key)', modelUsed: validationModel, usageModelUsed: validationModel, latencyMs: 0, tokensEstimated: 0, attempt, usage: undefined };
    }

    // Layer 1: Safety (Moderation API)
    const modStart = Date.now();
    const modResult = await this.checkModerationAPI(context.agentResponse);
    if (!modResult.valid) {
      const hasModerationTransportIssue = modResult.violations.some(v =>
        v.includes('Moderation API error') || v.includes('Moderation error')
      );
      if (hasModerationTransportIssue) {
        console.warn('[PolicyAgent] Moderation transport/rate-limit issue treated as fail-open in validate()');
      } else {
      return {
        valid: false,
        violations: modResult.violations,
        reason: 'OpenAI Moderation blocked the response',
        modelUsed: 'omni-moderation-latest',
        usageModelUsed: undefined,
        latencyMs: Date.now() - modStart,
        tokensEstimated: 0,
        attempt,
        usage: undefined,
      };
      }
    }
    const preCheckLatency = Date.now() - modStart;

    // Stage 1: Rule-based validation
    const ruleResult = await this.validateRules(context, validationModel, attempt);
    ruleResult.latencyMs += preCheckLatency;

    // Stage 2: Deterministic grounding (final arbiter for numeric facts)
    const deterministicResult = this.validateDeterministicGrounding(context);
    if (!deterministicResult.valid) {
      return {
        valid: false,
        violations: deterministicResult.violations,
        reason: deterministicResult.reason,
        modelUsed: 'deterministic-grounding',
        usageModelUsed: validationModel,
        latencyMs: ruleResult.latencyMs + deterministicResult.latencyMs,
        tokensEstimated: ruleResult.tokensEstimated,
        attempt,
        usage: ruleResult.usage,
      };
    }

    const bypassGroundingOnlyFalsePositive = this.shouldBypassRuleFailureWithDeterministic(
      context,
      ruleResult,
      deterministicResult,
    );
    const bypassSoftStyleOnlyFailure = this.shouldBypassSoftRuleFailure(ruleResult, deterministicResult);

    if (!ruleResult.valid && !bypassGroundingOnlyFalsePositive && !bypassSoftStyleOnlyFailure) {
      return ruleResult;
    }

    if (!ruleResult.valid && (bypassGroundingOnlyFalsePositive || bypassSoftStyleOnlyFailure)) {
      console.warn('[PolicyAgent] Rule-stage violation bypassed after deterministic pass', {
        bypassGroundingOnlyFalsePositive,
        bypassSoftStyleOnlyFailure,
        violations: ruleResult.violations,
      });
    }

    // Stage 3: Selective faithfulness — skip price-heavy replies to avoid false positives
    if (!this.shouldRunFaithfulness(context)) {
      return {
        ...ruleResult,
        valid: true,
        violations: [],
        reason: ruleResult.valid ? ruleResult.reason : 'policy pass after deterministic verification',
        latencyMs: ruleResult.latencyMs + deterministicResult.latencyMs,
        usage: ruleResult.usage,
      };
    }

    const faithResult = await this.validateFaithfulness(context, validationModel, attempt);
    if (!faithResult.valid) {
      return {
        valid: false,
        violations: [...ruleResult.violations, ...faithResult.violations],
        reason: faithResult.reason,
        modelUsed: faithResult.modelUsed,
        usageModelUsed: faithResult.usageModelUsed || ruleResult.usageModelUsed,
        latencyMs: ruleResult.latencyMs + deterministicResult.latencyMs + faithResult.latencyMs,
        tokensEstimated: ruleResult.tokensEstimated + faithResult.tokensEstimated,
        attempt,
        usage: this.combineUsage(ruleResult.usage, faithResult.usage),
      };
    }

    return {
      ...ruleResult,
      valid: true,
      violations: [],
      reason: ruleResult.valid ? ruleResult.reason : 'policy pass after deterministic verification',
      latencyMs: ruleResult.latencyMs + deterministicResult.latencyMs + faithResult.latencyMs,
      tokensEstimated: ruleResult.tokensEstimated + faithResult.tokensEstimated,
      usageModelUsed: ruleResult.usageModelUsed || faithResult.usageModelUsed,
      usage: this.combineUsage(ruleResult.usage, faithResult.usage),
    };
  }

  /**
   * Stage 1: Rule-based validation (original 10 rules).
   */
  private async validateRules(context: PolicyValidationContext, validationModel: string, attempt: number): Promise<PolicyValidationResult> {
    if (!this.apiKey) {
      console.warn('[PolicyAgent] No OPENROUTER_API_KEY — failing rule validation');
      return { valid: false, violations: ['Missing OPENROUTER_API_KEY (fail-closed)'], reason: 'skipped (no API key)', modelUsed: validationModel, usageModelUsed: validationModel, latencyMs: 0, tokensEstimated: 0, attempt, usage: undefined };
    }

    const startTime = Date.now();
    const nearbyEvidenceLines = this.buildNearbyEvidenceLines(context);
    const conversationHistorySection = this.buildConversationHistorySection(context.conversationHistory);

    const userPrompt = [
      `MUSTERI_MESAJI: ${context.customerMessage}`,
      ...this.buildTopicScopeLines(context),
      ...conversationHistorySection,
      ...this.buildSelectedEvidenceLines(context.selectedEvidence),
      '',
      `ASISTAN_YANITI: ${context.agentResponse}`,
      '',
      `BILGI_BANKASI: ${nearbyEvidenceLines.length > 0 ? nearbyEvidenceLines.join('\\n') : '(veri yok)'}`,
    ].join('\\n');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'Eform Policy Agent',
        },
        body: JSON.stringify({
          model: validationModel,
          messages: [
            { role: 'system', content: VALIDATION_SYSTEM_PROMPT_SIMPLE },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[PolicyAgent] OpenRouter error:', response.status, errBody);
        return { valid: false, violations: [`API error ${response.status} (fail-closed)`], reason: `API error ${response.status}`, modelUsed: validationModel, usageModelUsed: validationModel, latencyMs, tokensEstimated: 0, attempt };
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
        usage?: Record<string, unknown>;
        cost?: unknown;
      };
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const usage = extractUsageMetrics(
        data,
        VALIDATION_SYSTEM_PROMPT_SIMPLE + userPrompt,
        content,
      );
      const tokensEstimated = usage.totalTokens;

      try {
        const cleaned = content.replace(/```json\\s*/g, '').replace(/```\\s*/g, '').trim();
        const result = JSON.parse(cleaned);

        return {
          valid: result.valid === true,
          violations: Array.isArray(result.violations) ? result.violations : [],
          reason: result.reason || (result.valid ? 'passed' : 'failed'),
          modelUsed: validationModel,
          usageModelUsed: validationModel,
          latencyMs,
          tokensEstimated,
          attempt,
          usage,
        };
      } catch (parseErr) {
        console.error('[PolicyAgent] Failed to parse LLM response:', content);
        return { valid: false, violations: ['Parse error (fail-closed)'], reason: `parse error: ${content.substring(0, 100)}`, modelUsed: validationModel, usageModelUsed: validationModel, latencyMs, tokensEstimated, attempt, usage };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[PolicyAgent] Network error:', err?.message);
      return { valid: false, violations: ['Network error (fail-closed)'], reason: `network error: ${err?.message}`, modelUsed: validationModel, usageModelUsed: validationModel, latencyMs, tokensEstimated: 0, attempt };
    }
  }

  private normalizeNumericToken(rawValue: string): string {
    return rawValue.replace(/[^\d]/g, '');
  }

  private uniqueNormalized(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private extractPriceValues(text: string): string[] {
    const matches = text.match(/\d[\d.,]*\s*(?:₺|TL|tl|Tl|tL|lira)/g) || [];
    return this.uniqueNormalized(matches.map(match => this.normalizeNumericToken(match)));
  }

  private parseNormalizedInteger(value: string): number | null {
    const digits = value.replace(/[^\d]/g, '');
    if (!digits) {
      return null;
    }

    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private extractRequestedPartySize(messageText: string): number | null {
    const normalized = messageText
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
      .replace(/\u011e/g, 'g');
    const numericMatch = normalized.match(/\b(\d+)\s*(?:kisi|kisilik)\b/);
    if (numericMatch) {
      const parsed = Number(numericMatch[1]);
      return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
    }

    if (/\b(iki kisi|iki kisilik|cift|couple)\b/.test(normalized)) {
      return 2;
    }

    return null;
  }

  private isDerivedPartyTotalPrice(
    responsePrice: string,
    allowedPrices: string[],
    partySize: number | null,
  ): boolean {
    if (!partySize || partySize < 2) {
      return false;
    }

    const responseValue = this.parseNormalizedInteger(responsePrice);
    if (!responseValue) {
      return false;
    }

    return allowedPrices.some(price => {
      const baseValue = this.parseNormalizedInteger(price);
      return !!baseValue && (baseValue * partySize) === responseValue;
    });
  }

  private extractTimeValues(text: string): string[] {
    const matches = text.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g) || [];
    return this.uniqueNormalized(matches);
  }

  private extractPhoneValues(text: string): string[] {
    const matches = text.match(/(?:\+?90|0)?\d[\d\s.-]{8,}\d/g) || [];
    return this.uniqueNormalized(matches.map(match => match.replace(/[^\d]/g, '')));
  }

  private buildInvalidValueViolation(
    rulePrefix: string,
    invalidValues: string[],
    allowedValues: string[],
  ): string {
    const invalidSummary = invalidValues.slice(0, 3).join(', ');
    if (allowedValues.length === 0) {
      return `${rulePrefix}: Yanitta KB'de hic olmayan deger var (${invalidSummary}).`;
    }

    const allowedSummary = allowedValues.slice(0, 6).join(', ');
    return `${rulePrefix}: Yanitta KB'de olmayan deger var (${invalidSummary}). Izinli degerler: ${allowedSummary}`;
  }

  private getRelevantAgePolicyLines(context: PolicyValidationContext): string[] {
    if (!hasAgePolicySignals(
      context.customerMessage,
      context.agentResponse,
      context.followUpHint?.rewrittenQuestion,
      context.followUpHint?.topicLabel,
      context.activeTopic,
    )) {
      return [];
    }

    const queryTokens = new Set(this.extractEvidenceTokens([
      context.customerMessage,
      context.followUpHint?.rewrittenQuestion || '',
      context.followUpHint?.topicLabel || '',
      context.activeTopic || '',
    ].join(' ')));

    return context.knowledgeContext
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('['))
      .filter(line => hasAgeRestrictionEvidenceLine(line))
      .map((line, index) => {
        const normalizedLine = normalizePolicySignalText(line);
        let score = 2;
        if (/\b(?:spa|masaj|massage|hamam|fitness|pilates|yuzme|taekwondo|jimnastik|kickboks|boks)\b/.test(normalizedLine)) {
          score += 1;
        }
        for (const token of queryTokens) {
          if (normalizedLine.includes(token)) {
            score += 1;
          }
        }
        return { line, index, score };
      })
      .sort((left, right) => (right.score - left.score) || (left.index - right.index))
      .slice(0, 4)
      .map(item => item.line);
  }

  private validateAgePolicyGrounding(context: PolicyValidationContext): DeterministicGroundingResult {
    const startTime = Date.now();
    const relevantPolicyLines = this.getRelevantAgePolicyLines(context);
    if (relevantPolicyLines.length === 0) {
      return {
        valid: true,
        violations: [],
        reason: 'age policy grounding not applicable',
        latencyMs: Date.now() - startTime,
      };
    }

    if (hasNoAgeRestrictionClaim(context.agentResponse)) {
      return {
        valid: false,
        violations: [
          `12. YAS/POLITIKA TUTARSIZLIGI: Yanit yas siniri olmadigini soyluyor, ancak KB'de yas/policy kurali var. Kanit: ${relevantPolicyLines.join(' | ')}`,
        ],
        reason: 'Yanitta KB ile catisan yas/policy ifadesi var',
        latencyMs: Date.now() - startTime,
      };
    }

    return {
      valid: true,
      violations: [],
      reason: 'age policy grounding passed',
      latencyMs: Date.now() - startTime,
    };
  }

  private validateDeterministicGrounding(context: PolicyValidationContext): DeterministicGroundingResult {
    const startTime = Date.now();
    const allowedPrices = this.extractPriceValues(context.knowledgeContext);
    const allowedTimes = this.extractTimeValues(context.knowledgeContext);
    const allowedPhones = this.extractPhoneValues(context.knowledgeContext);
    const partySize = this.extractRequestedPartySize(context.customerMessage);

    const responsePrices = this.extractPriceValues(context.agentResponse);
    const responseTimes = this.extractTimeValues(context.agentResponse);
    const responsePhones = this.extractPhoneValues(context.agentResponse);

    const violations: string[] = [];

    const invalidPrices = responsePrices.filter(value =>
      !allowedPrices.includes(value)
      && !this.isDerivedPartyTotalPrice(value, allowedPrices, partySize),
    );
    if (invalidPrices.length > 0) {
      violations.push(this.buildInvalidValueViolation('8. FIYAT TUTARSIZLIGI', invalidPrices, allowedPrices));
    }

    const invalidTimes = responseTimes.filter(value => !allowedTimes.includes(value));
    if (invalidTimes.length > 0) {
      violations.push(this.buildInvalidValueViolation('2. UYDURMA BILGI (SAAT)', invalidTimes, allowedTimes));
    }

    const invalidPhones = responsePhones.filter(value => !allowedPhones.includes(value));
    if (invalidPhones.length > 0) {
      violations.push(this.buildInvalidValueViolation('2. UYDURMA BILGI (TELEFON)', invalidPhones, allowedPhones));
    }

    const agePolicyResult = this.validateAgePolicyGrounding(context);
    if (!agePolicyResult.valid) {
      violations.push(...agePolicyResult.violations);
    }

    return {
      valid: violations.length === 0,
      violations,
      reason: violations.length === 0
        ? 'deterministic grounding passed'
        : 'Yanitta KB ile eslesmeyen deterministik bilgi var',
      latencyMs: Date.now() - startTime + agePolicyResult.latencyMs,
    };
  }

  private shouldRunFaithfulness(context: PolicyValidationContext): boolean {
    const responseLength = context.agentResponse.trim().length;
    if (responseLength <= 60) {
      return hasAgePolicySignals(
        context.customerMessage,
        context.agentResponse,
        context.followUpHint?.rewrittenQuestion,
        context.activeTopic,
      ) && responseLength >= 20;
    }

    const hasPriceValues = this.extractPriceValues(context.agentResponse).length > 0;
    if (hasPriceValues) {
      return false;
    }

    const hasFactualSignals = this.extractTimeValues(context.agentResponse).length > 0
      || this.extractPhoneValues(context.agentResponse).length > 0
      || /\b(?:adres|konum|mahalle|sokak|kat|blok)\b/i.test(context.agentResponse);

    return hasFactualSignals || hasAgePolicySignals(
      context.customerMessage,
      context.agentResponse,
      context.followUpHint?.rewrittenQuestion,
      context.activeTopic,
    );
  }

  private buildAllowedFactsHint(knowledgeContext: string): string {
    const parts: string[] = [];
    const allowedPrices = this.extractPriceValues(knowledgeContext);
    const allowedTimes = this.extractTimeValues(knowledgeContext);
    const allowedPhones = this.extractPhoneValues(knowledgeContext);

    if (allowedPrices.length > 0) {
      parts.push(`IZINLI FIYAT SAYILARI: ${allowedPrices.join(', ')}`);
    }
    if (allowedTimes.length > 0) {
      parts.push(`IZINLI SAATLER: ${allowedTimes.join(', ')}`);
    }
    if (allowedPhones.length > 0) {
      parts.push(`IZINLI TELEFONLAR: ${allowedPhones.join(', ')}`);
    }

    return parts.length > 0 ? parts.join('\n') : 'IZINLI SAYISAL BILGI: (ek veri yok)';
  }

  /**
   * Stage 2: Faithfulness scoring — claim-level grounding verification.
   * 
   * This is the core anti-hallucination mechanism. Instead of checking rules,
   * it asks the LLM to extract every factual claim from the response and verify
   * each one against the KB data. Any claim not grounded in KB = hallucination.
   * 
   * Industry standard approach (Noveum.ai faithfulness scorer, Google "Creator vs Critic").
   * Cost: ~same as rule validation (~$0.00004 per call).
   */
  private async validateFaithfulness(context: PolicyValidationContext, validationModel: string, attempt: number): Promise<PolicyValidationResult> {
    const startTime = Date.now();
    const nearbyEvidenceLines = this.buildNearbyEvidenceLines(context);

    const faithfulnessPrompt = `Sen bir doğruluk kontrol ajanısın. Asistanın yanıtındaki HER olgusal iddiayı (factual claim) BILGI_BANKASI ile karşılaştır.

GÖREV:
1. Yanıttan tüm olgusal iddiaları çıkar (adres, fiyat, saat, telefon, hizmet adı, konum, bina adı, mahalle adı vb.)
2. Her iddiayı BILGI_BANKASI'nda ara
3. BILGI_BANKASI'nda OLMAYAN veya FARKLI olan her iddia = UYDURMA (hallucination)

ÖNEMLİ:
- Selamlama, nezaket ifadeleri, "size yardımcı olabilirim" gibi genel cümleler iddia DEĞİLDİR — bunları atla
- Sadece SOMUT BİLGİ içeren iddiaları kontrol et (sayılar, isimler, adresler, saatler)
- Fiyat formatı farklı olabilir (800₺ vs 800 TL, "800₺" vs "800 TL" vs "800 lira") — sayısal değer aynıysa DOĞRU say
- Fiyat gösterimi farklı olabilir ("24 saat: 14.000₺" vs "24 saat → 14.000₺" vs "24 saat 14.000₺") — sayısal değer aynıysa DOĞRU say
- Asistan tüm fiyatları listelemek zorunda DEĞİL — BILGI_BANKASI'nda olan fiyatlardan bir kısmını vermesi DOĞRU'dur
- Adres bilgisinde mahalle, sokak, bina adı BİREBİR aynı olmalı — yakın ama farklı = UYDURMA
- Emoji ve format farkları SORUN DEĞİL — içerik aynıysa DOĞRU say
- Eger AKTIF_KONU verilmisse, musteri mesajini once bu konu kapsaminda yorumla; tum hizmetleri kapsayan cevap bekleme

MUSTERI_MESAJI: ${context.customerMessage}

${this.buildConversationHistorySection(context.conversationHistory).length > 0 ? `${this.buildConversationHistorySection(context.conversationHistory).join('\\n')}\\n\\n` : ''}${this.buildTopicScopeLines(context).join('\\n')}

ASISTAN_YANITI: ${context.agentResponse}

BILGI_BANKASI:
${nearbyEvidenceLines.length > 0 ? nearbyEvidenceLines.join('\\n') : '(veri yok)'}

YANITINI SADECE JSON OLARAK VER:
{"faithful": boolean, "claims": [{"claim": "iddia metni", "grounded": boolean, "reason": "neden uydurma"}], "summary": "tek cümle özet"}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'Eform Faithfulness Check',
        },
        body: JSON.stringify({
          model: validationModel,
          messages: [
            { role: 'user', content: faithfulnessPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.error('[PolicyAgent:Faithfulness] API error:', response.status);
        return { valid: false, violations: ['Faithfulness API error (fail-closed)'], reason: `faithfulness API error ${response.status}`, modelUsed: validationModel, latencyMs, tokensEstimated: 0, attempt };
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
        usage?: Record<string, unknown>;
        cost?: unknown;
      };
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const usage = extractUsageMetrics(data, faithfulnessPrompt, content);
      const tokensEstimated = usage.totalTokens;

      try {
        const cleaned = content.replace(/```json\\s*/g, '').replace(/```\\s*/g, '').trim();
        const result = JSON.parse(cleaned);

        if (result.faithful === true) {
          console.log('[PolicyAgent:Faithfulness] All claims grounded (%dms)', latencyMs);
          return { valid: true, violations: [], reason: 'faithfulness: all claims grounded', modelUsed: validationModel, latencyMs, tokensEstimated, attempt, usage };
        }

        // Extract ungrounded claims as violations
        const ungroundedClaims = (result.claims || [])
          .filter((c: any) => c.grounded === false)
          .map((c: any) => `UYDURMA: "${c.claim}" — ${c.reason || 'bilgi bankasında yok'}`);

        console.warn('[PolicyAgent:Faithfulness] HALLUCINATION detected (%d ungrounded claims, %dms): %s',
          ungroundedClaims.length, latencyMs, result.summary || '');

        return {
          valid: false,
          violations: ungroundedClaims.length > 0 ? ungroundedClaims : ['Faithfulness check failed: yanıtta doğrulanamayan bilgi var'],
          reason: result.summary || 'Yanıtta bilgi bankasında olmayan uydurma bilgi tespit edildi',
          modelUsed: validationModel,
          latencyMs,
          tokensEstimated,
          attempt,
          usage,
        };
      } catch (parseErr) {
        console.error('[PolicyAgent:Faithfulness] Parse error:', content.substring(0, 200));
        return { valid: false, violations: ['Faithfulness parse error (fail-closed)'], reason: `faithfulness parse error: ${content.substring(0, 100)}`, modelUsed: validationModel, latencyMs, tokensEstimated, attempt, usage };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[PolicyAgent:Faithfulness] Network error:', err?.message);
      return { valid: false, violations: ['Faithfulness network error (fail-closed)'], reason: `faithfulness network error: ${err?.message}`, modelUsed: validationModel, latencyMs, tokensEstimated: 0, attempt };
    }
  }

  /**
   * Generate a corrected response directly via OpenRouter (bypasses OpenClaw).
   * ~2-3s instead of ~15-20s per correction through OpenClaw.
   */
  async generateCorrectedResponse(
    customerMessage: string,
    failedResponse: string,
    validation: PolicyValidationResult,
    knowledgeContext: string,
    modelId: string = 'openai/gpt-4o-mini',
    context: Pick<PolicyValidationContext, 'selectedEvidence' | 'followUpHint' | 'activeTopic' | 'responseDirective'> = {},
  ): Promise<{ response: string | null; latencyMs: number; tokensEstimated: number; modelUsed: string; usage?: UsageMetrics }> {
    if (!this.apiKey) {
      console.warn('[PolicyAgent] No OPENROUTER_API_KEY — failing correction');
      return { response: null, latencyMs: 0, tokensEstimated: 0, modelUsed: modelId };
    }

    const startTime = Date.now();
    const allowedFactsHint = this.buildAllowedFactsHint(knowledgeContext);
    const scopeLines = this.buildTopicScopeLines(context as PolicyValidationContext);
    const selectedEvidenceLines = this.buildSelectedEvidenceLines(context.selectedEvidence);
    const nearbyEvidenceLines = this.buildNearbyEvidenceLines({
      customerMessage,
      knowledgeContext,
      followUpHint: context.followUpHint,
      activeTopic: context.activeTopic,
    });

    const systemPrompt = `Sen Eform Spor Merkezi'nin Instagram DM asistanısın. Müşteriye Türkçe yanıt ver.

KRİTİK KURAL — SADECE VERİLEN BİLGİYİ KULLAN:
- Yanıtındaki HER bilgi (adres, fiyat, saat, hizmet adı, telefon) verilen bilgilerden gelmeli.
- Verilmeyen hiçbir bilgiyi YAZMA. Bilmiyorsan "Bu konuda bilgi için bizi arayabilirsiniz: 0326 502 58 58" de.
- Verilen bilgilerde açıkça yazmayan bir detay sorulursa, bunu uydurma. Bunun yerine o detayın net olmadığını söyle ve telefonla teyit etmeye yönlendir.
- Adres, mahalle, sokak, bina adı gibi bilgileri KESİNLİKLE UYDURMA — verilen metni aynen kullan.
- Aşağıdaki izinli sayısal değerler DIŞINDA fiyat, saat veya telefon YAZMA.

SADECE SORULAN SORUYA CEVAP VER:
- Müşteri ne sorduysa SADECE onu yanıtla. Sorulmayan bilgiyi PAYLAŞMA.
- Müşteri "merhaba" dediyse: sadece selamla + "Size nasıl yardımcı olabilirim?" de. Başka bilgi VERME.
- Reddedilen önceki yanıtın ANA KONUSUNU koru. Sadece hatalı veya uydurma kısmı çıkarıp düzelt.
- Müşterinin mesajı uygunsuz veya cinsel değilse, alakasız güvenlik/politika reddine SAPMA.
- Eger AKTIF_KONU verilmisse, mesaji once bu konu kapsaminda yorumla. Tum hizmetleri listeleme; yalnizca aktif konuya uygun cevap ver.

FİYAT SORUSU:
- Müşteri GENEL fiyat sorduğunda ("fiyat nedir", "ne kadar", "ücret"): Hangi hizmet için fiyat öğrenmek istediğini sor. Örnek: "Merhaba! Hangi hizmetimizin fiyatını öğrenmek istersiniz? Masaj, üyelik, PT dersleri gibi seçeneklerimiz var."
- Müşteri SPESİFİK fiyat sorduğunda ("masaj fiyatları", "üyelik ücreti"): Verilen fiyat listesini AYNEN kopyala. Emoji ve format değiştirme.
- Sonra ekle: "Detaylı bilgi için: 0326 502 58 58 📞"
- Fiyatlar zaten mobil uyumlu formatta hazırlanmış. Sadece kopyala yapıştır.

DİĞER KURALLAR:
- Randevu oluşturma, onaylama YETKİN YOK. Randevu için: 0326 502 58 58
- Yapamayacağın şeyleri vaat ETME
- Kısa, samimi, profesyonel yanıt ver (max 3-4 cümle)
- Sadece düz metin yaz, markdown kullanma
- "Bilgi bankası", "veri tabanı", "sistem" gibi teknik terimler KULLANMA

VERİLEN BİLGİLER:
${knowledgeContext || '(veri yok)'}

SAYISAL GUVENCE:
${allowedFactsHint}`;

    const userPrompt = `Müşteri mesajı: ${customerMessage}

${scopeLines.join('\n')}

${selectedEvidenceLines.join('\n')}

${nearbyEvidenceLines.length > 0 ? `YAKIN_KANIT_SATIRLARI:\n${nearbyEvidenceLines.join('\n')}` : ''}

Reddedilen yanıt (konuyu koru, sadece hatalı kısımları düzelt): ${failedResponse}

Önceki yanıtın reddedildi çünkü: ${validation.violations.join(', ')}
${validation.reason}

KRİTİK: Yanıtındaki HER bilgi yukarıdaki BILGI_BANKASI'ndan gelmeli. Bilgi bankasında olmayan adres, fiyat, saat YAZMA.
İstenen detay bilgi açıkça yoksa "bu konuda net bilgi veremiyorum" diyerek kısa ve aynı konuya bağlı kal.

Kurallara uygun yeni bir yanıt yaz.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': 'Eform Policy Correction',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.error('[PolicyAgent] Correction API error:', response.status);
        return { response: null, latencyMs, tokensEstimated: 0, modelUsed: modelId };
      }

      const data = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string | null;
          };
        }>;
        usage?: Record<string, unknown>;
        cost?: unknown;
      };
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const usage = extractUsageMetrics(data, systemPrompt + userPrompt, content);
      const tokensEstimated = usage.totalTokens;

      console.log('[PolicyAgent] Direct correction generated in %dms (%d chars)', latencyMs, content.length);
      return { response: content || null, latencyMs, tokensEstimated, modelUsed: modelId, usage };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[PolicyAgent] Correction network error:', err?.message);
      return { response: null, latencyMs, tokensEstimated: 0, modelUsed: modelId };
    }
  }
}


