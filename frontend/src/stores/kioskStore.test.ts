import { describe, expect, it } from 'vitest';
import { sanitizePersistedKioskState } from './kioskStore';

describe('sanitizePersistedKioskState', () => {
  it('keeps reusable cache data and drops stale runtime mode fields', () => {
    const sanitized = sanitizePersistedKioskState({
      mode: 'survey',
      activeSurveyId: 'old-survey',
      isOffline: true,
      theme: 'showcase',
      massages: [{ id: 'm1' }],
      queuedResponses: [{ id: 'q1' }],
    });

    expect(sanitized).toEqual({
      theme: 'showcase',
      massages: [{ id: 'm1' }],
      activeSurvey: null,
      googleReviewConfig: null,
      queuedResponses: [{ id: 'q1' }],
    });
  });

  it('falls back to safe defaults for invalid persisted values', () => {
    const sanitized = sanitizePersistedKioskState({
      theme: 'legacy-theme',
      massages: 'bad-data',
      queuedResponses: null,
    });

    expect(sanitized).toEqual({
      theme: 'classic',
      massages: [],
      activeSurvey: null,
      googleReviewConfig: null,
      queuedResponses: [],
    });
  });
});
