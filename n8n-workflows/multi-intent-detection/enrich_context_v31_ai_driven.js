const items = $input.all();
const parseData = $('Process Suspicious Check').first().json;
const aiIntentResponse = $('AI Intent Detection').first().json;

let customer = {}, knowledge = {}, aiPrompt = {};
for (const item of items) {
  const json = item.json;
  if (json.systemMessage) aiPrompt = json;
  else if (json.isNewCustomer !== undefined || json.interactionCount !== undefined) customer = json;
  else if (json.pricing || json.services || json.hours || json.contact || json.policies || json.faq) knowledge = json;
}

const isNewCustomer = customer.isNewCustomer !== false;
const interactionCount = customer.interactionCount || 0;
const isFirstMessage = isNewCustomer || interactionCount <= 1;
const isSuspicious = parseData.isSuspicious === true;
const offenseCount = parseData.offenseCount || 0;
const textLower = parseData.text.toLowerCase();

// Normalize Turkish characters
const normalizedText = textLower
  .replace(/ş/g, 's').replace(/ı/g, 'i')
  .replace(/ğ/g, 'g').replace(/ü/g, 'u')
  .replace(/ö/g, 'o').replace(/ç/g, 'c');

// ============================================
// AI-DRIVEN INTENT DETECTION (NO HARDCODING)
// ============================================

// Parse AI response - expecting JSON array of intents
let detectedIntents = [];
const aiContent = aiIntentResponse.choices?.[0]?.message?.content?.trim();

try {
  // Try to parse as JSON array
  const parsed = JSON.parse(aiContent);
  if (Array.isArray(parsed)) {
    detectedIntents = parsed;
  } else if (typeof parsed === 'string') {
    detectedIntents = [parsed];
  }
} catch (e) {
  // Fallback: treat as comma-separated string or single intent
  if (aiContent) {
    detectedIntents = aiContent.split(',').map(s => s.trim().toLowerCase());
  }
}

// Validate intents
const validIntents = ['faq', 'pricing', 'membership', 'hours', 'location', 'services', 'kids', 'policies', 'booking', 'thanks', 'general_info'];
detectedIntents = detectedIntents.filter(intent => validIntents.includes(intent));

// If no valid intents detected, use general_info
if (detectedIntents.length === 0) {
  detectedIntents = ['general_info'];
}

const primaryIntent = detectedIntents[0];

// ============================================
// TOPIC DETECTION (SPECIFIC ENTITIES)
// ============================================

// Topics are specific entities mentioned (not intents)
const detectedTopics = {
  pilates: /pilates|reformer/i.test(textLower),
  massage: /masaj|massage/i.test(textLower),
  pt: /\bpt\b|personal trainer|kisisel egitmen|ozel egitmen/i.test(textLower),
  courses: /taekwondo|yuzme|jimnastik|kickboks|boks|kurs/i.test(textLower),
  kese_kopuk: /kese.*kopuk|kopuk.*kese/i.test(textLower),
  membership: /uyelik|uyel|fitness|spor.*salon|aylik|ferdi|aile.*uye/i.test(normalizedText)
};

// ============================================
// KNOWLEDGE CONTEXT BUILDER (INTENT-DRIVEN)
// ============================================

let knowledgeContext = '\n\n=== BILGILER (SADECE BUNLARI KULLAN, ASLA UYDURMA!) ===';
const addedSections = new Set();

function addSection(key, content) {
  if (!addedSections.has(key) && content) {
    knowledgeContext += content;
    addedSections.add(key);
  }
}

// ============================================
// INTENT → KNOWLEDGE MAPPING (NO HARDCODING)
// ============================================

for (const intent of detectedIntents) {
  switch (intent) {
    case 'faq':
      if (knowledge.faq) {
        let faqContent = '\n\n❓ SIKCA SORULAN SORULAR:';
        Object.entries(knowledge.faq).forEach(([key, v]) => { faqContent += '\n• ' + v; });
        addSection('faq', faqContent);
      }
      break;

    case 'pricing':
      // Add campaign
      if (knowledge.pricing?.current_campaign) {
        addSection('campaign', '\n\n' + knowledge.pricing.current_campaign);
      }
      
      // Add pricing based on detected topics
      if (detectedTopics.membership) {
        if (knowledge.pricing?.membership_individual) {
          addSection('membership_individual', '\n\n🏋️ FERDI UYELIK:\n' + knowledge.pricing.membership_individual);
        }
        if (knowledge.pricing?.membership_family) {
          addSection('membership_family', '\n\n👨‍👩‍👧 AILE UYELIGI:\n' + knowledge.pricing.membership_family);
        }
      } else if (detectedTopics.pilates) {
        if (knowledge.pricing?.reformer_pilates) {
          addSection('pilates_pricing', '\n\n🧘 PILATES FIYAT:\n' + knowledge.pricing.reformer_pilates);
        }
      } else if (detectedTopics.pt) {
        if (knowledge.pricing?.pt_pricing) {
          addSection('pt_pricing', '\n\n' + knowledge.pricing.pt_pricing);
        }
      } else if (detectedTopics.courses) {
        if (knowledge.pricing?.courses_kids) {
          addSection('courses_kids_pricing', '\n\n💰 KURS FIYATLARI:\n' + knowledge.pricing.courses_kids);
        }
        if (knowledge.pricing?.courses_women) {
          addSection('courses_women_pricing', '\n💰 ' + knowledge.pricing.courses_women);
        }
      } else {
        // Default: massage pricing
        if (knowledge.pricing?.spa_massage) {
          addSection('spa_massage', '\n\n' + knowledge.pricing.spa_massage);
        }
        if (knowledge.pricing?.other_massage_programs) {
          addSection('other_massage_programs', '\n\n' + knowledge.pricing.other_massage_programs);
        }
      }
      break;

    case 'membership':
      if (knowledge.pricing?.membership_individual) {
        addSection('membership_individual', '\n\n🏋️ FERDI UYELIK:\n' + knowledge.pricing.membership_individual);
      }
      if (knowledge.pricing?.membership_family) {
        addSection('membership_family', '\n\n👨‍👩‍👧 AILE UYELIGI:\n' + knowledge.pricing.membership_family);
      }
      if (knowledge.services?.facility_overview) {
        addSection('facility', '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview);
      }
      if (knowledge.services?.membership_includes) {
        addSection('membership_includes', '\n\n✅ TESIS KULLANIMI:\n' + knowledge.services.membership_includes);
      }
      // Add pilates if mentioned
      if (detectedTopics.pilates && knowledge.pricing?.reformer_pilates) {
        addSection('pilates_pricing', '\n\n🧘 PILATES FIYAT:\n' + knowledge.pricing.reformer_pilates);
      }
      break;

    case 'hours':
      let hoursContent = '\n\n🕐 SAATLER:';
      if (knowledge.hours?.spa_working_hours) {
        hoursContent += '\n• SPA: ' + knowledge.hours.spa_working_hours;
      }
      if (knowledge.hours?.facility_working_hours) {
        hoursContent += '\n• SPOR: ' + knowledge.hours.facility_working_hours;
      }
      addSection('hours', hoursContent);
      
      // Add course schedules if courses mentioned
      if (detectedTopics.courses) {
        if (knowledge.hours?.taekwondo_schedule) addSection('taekwondo_schedule', '\n\n🥋 ' + knowledge.hours.taekwondo_schedule);
        if (knowledge.hours?.kickboxing_schedule) addSection('kickboxing_schedule', '\n🥊 ' + knowledge.hours.kickboxing_schedule);
        if (knowledge.hours?.gymnastics_schedule) addSection('gymnastics_schedule', '\n🤸 ' + knowledge.hours.gymnastics_schedule);
        if (knowledge.hours?.swim_kids_schedule) addSection('swim_kids_schedule', '\n🏊 ' + knowledge.hours.swim_kids_schedule);
        if (knowledge.hours?.swim_women_schedule) addSection('swim_women_schedule', '\n🏊‍♀️ ' + knowledge.hours.swim_women_schedule);
      }
      break;

    case 'location':
      if (knowledge.contact?.address) {
        addSection('address', '\n\n📍 ADRES: ' + knowledge.contact.address);
      }
      if (knowledge.contact?.phone) {
        addSection('phone', '\n\n📞 ILETISIM: ' + knowledge.contact.phone);
      }
      break;

    case 'services':
      if (detectedTopics.massage) {
        if (knowledge.services?.therapist_info) {
          addSection('therapist', '\n\n👩‍⚕️ TERAPISTLER:\n' + knowledge.services.therapist_info);
        }
        if (knowledge.services?.massage_programs) {
          addSection('massage_programs', '\n\n💆 MASAJ TURLERI:\n' + knowledge.services.massage_programs);
        }
      } else if (detectedTopics.courses) {
        if (knowledge.services?.courses_kids) {
          addSection('courses_kids', '\n\n👶 COCUK KURSLARI:\n' + knowledge.services.courses_kids);
        }
        if (knowledge.services?.courses_women) {
          addSection('courses_women', '\n\n👩 KADIN KURSLARI:\n' + knowledge.services.courses_women);
        }
      } else if (detectedTopics.pilates) {
        if (knowledge.services?.reformer_pilates_details) {
          addSection('pilates_details', '\n\n🧘 PILATES DETAY:\n' + knowledge.services.reformer_pilates_details);
        }
      } else {
        // General facility overview
        if (knowledge.services?.facility_overview) {
          addSection('facility', '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview);
        }
      }
      break;

    case 'kids':
      if (knowledge.services?.courses_kids) {
        addSection('courses_kids', '\n\n👶 COCUK KURSLARI:\n' + knowledge.services.courses_kids);
      }
      if (knowledge.services?.courses_women) {
        addSection('courses_women', '\n\n👩 KADIN KURSLARI:\n' + knowledge.services.courses_women);
      }
      if (knowledge.pricing?.courses_kids) {
        addSection('courses_kids_pricing', '\n\n💰 KURS FIYATLARI:\n' + knowledge.pricing.courses_kids);
      }
      if (knowledge.pricing?.courses_women) {
        addSection('courses_women_pricing', '\n💰 ' + knowledge.pricing.courses_women);
      }
      if (knowledge.policies?.age_groups) {
        addSection('age_groups', '\n\n📋 YAS GRUPLARI: ' + knowledge.policies.age_groups);
      }
      // Add schedules
      if (knowledge.hours?.taekwondo_schedule) addSection('taekwondo_schedule', '\n\n🥋 ' + knowledge.hours.taekwondo_schedule);
      if (knowledge.hours?.kickboxing_schedule) addSection('kickboxing_schedule', '\n🥊 ' + knowledge.hours.kickboxing_schedule);
      if (knowledge.hours?.gymnastics_schedule) addSection('gymnastics_schedule', '\n🤸 ' + knowledge.hours.gymnastics_schedule);
      if (knowledge.hours?.swim_kids_schedule) addSection('swim_kids_schedule', '\n🏊 ' + knowledge.hours.swim_kids_schedule);
      if (knowledge.hours?.swim_women_schedule) addSection('swim_women_schedule', '\n🏊‍♀️ ' + knowledge.hours.swim_women_schedule);
      break;

    case 'policies':
      if (knowledge.policies) {
        let policiesContent = '\n\n📋 KURALLAR:';
        Object.entries(knowledge.policies).forEach(([key, v]) => {
          if (key !== 'legitimate_services' && key !== 'rejection_prompt') {
            policiesContent += '\n• ' + v;
          }
        });
        addSection('policies', policiesContent);
      }
      break;

    case 'booking':
      if (knowledge.contact?.phone) {
        addSection('phone', '\n\n📞 RANDEVU: ' + knowledge.contact.phone);
      }
      // Hours only added when 'hours' is in detectedIntents (handled by hours case)
      break;

    case 'general_info':
      // Only for truly general questions or first message
      if (isFirstMessage) {
        if (knowledge.services?.facility_overview) {
          addSection('facility', '\n\n🏢 TESIS:\n' + knowledge.services.facility_overview);
        }
        // Campaign pricing only added when 'pricing' is in detectedIntents (handled by pricing case)
        if (knowledge.contact?.phone) {
          addSection('phone', '\n\n📞 RANDEVU: ' + knowledge.contact.phone);
        }
      }
      break;
  }
}

// ============================================
// CLOSE KNOWLEDGE CONTEXT WITH ANTI-HALLUCINATION FENCE
// ============================================

knowledgeContext += '\n\n=== BILGILER SONU ===';
knowledgeContext += '\n🚫 Yukaridaki bilgileri kullanarak cevap ver. Bilgi yoksa "Bu konuda detayli bilgi icin lutfen bizi arayin" de.';
knowledgeContext += '\n🚫 Yukarida OLMAYAN hizmet, fiyat veya saat UYDURMA!';

// ============================================
// SYSTEM PROMPT & HINTS
// ============================================

let systemPrompt = aiPrompt.systemMessage || 'Sen Eform Spor Merkezi musteri temsilcisisin.';

if (isSuspicious) {
  systemPrompt = 'Sen Eform Spor Merkezi musteri temsilcisisin. ONEMLI: Bu kullanici daha once uygunsuz mesaj gondermis. DIREKT ve KISA cevap ver. ASLA samimi olma. ASLA "nasil yardimci olabilirim", "randevu ister misiniz", "baska soru var mi" gibi sorular SORMA. Sadece sorulan soruya cevap ver ve BIT. Uygunsuz icerik algilasan HEMEN sert reddet.';
}

let customerHint = '';

// Multi-intent hint
if (detectedIntents.length > 1) {
  customerHint += '\n\n⚠️ COKLU SORU! Kullanici ' + detectedIntents.length + ' farkli konu hakkinda soru soruyor: ' + detectedIntents.join(', ') + '. HER KONUYA cevap ver, hicbirini atlama!';
}

// Specific hints based on topics
if (normalizedText.match(/ne getir|getirmem|getirmeli|yanima|yaninda/)) {
  customerHint += '\n\n⚠️ KRITIK: Kullanici masaga gelirken ne getirmesi gerektigini soruyor. MUTLAKA soyle: Havlu, terlik VE SORT tesiste ucretsiz saglanir. Tek kullanimlik sort secenegi de var. Havuz icin bone zorunlu.';
}

if (isFirstMessage && !isSuspicious) {
  customerHint += '\n\n⚠️ ILK MESAJ! Kendini tanit: "Merhaba! Ben Eform Spor Merkezi dijital asistaniyim."';
} else if (isSuspicious) {
  customerHint += '\n\n⚠️ SUPELI KULLANICI (ihlal: ' + offenseCount + '). Direkt cevap ver, samimi olma, ASLA soru sorma (randevu, yardim, vs). Sadece cevap ver ve BIT.';
}

const legitimateServices = knowledge.policies?.legitimate_services || 
  'MIX masaj, Klasik masaj, Sıcak taş masajı, Medikal masaj, Kese köpük, Hamam, Sauna, Buhar odası, Fitness, Reformer Pilates, Yüzme kursları, Jimnastik, Taekwondo, Kickboks, Boks, Personal Trainer, Fizik tedavi';

return [{ 
  json: { 
    senderId: parseData.senderId, 
    text: parseData.text, 
    startTime: parseData.startTime, 
    intent: primaryIntent,
    detectedIntents: detectedIntents,
    detectedTopics: Object.keys(detectedTopics).filter(k => detectedTopics[k]),
    isFirstMessage, 
    isSuspicious, 
    offenseCount, 
    systemPrompt, 
    customerHint, 
    knowledgeContext, 
    legitimateServices, 
    isTestMode: parseData.isTestMode 
  } 
}];
