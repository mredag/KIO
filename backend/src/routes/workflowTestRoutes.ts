import { Router, Request, Response, NextFunction } from 'express';
import { KnowledgeBaseService } from '../services/KnowledgeBaseService.js';
import { DatabaseService } from '../database/DatabaseService.js';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';

/**
 * Workflow Test Routes - Demo/Test channel for Instagram workflow
 * Simulates the n8n workflow locally without needing Instagram
 */
export function createWorkflowTestRoutes(db: DatabaseService): Router {
  const router = Router();
  const knowledgeBaseService = new KnowledgeBaseService(db);
  
  // n8n server URL (Pi)
  const N8N_URL = process.env.N8N_URL || 'http://192.168.1.137:5678';

  // Middleware that allows either session auth (admin panel) or API key auth (external)
  const flexibleAuth = (req: Request, res: Response, next: NextFunction) => {
    // Check session auth first (for admin panel) - same check as authMiddleware
    if (req.session && req.session.user) {
      return next();
    }
    // Fall back to API key auth
    return apiKeyAuth(req, res, next);
  };

  /**
   * POST /api/workflow-test/n8n
   * Proxy requests to n8n workflow on Pi
   * Bypasses browser CSP restrictions
   */
  router.post('/n8n', flexibleAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      // Forward to n8n test webhook
      const n8nResponse = await fetch(`${N8N_URL}/webhook/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: message.trim() })
      });

      if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        console.error('[Workflow Test] n8n error:', errorText);
        res.status(n8nResponse.status).json({ 
          error: 'n8n request failed',
          details: errorText,
          processingTime: Date.now() - startTime
        });
        return;
      }

      const data = await n8nResponse.json() as Record<string, unknown>;
      
      // Add processing time if not present
      if (!data.processingTime) {
        data.processingTime = Date.now() - startTime;
      }

      res.json(data);

    } catch (error) {
      console.error('[Workflow Test] Proxy error:', error);
      res.status(500).json({ 
        error: 'Failed to connect to n8n',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: `Make sure n8n is running at ${N8N_URL}`,
        processingTime: Date.now() - startTime
      });
    }
  });

  /**
   * POST /api/workflow-test/simulate
   * Simulates the Instagram workflow processing
   * Returns what the AI would respond with
   */
  router.post('/simulate', flexibleAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const text = message.trim();
      if (text.length < 3) {
        res.json({
          status: 'ignored',
          reason: 'too_short',
          message: 'Message too short (min 3 chars)',
          processingTime: Date.now() - startTime
        });
        return;
      }

      // Get knowledge context
      const knowledge = knowledgeBaseService.getContext();

      // Detect intent (same logic as n8n workflow)
      const intentResult = detectIntent(text);
      
      // Build knowledge context (same logic as n8n workflow)
      const knowledgeContext = buildKnowledgeContext(intentResult.intent, knowledge, text);

      // Check safety (simplified - in real workflow this goes to OpenRouter)
      const safetyResult = checkSafety(text, intentResult.intent);

      // Get AI prompt from database
      const aiPrompt = getAIPrompt(db);

      // Build the full context that would be sent to AI
      const fullContext = {
        systemPrompt: aiPrompt,
        userMessage: text,
        knowledgeContext,
        intent: intentResult.intent,
        normalizedText: intentResult.normalizedText
      };

      // If blocked or unsure, return fixed response
      if (safetyResult.decision === 'BLOCK') {
        res.json({
          status: 'blocked',
          response: 'Cinsel içerikli veya uygunsuz hizmet sunmuyoruz. Sadece profesyonel spa ve spor hizmetleri veriyoruz. İsterseniz hizmet listemizi, fiyatlarımızı paylaşabilirim veya randevu almanıza yardımcı olabilirim.',
          intent: intentResult.intent,
          safetyDecision: 'BLOCK',
          safetyReason: safetyResult.reason,
          processingTime: Date.now() - startTime,
          debug: {
            normalizedText: intentResult.normalizedText,
            detectedIntent: intentResult.intent,
            knowledgeCategories: Object.keys(knowledge),
            contextLength: knowledgeContext.length
          }
        });
        return;
      }

      if (safetyResult.decision === 'UNSURE' && intentResult.intent !== 'faq') {
        res.json({
          status: 'unsure',
          response: 'Hizmetlerimiz, fiyatlarımız, randevu ve kurslarımız hakkında yardımcı olabilirim. Lütfen sorunuzu açıkça belirtir misiniz?',
          intent: intentResult.intent,
          safetyDecision: 'UNSURE',
          safetyReason: safetyResult.reason,
          processingTime: Date.now() - startTime,
          debug: {
            normalizedText: intentResult.normalizedText,
            detectedIntent: intentResult.intent,
            knowledgeCategories: Object.keys(knowledge),
            contextLength: knowledgeContext.length
          }
        });
        return;
      }

      // For ALLOW - return the context that would be sent to AI
      // In a full test, you could call OpenRouter here
      res.json({
        status: 'allowed',
        response: '[AI would generate response based on context below]',
        intent: intentResult.intent,
        safetyDecision: 'ALLOW',
        safetyReason: safetyResult.reason,
        processingTime: Date.now() - startTime,
        aiContext: {
          systemPrompt: fullContext.systemPrompt.substring(0, 500) + '...',
          knowledgeContext: knowledgeContext,
          userMessage: text
        },
        debug: {
          normalizedText: intentResult.normalizedText,
          detectedIntent: intentResult.intent,
          knowledgeCategories: Object.keys(knowledge),
          contextLength: knowledgeContext.length,
          faqEntries: knowledge.faq ? Object.keys(knowledge.faq) : []
        }
      });

    } catch (error) {
      console.error('[Workflow Test] Error:', error);
      res.status(500).json({ 
        error: 'Simulation failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });
    }
  });

  /**
   * POST /api/workflow-test/simulate-full
   * Full simulation with actual OpenRouter AI call
   * Requires OPENROUTER_API_KEY in environment
   */
  router.post('/simulate-full', flexibleAuth, async (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        res.status(500).json({ 
          error: 'OPENROUTER_API_KEY not configured',
          hint: 'Add OPENROUTER_API_KEY to backend/.env to enable full simulation'
        });
        return;
      }

      const text = message.trim();
      
      // Get knowledge and detect intent
      const knowledge = knowledgeBaseService.getContext();
      const intentResult = detectIntent(text);
      const knowledgeContext = buildKnowledgeContext(intentResult.intent, knowledge, text);
      const safetyResult = checkSafety(text, intentResult.intent);
      const aiPrompt = getAIPrompt(db);

      // Handle blocked/unsure
      if (safetyResult.decision === 'BLOCK') {
        res.json({
          status: 'blocked',
          response: 'Cinsel içerikli veya uygunsuz hizmet sunmuyoruz. Sadece profesyonel spa ve spor hizmetleri veriyoruz.',
          intent: intentResult.intent,
          safetyDecision: 'BLOCK',
          processingTime: Date.now() - startTime
        });
        return;
      }

      if (safetyResult.decision === 'UNSURE' && intentResult.intent !== 'faq') {
        res.json({
          status: 'unsure', 
          response: 'Hizmetlerimiz, fiyatlarımız, randevu ve kurslarımız hakkında yardımcı olabilirim. Lütfen sorunuzu açıkça belirtir misiniz?',
          intent: intentResult.intent,
          safetyDecision: 'UNSURE',
          processingTime: Date.now() - startTime
        });
        return;
      }

      // Call OpenRouter for AI response
      const systemMessage = aiPrompt + '\n\n' + knowledgeContext;
      
      const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://spa-kiosk.local',
          'X-Title': 'SPA Workflow Test'
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: text }
          ]
        })
      });

      const aiData = await aiResponse.json() as { choices?: Array<{ message?: { content?: string } }>, error?: { message?: string } };
      
      if (!aiResponse.ok) {
        res.status(500).json({
          error: 'OpenRouter API error',
          details: aiData.error?.message || 'Unknown error',
          processingTime: Date.now() - startTime
        });
        return;
      }

      let responseText = aiData.choices?.[0]?.message?.content || 'Bir hata oluştu.';
      
      // Clean up response (same as n8n workflow)
      responseText = responseText.replace(/\*\*/g, '').replace(/\*/g, '');
      responseText = responseText.replace(/\n{3,}/g, '\n\n').trim();
      responseText = responseText.substring(0, 1000);

      res.json({
        status: 'success',
        response: responseText,
        intent: intentResult.intent,
        safetyDecision: 'ALLOW',
        processingTime: Date.now() - startTime,
        debug: {
          normalizedText: intentResult.normalizedText,
          detectedIntent: intentResult.intent,
          knowledgeUsed: Object.keys(knowledge).filter(k => knowledgeContext.includes(k))
        }
      });

    } catch (error) {
      console.error('[Workflow Test Full] Error:', error);
      res.status(500).json({ 
        error: 'Full simulation failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      });
    }
  });

  /**
   * GET /api/workflow-test/knowledge
   * Get all knowledge base entries for debugging
   */
  router.get('/knowledge', flexibleAuth, (_req: Request, res: Response) => {
    try {
      const knowledge = knowledgeBaseService.getContext();
      res.json({
        categories: Object.keys(knowledge),
        totalEntries: Object.values(knowledge).reduce((sum, cat) => sum + Object.keys(cat).length, 0),
        data: knowledge
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch knowledge' });
    }
  });

  /**
   * GET /api/workflow-test/intents
   * List all supported intents and their keywords
   */
  router.get('/intents', (_req: Request, res: Response) => {
    res.json({
      intents: {
        faq: {
          description: 'Frequently Asked Questions (S.S.S.)',
          keywords: ['kadın gün', 'kese köpük', 'personal trainer', 'pt var', 'ne getir', 'terapist yasal', 'randevu nasıl', 'ileri tarih'],
          examples: ['kadınlar günü var mı', 'kese köpük kim yapıyor', 'PT var mı', 'yanımda ne getirmeliyim']
        },
        pricing: {
          description: 'Price inquiries',
          keywords: ['fiyat', 'ücret', 'ne kadar', 'kaç para', 'kaç lira', 'kaç tl'],
          examples: ['masaj fiyatları', 'ne kadar', 'fiyat listesi']
        },
        membership: {
          description: 'Gym/fitness membership',
          keywords: ['üyelik', 'member', 'abone', 'spor', 'gym', 'fitness', 'tesis', 'pilates', 'reformer'],
          examples: ['üyelik fiyatları', 'spor salonu', 'pilates var mı']
        },
        hours: {
          description: 'Working hours',
          keywords: ['saat', 'açık', 'kapalı', 'çalışma', 'ne zaman', 'pazar'],
          examples: ['saat kaça kadar açık', 'pazar açık mı']
        },
        location: {
          description: 'Address/location',
          keywords: ['adres', 'nerede', 'konum', 'nasıl gel', 'iskenderun'],
          examples: ['adres nerede', 'nasıl gelirim']
        },
        services: {
          description: 'Spa services',
          keywords: ['masaj', 'spa', 'hamam', 'sauna', 'havuz', 'hizmet'],
          examples: ['masaj türleri', 'spa hizmetleri']
        },
        kids: {
          description: 'Kids courses',
          keywords: ['çocuk kurs', 'jimnastik', 'taekwondo', 'yüzme kurs', 'kickboks'],
          examples: ['çocuk kursları', 'jimnastik var mı']
        },
        policies: {
          description: 'Rules and policies',
          keywords: ['yaş sınır', 'kural', 'yasak', 'izin'],
          examples: ['yaş sınırı var mı', 'kurallar neler']
        },
        general_info: {
          description: 'General inquiries',
          keywords: ['bilgi', 'merhaba', 'selam', 'hey'],
          examples: ['merhaba', 'bilgi almak istiyorum']
        }
      }
    });
  });

  return router;
}

/**
 * Detect intent from message text
 * Same logic as n8n workflow Enrich Context node
 */
function detectIntent(text: string): { intent: string; normalizedText: string } {
  // Normalize Turkish characters
  let normalizedText = text.toLowerCase()
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c');

  // Fix common misspellings
  normalizedText = normalizedText
    .replace(/teakwondo|tekvando|taekwando|tekvondo|tekwondo/gi, 'taekwondo')
    .replace(/jimnastik|jimastik|cimnastik|gimnastik/gi, 'jimnastik')
    .replace(/kickboks|kikboks|kickbox|kikbox|kick boks/gi, 'kickboks')
    .replace(/pilates|pilatis|plates|pilat/gi, 'pilates')
    .replace(/reformer|reformar|refromer/gi, 'reformer')
    .replace(/yuzme|yüzme|yuzma|yuzm/gi, 'yuzme')
    .replace(/masaj|massaj|masag|mazaj/gi, 'masaj')
    .replace(/hamam|hammam|hamamm/gi, 'hamam')
    .replace(/sauna|suana|sona/gi, 'sauna')
    .replace(/fitness|fitnes|fittness|fitnıs/gi, 'fitness')
    .replace(/uyelik|üyelik|uyelık|uyelig/gi, 'uyelik')
    .replace(/fiyat|fıyat|fiyaat|fyat/gi, 'fiyat')
    .replace(/randevu|randevü|randavu|randivu/gi, 'randevu');

  let intent = 'general_info';

  // FAQ DETECTION - Check for common FAQ questions FIRST
  const faqPatterns = [
    /kadin.*gun|kadinlar.*gun|bayan.*gun/i,
    /kese.*kopuk|kopuk.*kese|kim.*yap/i,
    /personal.*trainer|pt.*var|antrenor/i,
    /yaninda.*getir|ne.*getir|havlu.*terlik/i,
    /terapist.*yasal|belge.*var|sertifika/i,
    /randevu.*nasil|nasil.*randevu|online.*rezervasyon/i,
    /ileri.*tarih|yarin.*randevu|haftaya.*randevu/i
  ];

  if (faqPatterns.some(p => normalizedText.match(p))) {
    intent = 'faq';
  } else if (normalizedText.match(/pilates|reformer/i)) {
    intent = 'membership';
  } else if (normalizedText.match(/uyelik|member|abone|spor.*fiyat|gym|fitness|tesis.*ucret|tesis.*fiyat/i)) {
    intent = 'membership';
  } else if (normalizedText.match(/yas.*sinir|yas.*limit|sinir.*yas|kural|policy|izin|yasak|kac yas|yas icin/i)) {
    intent = 'policies';
  } else if (normalizedText.match(/cocuk.*kurs|jimnastik|taekwondo|yuzme.*kurs|cocuk.*ders|kickboks|boks/i)) {
    intent = 'kids';
  } else if (normalizedText.match(/fiyat|ucret|ne kadar|kac para|kac lira|kac tl/i)) {
    intent = 'pricing';
  } else if (normalizedText.match(/saat|acik|kapali|calisma|ne zaman|pazar/i)) {
    intent = 'hours';
  } else if (normalizedText.match(/bilgi|bilgi al|bilgi ist|ogrenmek|merak|merhaba|selam|hey|hi|hello/i)) {
    intent = 'general_info';
  } else if (normalizedText.match(/adres|nerede|neresin|konum|nasil gel|yer.*nere|nere.*yer|iskenderun/i)) {
    intent = 'location';
  } else if (normalizedText.match(/randevu|rezervasyon|yer ayirt/i)) {
    intent = 'booking';
  } else if (normalizedText.match(/masaj|spa|hamam|sauna|havuz|hizmet/i)) {
    intent = 'services';
  } else if (normalizedText.match(/tesekkur|sagol|thanks|eyv/i)) {
    intent = 'thanks';
  }

  return { intent, normalizedText };
}

/**
 * Build knowledge context based on intent
 * Same logic as n8n workflow Enrich Context node
 */
function buildKnowledgeContext(intent: string, knowledge: Record<string, Record<string, string>>, _text: string): string {
  let knowledgeContext = '\n\n=== BILGILER (SADECE BUNLARI KULLAN, ASLA UYDURMA!) ===';

  // FAQ CONTEXT
  if ((intent === 'faq' || intent === 'policies') && knowledge.faq) {
    knowledgeContext += '\n\n❓ SIKCA SORULAN SORULAR:';
    Object.entries(knowledge.faq).forEach(([_key, v]) => { knowledgeContext += '\n• ' + v; });
  }

  if (intent === 'policies' && knowledge.policies) {
    knowledgeContext += '\n\n📋 KURALLAR VE POLITIKALAR:';
    Object.entries(knowledge.policies).forEach(([_key, v]) => { knowledgeContext += '\n• ' + v; });
  }

  if (intent === 'general_info' || intent === 'pricing') {
    if (knowledge.pricing?.current_campaign) knowledgeContext += '\n\n🔥 KAMPANYA:\n' + knowledge.pricing.current_campaign;
    if (knowledge.pricing?.group_discount) knowledgeContext += '\n🎁 ' + knowledge.pricing.group_discount;
    if (knowledge.services?.massage_programs) knowledgeContext += '\n\n💆 MASAJ FIYATLARI:\n' + knowledge.services.massage_programs;
  }

  if (intent === 'services' || intent === 'general_info') {
    if (knowledge.services?.special_massage_programs) knowledgeContext += '\n\n⭐ OZEL MASAJLAR:\n' + knowledge.services.special_massage_programs;
    if (knowledge.services?.facility_overview) knowledgeContext += '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview;
  }

  if (intent === 'membership') {
    knowledgeContext += '\n\n🏋️ FITNESS VE TESIS UYELIK UCRETLERI:';
    if (knowledge.pricing?.membership_individual) knowledgeContext += '\n\n👤 FERDI UYELIK:\n' + knowledge.pricing.membership_individual;
    if (knowledge.pricing?.membership_family) knowledgeContext += '\n\n👨‍👩‍👧 AILE UYELIGI:\n' + knowledge.pricing.membership_family;
    if (knowledge.pricing?.reformer_pilates) knowledgeContext += '\n\n🧘 REFORMER PILATES:\n' + knowledge.pricing.reformer_pilates;
    if (knowledge.pricing?.daily_facility) knowledgeContext += '\n\n📅 GUNLUK KULLANIM:\n' + knowledge.pricing.daily_facility;
    if (knowledge.pricing?.pt_12_saat) knowledgeContext += '\n\n🏃 PERSONAL TRAINER:\n' + knowledge.pricing.pt_12_saat + '\n' + (knowledge.pricing.pt_24_saat || '') + '\n' + (knowledge.pricing.pt_36_saat || '');
    if (knowledge.services?.facility_overview) knowledgeContext += '\n\n🏢 TESIS BILGISI:\n' + knowledge.services.facility_overview;
  }

  if (intent === 'hours' || intent === 'booking') {
    knowledgeContext += '\n\n🕐 CALISMA SAATLERI:';
    if (knowledge.hours?.spa_working_hours) knowledgeContext += '\n• SPA/MASAJ: ' + knowledge.hours.spa_working_hours;
    if (knowledge.hours?.facility_working_hours) knowledgeContext += '\n• SPOR SALONU: ' + knowledge.hours.facility_working_hours;
  }

  if (intent === 'location' || intent === 'booking' || intent === 'general_info') {
    if (knowledge.contact?.phone) knowledgeContext += '\n\n📞 RANDEVU: ' + knowledge.contact.phone;
    if (knowledge.contact?.address && intent === 'location') knowledgeContext += '\n📍 ADRES: ' + knowledge.contact.address;
  }

  if (intent === 'kids') {
    if (knowledge.services?.courses_kids) knowledgeContext += '\n\n👶 COCUK KURSLARI:\n' + knowledge.services.courses_kids;
    if (knowledge.pricing?.courses_kids) knowledgeContext += '\n\n💰 KURS FIYATLARI:\n' + knowledge.pricing.courses_kids;
  }

  // Always include phone if not already included
  if (knowledge.contact?.phone && !knowledgeContext.includes(knowledge.contact.phone)) {
    knowledgeContext += '\n\n📞 RANDEVU: ' + knowledge.contact.phone;
  }

  return knowledgeContext;
}

/**
 * Simple safety check (simplified version of Safety Gate)
 */
function checkSafety(text: string, intent: string): { decision: string; reason: string } {
  const normalizedText = text.toLowerCase()
    .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');

  // BLOCK patterns
  const blockPatterns = [
    /mutlu son/i,
    /happy ending/i,
    /sonu guzel/i,
    /sonu keyifli/i,
    /ekstra hizmet/i,
    /ozel masaj.*ist/i
  ];

  if (blockPatterns.some(p => normalizedText.match(p))) {
    return { decision: 'BLOCK', reason: 'inappropriate_content' };
  }

  // FAQ intent always ALLOW
  if (intent === 'faq') {
    return { decision: 'ALLOW', reason: 'faq_keyword_match' };
  }

  // UNSURE patterns
  const unsurePatterns = [
    /^sonu nasil$/i,
    /^anladin mi$/i,
    /^you know$/i
  ];

  if (unsurePatterns.some(p => normalizedText.match(p))) {
    return { decision: 'UNSURE', reason: 'ambiguous_message' };
  }

  // Default ALLOW for clear intents
  return { decision: 'ALLOW', reason: 'clear_intent' };
}

/**
 * Get AI system prompt from database
 */
function getAIPrompt(db: DatabaseService): string {
  try {
    const query = `SELECT system_message FROM ai_system_prompts WHERE name = ? AND is_active = 1`;
    const result = db['db'].prepare(query).get('instagram-spa-assistant') as { system_message: string } | undefined;
    return result?.system_message || 'Sen Eform SPA müşteri temsilcisisin. SADECE verilen BILGILER bölümündeki verileri kullan, ASLA uydurma!';
  } catch {
    return 'Sen Eform SPA müşteri temsilcisisin. SADECE verilen BILGILER bölümündeki verileri kullan, ASLA uydurma!';
  }
}
