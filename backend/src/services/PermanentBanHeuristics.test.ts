import { describe, expect, it } from 'vitest';
import { evaluatePermanentBanCandidate } from './PermanentBanHeuristics.js';

describe('PermanentBanHeuristics', () => {
  it('immediately bans clear slur and hate-speech style abuse', () => {
    const result = evaluatePermanentBanCandidate({
      messageText: 'Anani sikeyim, orospu cocugu',
      conductStateBefore: 'normal',
      offenseCountAfter: 1,
    });

    expect(result.shouldBan).toBe(true);
    expect(result.category).toBe('severe_abuse');
    expect(result.matchedTerms).toContain('severe_abuse');
  });

  it('does not permanent-ban innocent business questions', () => {
    const result = evaluatePermanentBanCandidate({
      messageText: 'Masaj fiyatlari nedir, hamam da kullaniyor muyuz?',
      conductStateBefore: 'normal',
      offenseCountAfter: 1,
    });

    expect(result.shouldBan).toBe(false);
  });

  it('does not permanent-ban a single euphemistic sexual question by itself', () => {
    const result = evaluatePermanentBanCandidate({
      messageText: 'Mutlu son var mi?',
      conductStateBefore: 'normal',
      offenseCountAfter: 1,
    });

    expect(result.shouldBan).toBe(false);
  });

  it('does not permanent-ban a first-time explicit but non-abusive sexual question', () => {
    const result = evaluatePermanentBanCandidate({
      messageText: 'Porno cekebilir miyim',
      conductStateBefore: 'normal',
      offenseCountAfter: 1,
    });

    expect(result.shouldBan).toBe(false);
  });

  it('permanent-bans repeated vulgar sexual spam after prior warnings', () => {
    const result = evaluatePermanentBanCandidate({
      messageText: 'Porno porno porno seks sakso',
      conductStateBefore: 'final_warning',
      offenseCountAfter: 3,
    });

    expect(result.shouldBan).toBe(true);
    expect(result.category).toBe('vulgar_sexual_spam');
  });

  it('requires repeated conduct before banning moderate insults', () => {
    const innocentFirst = evaluatePermanentBanCandidate({
      messageText: 'Salak',
      conductStateBefore: 'normal',
      offenseCountAfter: 1,
    });
    const repeated = evaluatePermanentBanCandidate({
      messageText: 'Salak',
      conductStateBefore: 'final_warning',
      offenseCountAfter: 3,
    });

    expect(innocentFirst.shouldBan).toBe(false);
    expect(repeated.shouldBan).toBe(true);
    expect(repeated.category).toBe('moderate_repeat_abuse');
  });

  it('does not treat short oc token as an instant first-message permanent ban', () => {
    const result = evaluatePermanentBanCandidate({
      messageText: 'oc',
      conductStateBefore: 'normal',
      offenseCountAfter: 1,
    });

    expect(result.shouldBan).toBe(false);
  });
});
