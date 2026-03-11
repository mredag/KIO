import { extractUsageMetrics, ZERO_USAGE_METRICS, type UsageMetrics } from './UsageMetrics.js';

export interface GroundingClaimResult {
  claim: string;
  grounded: boolean;
  issueType: string;
  reason: string;
}

export type GroundingScore = 'grounded' | 'partially_grounded' | 'hallucinated';

export interface DMGroundingAuditInput {
  interactionId: string;
  customerId: string;
  channel: 'instagram' | 'whatsapp';
  customerMessage: string;
  aiResponse: string;
  modelUsed: string | null;
  modelTier: string | null;
}

export interface DMGroundingAuditOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  title?: string;
  timeoutMs?: number;
}

export interface DMGroundingAuditResult {
  interactionId: string;
  customerId: string;
  channel: 'instagram' | 'whatsapp';
  customerMessage: string;
  aiResponse: string;
  modelUsed: string | null;
  modelTier: string | null;
  score: GroundingScore;
  totalClaims: number;
  groundedClaims: number;
  ungroundedClaims: GroundingClaimResult[];
  latencyMs: number;
  skipped: boolean;
  skipReason?: string;
  usage: UsageMetrics;
}

export class DMGroundingAuditService {
  constructor(private apiKey: string) {}

  async auditResponse(
    input: DMGroundingAuditInput,
    kbText: string,
    options: DMGroundingAuditOptions,
  ): Promise<DMGroundingAuditResult> {
    const startTime = Date.now();

    if (!input.aiResponse || input.aiResponse.trim().length < 20) {
      return this.buildSkippedResult(input, Date.now() - startTime, 'short_response');
    }

    if (!this.apiKey) {
      return this.buildSkippedResult(input, Date.now() - startTime, 'missing_api_key');
    }

    const prompt = `Sen bir DM kalite denetcisisin. Asistanin yanitindaki HER olgusal iddiayi BILGI_BANKASI ile karsilastir.

GOREV:
1. Yanittan tum olgusal iddialari cikar (adres, fiyat, saat, telefon, hizmet adi, konum, bina adi, mahalle adi, indirim, kampanya vb.)
2. Her iddiayi BILGI_BANKASI'nda ara
3. BILGI_BANKASI'nda OLMAYAN veya FARKLI olan her iddia = UYDURMA

SINIFLANDIRMA KURALLARI:
- Selamlama, nezaket ifadeleri, "size yardimci olabilirim" gibi genel cumleler iddia DEGILDIR, bunlari atla
- Sadece SOMUT BILGI iceren iddialari kontrol et
- Fiyat formati farkli olabilir (800 TL vs 800₺), sayisal deger ayniysa DOGRU say
- Adres bilgisinde mahalle, sokak, bina adi BIREBIR ayni olmali
- "Sinirsiz" gibi nitelemeler KB'de yoksa = UYDURMA
- Kampanya/indirim bilgisi KB'de yoksa = UYDURMA

SORUN TIPLERI (issueType):
- wrong_price: Fiyat yanlis veya uydurma
- wrong_address: Adres bilgisi yanlis
- wrong_hours: Calisma saatleri yanlis
- wrong_phone: Telefon numarasi yanlis
- hallucinated_feature: KB'de olmayan hizmet/ozellik uydurma
- hallucinated_campaign: KB'de olmayan kampanya/indirim uydurma
- wrong_service_detail: Hizmet detayi yanlis (sure, icerik vb.)
- other: Diger uydurma bilgi

MUSTERI MESAJI: ${input.customerMessage || '(bilinmiyor)'}

ASISTAN YANITI: ${input.aiResponse}

BILGI_BANKASI:
${kbText}

YANITINI SADECE JSON OLARAK VER:
{"claims": [{"claim": "iddia metni", "grounded": true, "issueType": "other", "reason": "aciklama"}]}`;

    try {
      const apiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kio.eformspa.local',
          'X-Title': options.title || 'KIO DM Grounding Audit',
        },
        body: JSON.stringify({
          model: options.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        }),
        signal: AbortSignal.timeout(options.timeoutMs || 30000),
      });

      const latencyMs = Date.now() - startTime;
      if (!apiResponse.ok) {
        return this.buildSkippedResult(input, latencyMs, `api_error_${apiResponse.status}`);
      }

      const data = await apiResponse.json() as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: Record<string, unknown>;
        cost?: unknown;
      };
      const content = data.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = cleaned ? JSON.parse(cleaned) : {};
      const claims: GroundingClaimResult[] = Array.isArray(parsed.claims)
        ? parsed.claims.map((claim: any) => ({
            claim: String(claim?.claim || ''),
            grounded: claim?.grounded !== false,
            issueType: String(claim?.issueType || 'other'),
            reason: String(claim?.reason || ''),
          }))
        : [];
      const usage = extractUsageMetrics(data, prompt, content);
      const ungroundedClaims = claims.filter(claim => !claim.grounded);
      const groundedClaims = claims.filter(claim => claim.grounded).length;
      let score: GroundingScore = 'grounded';
      if (ungroundedClaims.length > 0) {
        score = groundedClaims > 0 && ungroundedClaims.length <= groundedClaims
          ? 'partially_grounded'
          : 'hallucinated';
      }

      return {
        interactionId: input.interactionId,
        customerId: input.customerId,
        channel: input.channel,
        customerMessage: input.customerMessage,
        aiResponse: input.aiResponse,
        modelUsed: input.modelUsed,
        modelTier: input.modelTier,
        score,
        totalClaims: claims.length,
        groundedClaims,
        ungroundedClaims,
        latencyMs,
        skipped: false,
        usage,
      };
    } catch (error: any) {
      return this.buildSkippedResult(input, Date.now() - startTime, error?.message || 'parse_error');
    }
  }

  private buildSkippedResult(
    input: DMGroundingAuditInput,
    latencyMs: number,
    skipReason: string,
  ): DMGroundingAuditResult {
    return {
      interactionId: input.interactionId,
      customerId: input.customerId,
      channel: input.channel,
      customerMessage: input.customerMessage,
      aiResponse: input.aiResponse,
      modelUsed: input.modelUsed,
      modelTier: input.modelTier,
      score: 'grounded',
      totalClaims: 0,
      groundedClaims: 0,
      ungroundedClaims: [],
      latencyMs,
      skipped: true,
      skipReason,
      usage: ZERO_USAGE_METRICS,
    };
  }
}
