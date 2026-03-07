/**
 * Instagram Hook Transform for OpenClaw
 * Replaces the legacy Instagram workflow pipeline:
 *   Parse → Service Check → [Customer + Knowledge + Prompt + Intent] →
 *   Suspicious Check → Enrich Context → build agent message
 *
 * Returns enriched message for OpenClaw agent, or null to skip.
 */

const KIO_BASE = process.env.KIO_API_URL || 'http://localhost:3001';
const KIO_TOKEN = process.env.KIO_API_KEY || '<KIO_API_KEY>';

async function kioFetch(path, options = {}) {
  const url = `${KIO_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIO_TOKEN}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[IG Transform] KIO error ${path}:`, e.message);
    return null;
  }
}

// ── Intent classification (replicates the legacy AI intent categories) ──
async function classifyIntent(text) {
  // Use KIO's existing knowledge context endpoint with intent param
  // For now, use simple regex-based classification matching the legacy prompt categories
  const t = text.toLowerCase();
  const n = t.replace(/ş/g,'s').replace(/ı/g,'i').replace(/ğ/g,'g')
             .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');
  const intents = [];

  if (/fiyat|ucret|kac para|ne kadar|gunluk giris|tek seans/i.test(n)) intents.push('pricing');
  if (/uyelik|uyel|fitness|spor.*salon|gym|aylik|ferdi|aile.*uye/i.test(n)) intents.push('membership');
  if (/saat|acik|kapali|calisma/i.test(n)) intents.push('hours');
  if (/adres|nerede|konum|nasil gid/i.test(n)) intents.push('location');
  if (/masaj.*tur|spa|hamam|sauna|sicak tas|terapist|hizmet/i.test(n)) intents.push('services');
  if (/cocuk|taekwondo|yuzme|jimnastik|kickboks|boks|kurs/i.test(n)) intents.push('kids');
  if (/kural|yas sinir|iptal|politika/i.test(n)) intents.push('policies');
  if (/randevu|rezervasyon/i.test(n)) intents.push('booking');
  if (/tesekkur|sagol|eyv/i.test(n)) intents.push('thanks');
  if (/\bpt\b|personal|kisisel egitmen|ozel egitmen/i.test(n)) intents.push('faq');
  if (/ne getir|getirmem|getirmeli|yanima|yaninda/i.test(n)) intents.push('faq');
  if (/kadin.*gun|kese.*kopuk|kopuk.*kese/i.test(n)) intents.push('faq');

  if (intents.length === 0) intents.push('general_info');
  return intents;
}

// ── Topic detection (specific entities) ──
function detectTopics(text) {
  const t = text.toLowerCase();
  const n = t.replace(/ş/g,'s').replace(/ı/g,'i').replace(/ğ/g,'g')
             .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');
  return {
    pilates: /pilates|reformer/i.test(t),
    massage: /masaj|massage/i.test(t),
    pt: /\bpt\b|personal trainer|kisisel egitmen|ozel egitmen/i.test(t),
    courses: /taekwondo|yuzme|jimnastik|kickboks|boks|kurs/i.test(t),
    kese_kopuk: /kese.*kopuk|kopuk.*kese/i.test(t),
    membership: /uyelik|uyel|fitness|spor.*salon|aylik|ferdi|aile.*uye/i.test(n),
  };
}

// ── Context enrichment (port of enrich_context_v31_ai_driven.js) ──
function enrichContext({ text, intents, knowledge, customer, aiPrompt, suspicious }) {
  const textLower = (text || '').toLowerCase();
  const normalizedText = textLower
    .replace(/ş/g,'s').replace(/ı/g,'i').replace(/ğ/g,'g')
    .replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c');

  const isNewCustomer = customer?.isNewCustomer !== false;
  const interactionCount = customer?.interactionCount || 0;
  const isFirstMessage = isNewCustomer || interactionCount <= 1;
  const isSuspicious = suspicious?.isSuspicious === true;
  const offenseCount = suspicious?.offenseCount || 0;
  const topics = detectTopics(text);

  let ctx = '\n\n=== BILGILER (SADECE BUNLARI KULLAN, ASLA UYDURMA!) ===';
  const added = new Set();
  const add = (key, content) => { if (!added.has(key) && content) { ctx += content; added.add(key); } };

  for (const intent of intents) {
    switch (intent) {
      case 'faq':
        if (knowledge?.faq) {
          let s = '\n\n❓ SIKCA SORULAN SORULAR:';
          Object.values(knowledge.faq).forEach(v => { s += '\n• ' + v; });
          add('faq', s);
        }
        break;
      case 'pricing':
        if (knowledge?.pricing?.current_campaign) add('campaign', '\n\n' + knowledge.pricing.current_campaign);
        if (topics.membership) {
          if (knowledge?.pricing?.membership_individual) add('membership_individual', '\n\n🏋️ FERDI UYELIK:\n' + knowledge.pricing.membership_individual);
          if (knowledge?.pricing?.membership_family) add('membership_family', '\n\n👨‍👩‍👧 AILE UYELIGI:\n' + knowledge.pricing.membership_family);
        } else if (topics.pilates) {
          if (knowledge?.pricing?.reformer_pilates) add('pilates_pricing', '\n\n🧘 PILATES FIYAT:\n' + knowledge.pricing.reformer_pilates);
        } else if (topics.pt) {
          if (knowledge?.pricing?.pt_pricing) add('pt_pricing', '\n\n' + knowledge.pricing.pt_pricing);
        } else if (topics.courses) {
          if (knowledge?.pricing?.courses_kids) add('courses_kids_pricing', '\n\n💰 KURS FIYATLARI:\n' + knowledge.pricing.courses_kids);
          if (knowledge?.pricing?.courses_women) add('courses_women_pricing', '\n💰 ' + knowledge.pricing.courses_women);
        } else {
          if (knowledge?.pricing?.spa_massage) add('spa_massage', '\n\n' + knowledge.pricing.spa_massage);
          if (knowledge?.pricing?.other_massage_programs) add('other_massage_programs', '\n\n' + knowledge.pricing.other_massage_programs);
        }
        break;
      case 'membership':
        if (knowledge?.pricing?.membership_individual) add('membership_individual', '\n\n🏋️ FERDI UYELIK:\n' + knowledge.pricing.membership_individual);
        if (knowledge?.pricing?.membership_family) add('membership_family', '\n\n👨‍👩‍👧 AILE UYELIGI:\n' + knowledge.pricing.membership_family);
        if (knowledge?.services?.facility_overview) add('facility', '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview);
        if (knowledge?.services?.membership_includes) add('membership_includes', '\n\n✅ TESIS KULLANIMI:\n' + knowledge.services.membership_includes);
        if (topics.pilates && knowledge?.pricing?.reformer_pilates) add('pilates_pricing', '\n\n🧘 PILATES FIYAT:\n' + knowledge.pricing.reformer_pilates);
        break;
      case 'hours': {
        let h = '\n\n🕐 SAATLER:';
        if (knowledge?.hours?.spa_working_hours) h += '\n• SPA: ' + knowledge.hours.spa_working_hours;
        if (knowledge?.hours?.facility_working_hours) h += '\n• SPOR: ' + knowledge.hours.facility_working_hours;
        add('hours', h);
        if (topics.courses) {
          if (knowledge?.hours?.taekwondo_schedule) add('taekwondo_schedule', '\n\n🥋 ' + knowledge.hours.taekwondo_schedule);
          if (knowledge?.hours?.kickboxing_schedule) add('kickboxing_schedule', '\n🥊 ' + knowledge.hours.kickboxing_schedule);
          if (knowledge?.hours?.gymnastics_schedule) add('gymnastics_schedule', '\n🤸 ' + knowledge.hours.gymnastics_schedule);
          if (knowledge?.hours?.swim_kids_schedule) add('swim_kids_schedule', '\n🏊 ' + knowledge.hours.swim_kids_schedule);
          if (knowledge?.hours?.swim_women_schedule) add('swim_women_schedule', '\n🏊‍♀️ ' + knowledge.hours.swim_women_schedule);
        }
        break;
      }
      case 'location':
        if (knowledge?.contact?.address) add('address', '\n\n📍 ADRES: ' + knowledge.contact.address);
        if (knowledge?.contact?.phone) add('phone', '\n\n📞 ILETISIM: ' + knowledge.contact.phone);
        break;
      case 'services':
        if (topics.massage) {
          if (knowledge?.services?.therapist_info) add('therapist', '\n\n👩‍⚕️ TERAPISTLER:\n' + knowledge.services.therapist_info);
          if (knowledge?.services?.massage_programs) add('massage_programs', '\n\n💆 MASAJ TURLERI:\n' + knowledge.services.massage_programs);
        } else if (topics.courses) {
          if (knowledge?.services?.courses_kids) add('courses_kids', '\n\n👶 COCUK KURSLARI:\n' + knowledge.services.courses_kids);
          if (knowledge?.services?.courses_women) add('courses_women', '\n\n👩 KADIN KURSLARI:\n' + knowledge.services.courses_women);
        } else if (topics.pilates) {
          if (knowledge?.services?.reformer_pilates_details) add('pilates_details', '\n\n🧘 PILATES DETAY:\n' + knowledge.services.reformer_pilates_details);
        } else {
          if (knowledge?.services?.facility_overview) add('facility', '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview);
        }
        break;
      case 'kids':
        if (knowledge?.services?.courses_kids) add('courses_kids', '\n\n👶 COCUK KURSLARI:\n' + knowledge.services.courses_kids);
        if (knowledge?.services?.courses_women) add('courses_women', '\n\n👩 KADIN KURSLARI:\n' + knowledge.services.courses_women);
        if (knowledge?.pricing?.courses_kids) add('courses_kids_pricing', '\n\n💰 KURS FIYATLARI:\n' + knowledge.pricing.courses_kids);
        if (knowledge?.pricing?.courses_women) add('courses_women_pricing', '\n💰 ' + knowledge.pricing.courses_women);
        if (knowledge?.policies?.age_groups) add('age_groups', '\n\n📋 YAS GRUPLARI: ' + knowledge.policies.age_groups);
        if (knowledge?.hours?.taekwondo_schedule) add('taekwondo_schedule', '\n\n🥋 ' + knowledge.hours.taekwondo_schedule);
        if (knowledge?.hours?.kickboxing_schedule) add('kickboxing_schedule', '\n🥊 ' + knowledge.hours.kickboxing_schedule);
        if (knowledge?.hours?.gymnastics_schedule) add('gymnastics_schedule', '\n🤸 ' + knowledge.hours.gymnastics_schedule);
        if (knowledge?.hours?.swim_kids_schedule) add('swim_kids_schedule', '\n🏊 ' + knowledge.hours.swim_kids_schedule);
        if (knowledge?.hours?.swim_women_schedule) add('swim_women_schedule', '\n🏊‍♀️ ' + knowledge.hours.swim_women_schedule);
        break;
      case 'policies':
        if (knowledge?.policies) {
          let p = '\n\n📋 KURALLAR:';
          Object.entries(knowledge.policies).forEach(([k, v]) => {
            if (k !== 'legitimate_services' && k !== 'rejection_prompt') p += '\n• ' + v;
          });
          add('policies', p);
        }
        break;
      case 'booking':
        if (knowledge?.contact?.phone) add('phone', '\n\n📞 RANDEVU: ' + knowledge.contact.phone);
        break;
      case 'general_info':
        if (isFirstMessage) {
          if (knowledge?.services?.facility_overview) add('facility', '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview);
          if (knowledge?.contact?.phone) add('phone', '\n\n📞 RANDEVU: ' + knowledge.contact.phone);
        }
        break;
    }
  }

  ctx += '\n\n=== BILGILER SONU ===';
  ctx += '\n🚫 Yukaridaki bilgileri kullanarak cevap ver. Bilgi yoksa "Bu konuda detayli bilgi icin lutfen bizi arayin" de.';
  ctx += '\n🚫 Yukarida OLMAYAN hizmet, fiyat veya saat UYDURMA!';

  // System prompt
  let sysPrompt = aiPrompt?.systemMessage || 'Sen Eform Spor Merkezi musteri temsilcisisin.';
  if (isSuspicious) {
    sysPrompt = 'Sen Eform Spor Merkezi musteri temsilcisisin. ONEMLI: Bu kullanici daha once uygunsuz mesaj gondermis. DIREKT ve KISA cevap ver. ASLA samimi olma. Sadece sorulan soruya cevap ver ve BIT.';
  }

  // Hints
  let hints = '';
  if (intents.length > 1) {
    hints += `\n⚠️ COKLU SORU! ${intents.length} farkli konu: ${intents.join(', ')}. HER KONUYA cevap ver!`;
  }
  if (normalizedText.match(/ne getir|getirmem|getirmeli|yanima|yaninda/)) {
    hints += '\n⚠️ KRITIK: Havlu, terlik VE SORT tesiste ucretsiz saglanir. Havuz icin bone zorunlu.';
  }
  if (isFirstMessage && !isSuspicious) {
    hints += '\n⚠️ ILK MESAJ! Kendini tanit: "Merhaba! Ben Eform Spor Merkezi dijital asistaniyim."';
  } else if (isSuspicious) {
    hints += `\n⚠️ SUPELI KULLANICI (ihlal: ${offenseCount}). Direkt cevap ver, samimi olma.`;
  }

  const legitimateServices = knowledge?.policies?.legitimate_services ||
    'MIX masaj, Klasik masaj, Sicak tas masaji, Medikal masaj, Kese kopuk, Hamam, Sauna, Buhar odasi, Fitness, Reformer Pilates, Yuzme kurslari, Jimnastik, Taekwondo, Kickboks, Boks, Personal Trainer, Fizik tedavi';

  return { sysPrompt, hints, knowledgeCtx: ctx, isFirstMessage, isSuspicious, offenseCount, legitimateServices, intents, topics };
}


// ── Main transform entry point (called by OpenClaw hooks system) ──
// ctx: { payload, headers, url, path }
// Returns: { message, sessionKey, name, deliver, ... } or null to skip
export default async function transform(ctx) {
  const payload = ctx.payload;

  // Parse Meta IG webhook format: entry[0].messaging[0]
  const entry = payload?.entry?.[0];
  const messaging = entry?.messaging?.[0];

  // Skip non-text: read receipts, delivery receipts, reactions, etc.
  if (!messaging?.message?.text) return null;
  if (messaging?.read || messaging?.delivery) return null;

  const senderId = messaging.sender?.id;
  const text = messaging.message.text;

  if (!senderId || !text?.trim()) return null;

  // Check service status
  try {
    const status = await kioFetch('/api/integrations/services/instagram/status');
    if (status?.enabled === false) {
      // Service disabled — send maintenance message directly and skip agent
      await kioFetch('/api/integrations/instagram/send', {
        method: 'POST',
        body: JSON.stringify({
          recipientId: senderId,
          message: '🔧 Sistem bakimda. Lutfen daha sonra tekrar deneyin.',
        }),
      });
      return null;
    }
  } catch (e) {
    // Default: service enabled
  }

  // Parallel fetch: customer, knowledge, AI prompt, suspicious check
  const [customer, knowledge, aiPrompt, suspicious] = await Promise.all([
    kioFetch(`/api/integrations/instagram/customer/${senderId}`).catch(() => ({
      isNewCustomer: true,
      interactionCount: 0,
    })),
    kioFetch('/api/integrations/knowledge/context').catch(() => ({})),
    kioFetch('/api/integrations/ai/prompt/instagram_assistant').catch(() => ({
      systemMessage: 'Sen Eform Spor Merkezi musteri temsilcisisin.',
    })),
    kioFetch(`/api/integrations/instagram/suspicious/check/${senderId}`).catch(() => ({
      isSuspicious: false,
      offenseCount: 0,
    })),
  ]);

  // Intent classification (regex-based, same as the legacy AI intent categories)
  const intents = await classifyIntent(text);

  // Context enrichment (port of enrich_context_v31_ai_driven.js)
  const enriched = enrichContext({
    text,
    intents,
    knowledge,
    customer,
    aiPrompt,
    suspicious,
  });

  // Log inbound interaction (fire-and-forget)
  kioFetch('/api/integrations/instagram/interaction', {
    method: 'POST',
    body: JSON.stringify({
      instagramId: senderId,
      direction: 'inbound',
      messageText: text,
      intent: intents.join(','),
    }),
  }).catch(() => {});

  // Build the enriched agent message
  const agentMessage = [
    `Instagram DM from user ${senderId}:`,
    `"${text}"`,
    '',
    `--- DAVRANIS KURALLARI ---`,
    enriched.sysPrompt,
    '',
    enriched.hints || '',
    '',
    enriched.knowledgeCtx,
    '',
    `--- GOREV ---`,
    `Respond to this customer message in Turkish.`,
    `Detected intents: ${JSON.stringify(intents)}`,
    `Is first message: ${enriched.isFirstMessage}`,
    `Is suspicious: ${enriched.isSuspicious} (offense count: ${enriched.offenseCount})`,
    `Legitimate services: ${enriched.legitimateServices}`,
    '',
    `After generating your response:`,
    `1. Send it via: curl -s -X POST "http://localhost:3001/api/integrations/instagram/send" -H "Content-Type: application/json" -H "Authorization: Bearer ${KIO_TOKEN}" -d '{"recipientId": "${senderId}", "message": "YOUR_RESPONSE"}'`,
    `2. Log it via: curl -s -X POST "http://localhost:3001/api/integrations/instagram/interaction" -H "Content-Type: application/json" -H "Authorization: Bearer ${KIO_TOKEN}" -d '{"instagramId": "${senderId}", "direction": "outbound", "messageText": "YOUR_RESPONSE", "intent": "${intents.join(',')}", "aiResponse": "YOUR_RESPONSE"}'`,
  ].join('\n');

  // Return override for OpenClaw agent
  return {
    message: agentMessage,
    sessionKey: `hook:instagram:${senderId}`,
    name: 'Instagram DM',
    deliver: false,
  };
}
