import { describe, expect, it } from 'vitest';
import {
  buildClarifyExhaustedContactResponse,
  buildDeterministicCloseoutResponse,
  buildDeterministicClarifierResponse,
  CLARIFY_EXHAUSTED_CONTACT_MODEL_ID,
  countRecentClarificationReplies,
  hasAppointmentIntentSignal,
  isDirectLocationQuestion,
  isDirectPhoneQuestion,
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
});
