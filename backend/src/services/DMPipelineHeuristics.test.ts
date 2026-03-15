import { describe, expect, it } from 'vitest';
import {
  buildClarifyExhaustedContactResponse,
  buildDeterministicCampaignResponse,
  buildDeterministicCloseoutResponse,
  buildDeterministicClarifierResponse,
  CAMPAIGN_INFO_MODEL_ID,
  CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
  countRecentClarificationReplies,
  hasAppointmentIntentSignal,
  isBroadSpaOverviewTemplateRequest,
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
  isGenericInfoRequest,
  isGenericMassagePricingRequest,
  isPilatesInfoRequest,
  isStandaloneAppointmentRequest,
  NO_REPLY_MODEL_ID,
  PRICING_CLARIFIER_MODEL_ID,
  TOPIC_SELECTION_CLARIFIER_MODEL_ID,
} from './DMPipelineHeuristics.js';

describe('DMPipelineHeuristics', () => {
  it('builds a deterministic pricing clarifier for generic price asks', () => {
    const result = buildDeterministicClarifierResponse({
      messageText: 'Fiyat nedir?',
      intentCategories: ['pricing', 'general'],
      responseMode: 'clarify_only',
      semanticSignals: [],
    });

    expect(result).toEqual({
      response: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
      modelId: PRICING_CLARIFIER_MODEL_ID,
    });
  });

  it('builds a deterministic pricing clarifier for simple-turn answer-then-clarify pricing asks', () => {
    const result = buildDeterministicClarifierResponse({
      messageText: 'fiyatlari nedir',
      intentCategories: ['pricing', 'general'],
      responseMode: 'answer_then_clarify',
      semanticSignals: [],
    });

    expect(result).toEqual({
      response: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
      modelId: PRICING_CLARIFIER_MODEL_ID,
    });
  });

  it('does not force a pricing clarifier when a service category is already known', () => {
    const result = buildDeterministicClarifierResponse({
      messageText: 'Masaj fiyatlari nedir?',
      intentCategories: ['pricing', 'services'],
      responseMode: 'clarify_only',
      semanticSignals: [],
    });

    expect(result).toBeNull();
  });

  it('treats broad massage pricing asks as answerable without a clarifier', () => {
    expect(isGenericMassagePricingRequest({
      messageText: 'Masaj ucreti ne kadar',
      intentCategories: ['pricing', 'services'],
      semanticSignals: ['pricing_inquiry'],
    })).toBe(true);

    expect(isGenericMassagePricingRequest({
      messageText: 'Klasik masaj ucreti ne kadar',
      intentCategories: ['pricing', 'services'],
      semanticSignals: ['pricing_inquiry'],
    })).toBe(false);

    expect(isGenericMassagePricingRequest({
      messageText: '60 dk masaj ne kadar',
      intentCategories: ['pricing', 'services'],
      semanticSignals: ['pricing_inquiry'],
    })).toBe(false);
  });

  it('builds a deterministic topic-selection clarifier for service follow-ups', () => {
    const result = buildDeterministicClarifierResponse({
      messageText: 'Hamam',
      intentCategories: ['services'],
      responseMode: 'clarify_only',
      semanticSignals: ['topic_selection_follow_up'],
    });

    expect(result).toEqual({
      response: 'Hamam ile ilgili hangi alt bilgiyi ogrenmek istersiniz? 1. Fiyatlar 2. Detaylar 3. Saatler 4. Randevu.',
      modelId: TOPIC_SELECTION_CLARIFIER_MODEL_ID,
    });
  });

  it('detects direct contact questions and replies briefly to plain gratitude', () => {
    expect(isDirectLocationQuestion('Iskenderunun neresindesiniz?')).toBe(true);
    expect(isDirectPhoneQuestion('Telefon numaraniz nedir?')).toBe(true);
    expect(isGenericInfoRequest('Bilgi alabilir miyim?')).toBe(true);
    expect(isGenericInfoRequest({
      messageText: 'Hizmetleriniz hakkinda bilgi verir misiniz?',
      intentCategories: ['services'],
      semanticSignals: ['hizmet'],
    })).toBe(true);
    expect(isGenericInfoRequest({
      messageText: 'Kickboks hakkinda bilgi verirmisin',
      intentCategories: ['services'],
      semanticSignals: ['kickboks', 'boks'],
    })).toBe(false);
    expect(isGenericInfoRequest({
      messageText: 'Masaj ve sauna hakkinda bilgi alabilir miyim',
      intentCategories: ['services', 'general'],
      semanticSignals: ['service_inquiry', 'multi_service_inquiry', 'broad_service_overview_signal'],
    })).toBe(true);
    expect(isGenericInfoRequest('Kickboks hakkinda bilgi verirmisin')).toBe(false);
    expect(isPilatesInfoRequest('pilates var mi')).toBe(true);
    expect(isPilatesInfoRequest('reformer pilates')).toBe(true);
    expect(isPilatesInfoRequest('pilates ne kadar')).toBe(false);
    expect(hasAppointmentIntentSignal('Saat 2 de randevu almak istiyorum')).toBe(true);
    expect(isStandaloneAppointmentRequest('Randevu alabilir miyim?')).toBe(true);
    expect(isStandaloneAppointmentRequest('Rezervasyon yapabilir miyim')).toBe(true);
    expect(isStandaloneAppointmentRequest('Saat 2 de randevu almak istiyorum')).toBe(false);
    expect(isStandaloneAppointmentRequest('Masaj icin randevu alabilir miyim?')).toBe(false);
    expect(buildDeterministicCloseoutResponse('Tesekkurler')).toEqual({
      action: 'reply',
      response: 'Rica ederiz.',
      modelId: 'deterministic/closeout-v1',
    });
  });

  it('only treats broad spa overview requests as template-eligible when they are generic', () => {
    expect(isBroadSpaOverviewTemplateRequest({
      messageText: 'Masaj ve sauna hakkinda bilgi alabilir miyim',
      intentCategories: ['services', 'general'],
      semanticSignals: ['service_inquiry', 'multi_service_inquiry', 'broad_service_overview_signal'],
    })).toBe(true);

    expect(isBroadSpaOverviewTemplateRequest({
      messageText: 'Medikal masaj hakkinda bilgi alabilir miyim',
      intentCategories: ['services', 'general'],
      semanticSignals: ['service_inquiry', 'broad_service_overview_signal'],
    })).toBe(false);

    expect(isBroadSpaOverviewTemplateRequest({
      messageText: 'Masaj ve sauna fiyatlari nedir',
      intentCategories: ['services', 'pricing'],
      semanticSignals: ['service_inquiry', 'multi_service_inquiry'],
    })).toBe(false);
  });

  it('suppresses replies for terminal courtesy turns', () => {
    expect(buildDeterministicCloseoutResponse('Sorun degil')).toEqual({
      action: 'skip_send',
      response: null,
      modelId: NO_REPLY_MODEL_ID,
    });
    expect(buildDeterministicCloseoutResponse('Size de')).toEqual({
      action: 'skip_send',
      response: null,
      modelId: NO_REPLY_MODEL_ID,
    });
    expect(buildDeterministicCloseoutResponse('Gelecegim')).toEqual({
      action: 'skip_send',
      response: null,
      modelId: NO_REPLY_MODEL_ID,
    });
    expect(buildDeterministicCloseoutResponse('Tesekkurler arayacagim')).toEqual({
      action: 'skip_send',
      response: null,
      modelId: NO_REPLY_MODEL_ID,
    });
    expect(buildDeterministicCloseoutResponse('Ilginize')).toEqual({
      action: 'skip_send',
      response: null,
      modelId: NO_REPLY_MODEL_ID,
    });
  });

  it('counts recent clarification-like replies from the assistant', () => {
    const result = countRecentClarificationReplies([
      {
        direction: 'outbound',
        messageText: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
        createdAt: new Date().toISOString(),
        relativeTime: 'az once',
      },
      {
        direction: 'outbound',
        messageText: 'Mesajinizi daha acik yazar misiniz? Yalnizca profesyonel spa ve spor hizmetleri konusunda yardimci olabiliyoruz.',
        createdAt: new Date().toISOString(),
        relativeTime: 'az once',
      },
      {
        direction: 'inbound',
        messageText: 'Bu hizmeti istiyorum fiyat nedir',
        createdAt: new Date().toISOString(),
        relativeTime: 'az once',
      },
    ]);

    expect(result).toBe(2);
  });

  it('resets the clarification budget after a normal outbound answer', () => {
    const result = countRecentClarificationReplies([
      {
        direction: 'outbound',
        messageText: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
        createdAt: new Date().toISOString(),
        relativeTime: '2dk once',
      },
      {
        direction: 'inbound',
        messageText: 'Masaj',
        createdAt: new Date().toISOString(),
        relativeTime: '2dk once',
      },
      {
        direction: 'outbound',
        messageText: 'Klasik masaj 60dk 1300 TL, 90dk 2400 TL.',
        createdAt: new Date().toISOString(),
        relativeTime: '1dk once',
      },
      {
        direction: 'inbound',
        messageText: 'Baska bir sey soracagim',
        createdAt: new Date().toISOString(),
        relativeTime: 'az once',
      },
    ]);

    expect(result).toBe(0);
  });

  it('falls back to contact after a clarification budget is exhausted', () => {
    const result = buildClarifyExhaustedContactResponse({
      messageText: 'Bu hizmeti istiyorum fiyat nedir',
      conversationHistory: [
        {
          direction: 'outbound',
          messageText: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
          createdAt: new Date().toISOString(),
          relativeTime: '1dk once',
        },
      ],
      responseMode: 'answer_then_clarify',
      fallbackMessage: 'Detayli bilgi icin lutfen iletisime geciniz: 0326 502 58 58.',
    });

    expect(result).toEqual({
      response: 'Detayli bilgi icin lutfen iletisime geciniz: 0326 502 58 58.',
      modelId: CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
      clarificationCount: 1,
    });
  });

  it('does not fallback to contact on the first clarification attempt', () => {
    const result = buildClarifyExhaustedContactResponse({
      messageText: 'Bu hizmeti istiyorum fiyat nedir',
      conversationHistory: [],
      responseMode: 'clarify_only',
      fallbackMessage: 'Detayli bilgi icin lutfen iletisime geciniz: 0326 502 58 58.',
    });

    expect(result).toBeNull();
  });

  it('does not fallback when the follow-up already names a specific service', () => {
    const result = buildClarifyExhaustedContactResponse({
      messageText: 'Klasik masaj fiyat nedir',
      conversationHistory: [
        {
          direction: 'outbound',
          messageText: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
          createdAt: new Date().toISOString(),
          relativeTime: '1dk once',
        },
      ],
      responseMode: 'answer_then_clarify',
      fallbackMessage: 'Detayli bilgi icin lutfen iletisime geciniz: 0326 502 58 58.',
    });

    expect(result).toBeNull();
  });

  it('does not fallback to contact for campaign or group-discount follow-ups', () => {
    const result = buildClarifyExhaustedContactResponse({
      messageText: 'Su anda kampanya ne var peki',
      conversationHistory: [
        {
          direction: 'outbound',
          messageText: 'Merhaba! Hangi hizmetimizin fiyatini ogrenmek istersiniz? Masaj, uyelik, PT dersleri ve kurslar gibi seceneklerimiz var.',
          createdAt: new Date().toISOString(),
          relativeTime: '1dk once',
        },
        {
          direction: 'outbound',
          messageText: 'Mesajinizi daha acik yazar misiniz? Yalnizca profesyonel spa ve spor hizmetleri konusunda yardimci olabiliyoruz.',
          createdAt: new Date().toISOString(),
          relativeTime: 'az once',
        },
      ],
      responseMode: 'clarify_only',
      fallbackMessage: 'Detayli bilgi icin lutfen iletisime geciniz: 0326 502 58 58.',
      semanticSignals: ['campaign_inquiry', 'group_discount_inquiry'],
    });

    expect(result).toBeNull();
  });

  it('builds a deterministic campaign response for campaign asks', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Su anda kampanya ne var peki',
      semanticSignals: ['campaign_inquiry'],
      campaignTemplate: '🔥 KAMPANYA: 4 kisi gelirse 5. kisiye ayni masaj HEDIYE!',
    });

    expect(result).toEqual({
      response: '🔥 KAMPANYA: 4 kisi gelirse 5. kisiye ayni masaj HEDIYE!',
      modelId: CAMPAIGN_INFO_MODEL_ID,
    });
  });

  it('detects inflected campaign wording without relying on a semantic signal', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Su an kampanyaniz var mi?',
      semanticSignals: [],
      campaignTemplate: 'Guncel kampanya bilgisi',
    });

    expect(result).toEqual({
      response: 'Guncel kampanya bilgisi',
      modelId: CAMPAIGN_INFO_MODEL_ID,
    });
  });

  it('answers campaign continuation questions instead of dumping the raw template', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Kampanya bayram sonrasi devam edecekmi',
      semanticSignals: ['campaign_inquiry'],
      campaignTemplate: '4 kisi gelirse 5. kisiye ayni masaj hediye!',
    });

    expect(result).toEqual({
      response: 'Su anki guncel kampanya kaydinda su bilgi yer aliyor: 4 kisi gelirse 5. kisiye ayni masaj hediye!\n\nBu kayitta kampanyanin devam veya bitis tarihi acikca belirtilmedigi icin ileri bir tarih icin net teyit veremiyorum.',
      modelId: CAMPAIGN_INFO_MODEL_ID,
    });
  });

  it('uses explicit campaign validity details when the template already contains them', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Kampanya ne zamana kadar gecerli',
      semanticSignals: ['campaign_inquiry'],
      campaignTemplate: '4 kisi gelirse 5. kisiye ayni masaj hediye. Kampanya 31 Mart 2026 tarihine kadar gecerlidir.',
    });

    expect(result).toEqual({
      response: 'Su anki guncel kampanya kaydinda su bilgi yer aliyor: 4 kisi gelirse 5. kisiye ayni masaj hediye. Kampanya 31 Mart 2026 tarihine kadar gecerlidir.',
      modelId: CAMPAIGN_INFO_MODEL_ID,
    });
  });

  it('uses a grounded safe fallback when campaign info is unavailable', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Grup indirimi var mi',
      semanticSignals: ['group_discount_inquiry'],
      campaignTemplate: null,
    });

    expect(result).toEqual({
      response: 'Su anda paylasabilecegim net bir kampanya bilgisi goremiyorum.',
      modelId: CAMPAIGN_INFO_MODEL_ID,
    });
  });

  it('detects campaign intent from generic opportunity questions without depending on current KB text', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Su an firsat var mi',
      semanticSignals: [],
      campaignTemplate: 'Guncel kampanya bilgisi',
    });

    expect(result).toEqual({
      response: 'Guncel kampanya bilgisi',
      modelId: CAMPAIGN_INFO_MODEL_ID,
    });
  });

  it('does not treat unrelated firsat wording as a campaign inquiry', () => {
    const result = buildDeterministicCampaignResponse({
      messageText: 'Ismini sormama firsat vermedi ama tesekkurlerimi iletin',
      semanticSignals: ['staff_inquiry', 'positive_feedback'],
      campaignTemplate: 'Guncel kampanya bilgisi',
    });

    expect(result).toBeNull();
  });
});
