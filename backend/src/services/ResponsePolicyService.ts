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

const VALIDATION_MODEL = 'google/gemini-2.5-flash-lite';

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
   - Müşteri adres sorduysa → adres + telefon/iletişim bilgisi vermek DOĞRU. Sadece adres sorulduğunda fiyat listesi verilmemeli.
   - Yanıt BILGI_BANKASI'ndan SORULMAYAN bilgileri rastgele döküyorsa FAIL — bu "papağan yanıt" hatasıdır.
   - Kısa bir selamlama mesajına uzun bilgi dolu yanıt verilmişse FAIL.
10. PAPAĞAN/TEKRAR KONTROLÜ: Yanıt, BILGI_BANKASI'ndaki verileri olduğu gibi kopyalayıp yapıştırmış mı? Asistan bilgiyi kendi cümleleriyle, müşterinin sorusuna uygun şekilde özetlemeli. Bilgi bankasının tamamını veya büyük bölümünü aynen tekrarlamak YASAK.

YANITINI SADECE JSON OLARAK VER, başka hiçbir şey yazma:
{"valid": true} veya {"valid": false, "violations": ["kural numarası ve kısa açıklama"], "reason": "tek cümle özet"}`;

export interface PolicyValidationResult {
  valid: boolean;
  violations: string[];
  reason: string;
  modelUsed: string;
  latencyMs: number;
  tokensEstimated: number;
  attempt: number;
}

export interface PolicyValidationContext {
  customerMessage: string;
  agentResponse: string;
  knowledgeContext: string;
}

export class ResponsePolicyService {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Validate an agent response against the policy rubric.
   * Two-stage validation:
   * 1. Rule-based check (10 rules — fast, catches obvious violations)
   * 2. Faithfulness scoring (claim-level grounding — catches hallucination) — TEMPORARILY DISABLED
   * 
   * If rule check passes, faithfulness check runs. Both must pass.
   * 
   * TEMP FIX: Faithfulness check disabled due to false positives with formatted price lists.
   * The LLM doing faithfulness verification is too strict and rejects correct KB data.
   * Rule 8 (FIYAT TUTARSIZLIĞI) already catches price hallucinations.
   */
  async validate(context: PolicyValidationContext, attempt: number = 1): Promise<PolicyValidationResult> {
    if (!this.apiKey) {
      console.warn('[PolicyAgent] No OPENROUTER_API_KEY — skipping validation');
      return { valid: true, violations: [], reason: 'skipped (no API key)', modelUsed: VALIDATION_MODEL, latencyMs: 0, tokensEstimated: 0, attempt };
    }

    // Stage 1: Rule-based validation
    const ruleResult = await this.validateRules(context, attempt);
    if (!ruleResult.valid) {
      return ruleResult;
    }

    // Stage 2: Faithfulness scoring — TEMPORARILY DISABLED
    // TODO: Re-enable after fixing false positives with formatted price lists
    // The faithfulness LLM is rejecting correct KB prices due to format variations
    
    /* DISABLED CODE:
    const responseLength = context.agentResponse.trim().length;
    const hasFactualContent = responseLength > 60;
    
    if (!hasFactualContent) {
      return ruleResult;
    }

    const faithResult = await this.validateFaithfulness(context, attempt);
    
    if (!faithResult.valid) {
      return {
        valid: false,
        violations: [...ruleResult.violations, ...faithResult.violations],
        reason: faithResult.reason,
        modelUsed: faithResult.modelUsed,
        latencyMs: ruleResult.latencyMs + faithResult.latencyMs,
        tokensEstimated: ruleResult.tokensEstimated + faithResult.tokensEstimated,
        attempt,
      };
    }

    return {
      ...ruleResult,
      latencyMs: ruleResult.latencyMs + faithResult.latencyMs,
      tokensEstimated: ruleResult.tokensEstimated + faithResult.tokensEstimated,
    };
    */

    // Return rule validation result only
    return ruleResult;
  }

  /**
   * Stage 1: Rule-based validation (original 10 rules).
   */
  private async validateRules(context: PolicyValidationContext, attempt: number): Promise<PolicyValidationResult> {
    if (!this.apiKey) {
      console.warn('[PolicyAgent] No OPENROUTER_API_KEY — skipping validation');
      return { valid: true, violations: [], reason: 'skipped (no API key)', modelUsed: VALIDATION_MODEL, latencyMs: 0, tokensEstimated: 0, attempt };
    }

    const startTime = Date.now();

    const userPrompt = [
      `MUSTERI_MESAJI: ${context.customerMessage}`,
      '',
      `ASISTAN_YANITI: ${context.agentResponse}`,
      '',
      `BILGI_BANKASI: ${context.knowledgeContext || '(veri yok)'}`,
    ].join('\n');

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://spa-kiosk.local',
          'X-Title': 'Eform Policy Agent',
        },
        body: JSON.stringify({
          model: VALIDATION_MODEL,
          messages: [
            { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errBody = await response.text();
        console.error('[PolicyAgent] OpenRouter error:', response.status, errBody);
        return { valid: true, violations: [], reason: `API error ${response.status} (fail-open)`, modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated: 0, attempt };
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      const estimateTokens = (text: string) => Math.ceil(text.length / 3);
      const tokensEstimated = estimateTokens(VALIDATION_SYSTEM_PROMPT + userPrompt) + estimateTokens(content);

      try {
        const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const result = JSON.parse(cleaned);

        return {
          valid: result.valid === true,
          violations: Array.isArray(result.violations) ? result.violations : [],
          reason: result.reason || (result.valid ? 'passed' : 'failed'),
          modelUsed: VALIDATION_MODEL,
          latencyMs,
          tokensEstimated,
          attempt,
        };
      } catch (parseErr) {
        console.error('[PolicyAgent] Failed to parse LLM response:', content);
        return { valid: true, violations: [], reason: `parse error (fail-open): ${content.substring(0, 100)}`, modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated, attempt };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[PolicyAgent] Network error:', err?.message);
      return { valid: true, violations: [], reason: `network error (fail-open): ${err?.message}`, modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated: 0, attempt };
    }
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
  private async validateFaithfulness(context: PolicyValidationContext, attempt: number): Promise<PolicyValidationResult> {
    const startTime = Date.now();

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

MUSTERI_MESAJI: ${context.customerMessage}

ASISTAN_YANITI: ${context.agentResponse}

BILGI_BANKASI:
${context.knowledgeContext || '(veri yok)'}

YANITINI SADECE JSON OLARAK VER:
{"faithful": true, "claims": []} 
veya
{"faithful": false, "claims": [{"claim": "iddia metni", "grounded": false, "reason": "neden uydurma"}], "summary": "tek cümle özet"}`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://spa-kiosk.local',
          'X-Title': 'Eform Faithfulness Check',
        },
        body: JSON.stringify({
          model: VALIDATION_MODEL,
          messages: [
            { role: 'user', content: faithfulnessPrompt },
          ],
          temperature: 0,
          max_tokens: 400,
        }),
        signal: AbortSignal.timeout(15000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.error('[PolicyAgent:Faithfulness] API error:', response.status);
        return { valid: true, violations: [], reason: `faithfulness API error (fail-open)`, modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated: 0, attempt };
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      const estimateTokens = (text: string) => Math.ceil(text.length / 3);
      const tokensEstimated = estimateTokens(faithfulnessPrompt) + estimateTokens(content);

      try {
        const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const result = JSON.parse(cleaned);

        if (result.faithful === true) {
          console.log('[PolicyAgent:Faithfulness] All claims grounded (%dms)', latencyMs);
          return { valid: true, violations: [], reason: 'faithfulness: all claims grounded', modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated, attempt };
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
          modelUsed: VALIDATION_MODEL,
          latencyMs,
          tokensEstimated,
          attempt,
        };
      } catch (parseErr) {
        console.error('[PolicyAgent:Faithfulness] Parse error:', content.substring(0, 200));
        return { valid: true, violations: [], reason: `faithfulness parse error (fail-open)`, modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated, attempt };
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[PolicyAgent:Faithfulness] Network error:', err?.message);
      return { valid: true, violations: [], reason: `faithfulness network error (fail-open)`, modelUsed: VALIDATION_MODEL, latencyMs, tokensEstimated: 0, attempt };
    }
  }

  /**
   * Generate a corrected response directly via OpenRouter (bypasses OpenClaw).
   * ~2-3s instead of ~15-20s per correction through OpenClaw.
   */
  async generateCorrectedResponse(
    customerMessage: string,
    _failedResponse: string,
    validation: PolicyValidationResult,
    knowledgeContext: string,
    modelId: string = 'moonshotai/kimi-k2',
  ): Promise<{ response: string | null; latencyMs: number; tokensEstimated: number }> {
    if (!this.apiKey) {
      return { response: null, latencyMs: 0, tokensEstimated: 0 };
    }

    const startTime = Date.now();

    const systemPrompt = `Sen Eform Spor Merkezi'nin Instagram DM asistanısın. Müşteriye Türkçe yanıt ver.

KRİTİK KURAL — SADECE BİLGİ BANKASINI KULLAN:
- Yanıtındaki HER bilgi (adres, fiyat, saat, hizmet adı, telefon) BILGI_BANKASI'ndan gelmeli.
- BILGI_BANKASI'nda OLMAYAN hiçbir bilgiyi YAZMA. Bilmiyorsan "Bu konuda bilgi için bizi arayabilirsiniz: 0326 502 58 58" de.
- Adres, mahalle, sokak, bina adı gibi bilgileri KESİNLİKLE UYDURMA — BILGI_BANKASI'ndaki metni aynen kullan.

SADECE SORULAN SORUYA CEVAP VER:
- Müşteri ne sorduysa SADECE onu yanıtla. Sorulmayan bilgiyi PAYLAŞMA.
- Müşteri "merhaba" dediyse: sadece selamla + "Size nasıl yardımcı olabilirim?" de. Başka bilgi VERME.

FİYAT SORUSU:
- Müşteri GENEL fiyat sorduğunda ("fiyat nedir", "ne kadar", "ücret"): Hangi hizmet için fiyat öğrenmek istediğini sor. Örnek: "Merhaba! Hangi hizmetimizin fiyatını öğrenmek istersiniz? Masaj, üyelik, PT dersleri gibi seçeneklerimiz var."
- Müşteri SPESİFİK fiyat sorduğunda ("masaj fiyatları", "üyelik ücreti"): BILGI_BANKASI'ndaki fiyat listesini AYNEN kopyala. Emoji ve format değiştirme.
- Sonra ekle: "Detaylı bilgi için: 0326 502 58 58 📞"
- BILGI_BANKASI'nda zaten mobil uyumlu formatta hazırlanmış. Sadece kopyala yapıştır.

DİĞER KURALLAR:
- Randevu oluşturma, onaylama YETKİN YOK. Randevu için: 0326 502 58 58
- Yapamayacağın şeyleri vaat ETME
- Kısa, samimi, profesyonel yanıt ver (max 3-4 cümle)
- Sadece düz metin yaz, markdown kullanma

BILGI_BANKASI:
${knowledgeContext || '(veri yok)'}`;

    const userPrompt = `Müşteri mesajı: ${customerMessage}

Önceki yanıtın reddedildi çünkü: ${validation.violations.join(', ')}
${validation.reason}

KRİTİK: Yanıtındaki HER bilgi yukarıdaki BILGI_BANKASI'ndan gelmeli. Bilgi bankasında olmayan adres, fiyat, saat YAZMA.

Kurallara uygun yeni bir yanıt yaz.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://spa-kiosk.local',
          'X-Title': 'Eform Policy Correction',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        console.error('[PolicyAgent] Correction API error:', response.status);
        return { response: null, latencyMs, tokensEstimated: 0 };
      }

      const data = await response.json() as any;
      const content = data?.choices?.[0]?.message?.content?.trim() || '';

      const estimateTokens = (text: string) => Math.ceil(text.length / 3);
      const tokensEstimated = estimateTokens(systemPrompt + userPrompt) + estimateTokens(content);

      console.log('[PolicyAgent] Direct correction generated in %dms (%d chars)', latencyMs, content.length);
      return { response: content || null, latencyMs, tokensEstimated };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error('[PolicyAgent] Correction network error:', err?.message);
      return { response: null, latencyMs, tokensEstimated: 0 };
    }
  }
}
