import { describe, expect, it } from 'vitest';
import {
  buildDeterministicClarifierResponse,
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
});
