import { describe, expect, it } from 'vitest';
import { DMResponseCacheService } from './DMResponseCacheService.js';

type CacheRow = {
  id: string;
  lookup_key: string;
  cache_class: string;
  normalized_message: string;
  kb_signature: string;
  config_signature: string;
  conduct_state: string;
  cache_version: string;
  response_hash: string;
  response_text: string;
  source_execution_id: string | null;
  observation_count: number;
  status: 'candidate' | 'active';
  first_seen_at: string;
  last_seen_at: string;
  expires_at: string;
};

class FakeCacheDb {
  private rows: CacheRow[] = [];

  exec(): void {}

  prepare(sql: string) {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();
    return {
      get: (...args: any[]) => this.handleGet(normalizedSql, args),
      all: (...args: any[]) => this.handleAll(normalizedSql, args),
      run: (...args: any[]) => this.handleRun(normalizedSql, args),
    };
  }

  private handleGet(sql: string, args: any[]): any {
    if (sql.includes("WHERE lookup_key = ? AND status = 'active'")) {
      const [lookupKey, now] = args;
      return this.rows
        .filter(row => row.lookup_key === lookupKey && row.status === 'active' && row.expires_at >= now)
        .sort((a, b) => b.observation_count - a.observation_count || b.last_seen_at.localeCompare(a.last_seen_at))
        .map(row => ({
          id: row.id,
          lookup_key: row.lookup_key,
          cache_class: row.cache_class,
          response_text: row.response_text,
          source_execution_id: row.source_execution_id,
          observation_count: row.observation_count,
          status: row.status,
        }))[0];
    }

    if (sql.includes('WHERE lookup_key = ? AND response_hash = ?')) {
      const [lookupKey, responseHash] = args;
      const row = this.rows.find(item => item.lookup_key === lookupKey && item.response_hash === responseHash);
      return row ? { id: row.id, observation_count: row.observation_count } : undefined;
    }

    if (sql.includes('COUNT(*) as total')) {
      const [now] = args;
      const activeRows = this.rows.filter(row => row.expires_at >= now);
      return {
        total: activeRows.length,
        active: activeRows.filter(row => row.status === 'active').length,
        candidate: activeRows.filter(row => row.status === 'candidate').length,
      };
    }

    return undefined;
  }

  private handleAll(sql: string, args: any[]): any[] {
    if (sql.includes('SELECT cache_class as cacheClass')) {
      const [now] = args;
      const counts = new Map<string, number>();
      for (const row of this.rows.filter(item => item.expires_at >= now)) {
        counts.set(row.cache_class, (counts.get(row.cache_class) || 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([cacheClass, count]) => ({ cacheClass, count }))
        .sort((a, b) => b.count - a.count || a.cacheClass.localeCompare(b.cacheClass));
    }

    if (sql.includes('normalized_message as normalizedMessage')) {
      const [now, statusOrLimit, maybeLimit] = args;
      const hasStatus = typeof maybeLimit === 'number';
      const status = hasStatus ? statusOrLimit : null;
      const limit = hasStatus ? maybeLimit : statusOrLimit;

      return this.rows
        .filter(row => row.expires_at >= now && (!status || row.status === status))
        .sort((a, b) => {
          if (!hasStatus) {
            const statusOrder = (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1);
            if (statusOrder !== 0) {
              return statusOrder;
            }
          }
          return b.observation_count - a.observation_count
            || b.last_seen_at.localeCompare(a.last_seen_at)
            || a.id.localeCompare(b.id);
        })
        .slice(0, limit)
        .map(row => ({
          id: row.id,
          cacheClass: row.cache_class,
          normalizedMessage: row.normalized_message,
          responseText: row.response_text,
          sourceExecutionId: row.source_execution_id,
          observationCount: row.observation_count,
          status: row.status,
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
          expiresAt: row.expires_at,
        }));
    }

    if (sql.includes('WHERE lookup_key = ?') && sql.includes('ORDER BY observation_count DESC')) {
      const [lookupKey, now] = args;
      return this.rows
        .filter(row => row.lookup_key === lookupKey && row.expires_at >= now)
        .sort((a, b) => b.observation_count - a.observation_count || b.last_seen_at.localeCompare(a.last_seen_at) || a.id.localeCompare(b.id))
        .map(row => ({ id: row.id, observation_count: row.observation_count }));
    }

    return [];
  }

  private handleRun(sql: string, args: any[]): any {
    if (sql.startsWith('INSERT INTO dm_response_cache')) {
      const [
        id,
        lookup_key,
        cache_class,
        normalized_message,
        kb_signature,
        config_signature,
        conduct_state,
        cache_version,
        response_hash,
        response_text,
        source_execution_id,
        first_seen_at,
        last_seen_at,
        expires_at,
      ] = args;
      this.rows.push({
        id,
        lookup_key,
        cache_class,
        normalized_message,
        kb_signature,
        config_signature,
        conduct_state,
        cache_version,
        response_hash,
        response_text,
        source_execution_id,
        observation_count: 1,
        status: 'candidate',
        first_seen_at,
        last_seen_at,
        expires_at,
      });
      return { changes: 1 };
    }

    if (sql.startsWith('UPDATE dm_response_cache SET response_text = ?')) {
      const [responseText, sourceExecutionId, lastSeenAt, expiresAt, id] = args;
      const row = this.rows.find(item => item.id === id);
      if (row) {
        row.response_text = responseText;
        row.source_execution_id = sourceExecutionId;
        row.observation_count += 1;
        row.last_seen_at = lastSeenAt;
        row.expires_at = expiresAt;
      }
      return { changes: row ? 1 : 0 };
    }

    if (sql.startsWith("UPDATE dm_response_cache SET status = 'candidate'")) {
      const [lookupKey] = args;
      for (const row of this.rows.filter(item => item.lookup_key === lookupKey)) {
        row.status = 'candidate';
      }
      return { changes: 1 };
    }

    if (sql.startsWith('UPDATE dm_response_cache SET status = CASE WHEN id = ?')) {
      const [activeId, lookupKey] = args;
      for (const row of this.rows.filter(item => item.lookup_key === lookupKey)) {
        row.status = row.id === activeId ? 'active' : 'candidate';
      }
      return { changes: 1 };
    }

    if (sql.startsWith('DELETE FROM dm_response_cache')) {
      const deleted = this.rows.length;
      this.rows = [];
      return { changes: deleted };
    }

    return { changes: 0 };
  }
}

describe('DMResponseCacheService', () => {
  it('promotes an exact-match answer only after three matching safe observations', () => {
    const service = new DMResponseCacheService(new FakeCacheDb() as any);
    const params = {
      cacheClass: 'direct_location' as const,
      normalizedMessage: 'iskenderunun neresindesiniz',
      kbSignature: '10:2026-03-09T10:00:00.000Z',
      configSignature: 'cfg-1',
      conductState: 'normal',
    };

    service.recordObservation({
      ...params,
      responseText: 'Konumumuz: Pac Meydani yani.',
      sourceExecutionId: 'EXE-1',
    });
    expect(service.lookupActive(params)).toBeNull();

    service.recordObservation({
      ...params,
      responseText: 'Konumumuz: Pac Meydani yani.',
      sourceExecutionId: 'EXE-2',
    });
    expect(service.lookupActive(params)).toBeNull();

    service.recordObservation({
      ...params,
      responseText: 'Konumumuz: Pac Meydani yani.',
      sourceExecutionId: 'EXE-3',
    });

    expect(service.lookupActive(params)).toMatchObject({
      cacheClass: 'direct_location',
      responseText: 'Konumumuz: Pac Meydani yani.',
      sourceExecutionId: 'EXE-3',
      observationCount: 3,
      status: 'active',
    });
  });

  it('keeps competing answers as candidates until one clearly wins and invalidates hits across signatures', () => {
    const service = new DMResponseCacheService(new FakeCacheDb() as any);
    const params = {
      cacheClass: 'general_info' as const,
      normalizedMessage: 'bilgi alabilir miyim',
      kbSignature: '10:2026-03-09T10:00:00.000Z',
      configSignature: 'cfg-1',
      conductState: 'normal',
    };

    service.recordObservation({
      ...params,
      responseText: 'Kisaca temel bilgileri paylasayim:',
      sourceExecutionId: 'EXE-A1',
    });
    service.recordObservation({
      ...params,
      responseText: 'Merhaba, detay verebilirim.',
      sourceExecutionId: 'EXE-B1',
    });
    service.recordObservation({
      ...params,
      responseText: 'Kisaca temel bilgileri paylasayim:',
      sourceExecutionId: 'EXE-A2',
    });

    expect(service.lookupActive(params)).toBeNull();

    service.recordObservation({
      ...params,
      responseText: 'Kisaca temel bilgileri paylasayim:',
      sourceExecutionId: 'EXE-A3',
    });

    expect(service.lookupActive(params)).toMatchObject({
      responseText: 'Kisaca temel bilgileri paylasayim:',
      observationCount: 3,
      status: 'active',
    });
    expect(service.lookupActive({ ...params, kbSignature: '11:2026-03-09T11:00:00.000Z' })).toBeNull();
  });

  it('builds a seed candidate only for safe, standalone, policy-passed direct replies', () => {
    const candidate = DMResponseCacheService.buildSeedCandidate({
      messageText: 'İskenderunun neresindesiniz?',
      responseText: 'Pac Meydani civarindayiz.',
      trace: {
        sexualIntent: { action: 'allow' },
        conductControl: { state: 'normal' },
        intentCategories: ['contact'],
        matchedKeywords: [],
        modelTier: 'light',
        modelId: 'openrouter/google/gemini-2.0-flash-lite',
        metaSendStatus: 'success',
        openclawSessionKey: 'direct',
        directResponse: { used: true, modelId: 'openrouter/google/gemini-2.0-flash-lite' },
        policyValidation: { status: 'pass', attempts: 1 },
        conversationHistory: { followUpHint: null, activeState: null },
      },
      pipelineError: null,
      kbSignature: 'kb-1',
      configSignature: 'cfg-1',
      sourceExecutionId: 'EXE-10',
      observedAt: '2026-03-09T10:00:00.000Z',
    });

    expect(candidate).toMatchObject({
      cacheClass: 'direct_location',
      record: {
        cacheClass: 'direct_location',
        kbSignature: 'kb-1',
        configSignature: 'cfg-1',
        conductState: 'normal',
        sourceExecutionId: 'EXE-10',
      },
    });
  });

  it('rejects seed candidates when policy corrected the answer or the message depends on follow-up state', () => {
    const corrected = DMResponseCacheService.buildSeedCandidate({
      messageText: 'Mix masaj fiyati ne kadar?',
      responseText: 'Mix masaj fiyatimiz ...',
      trace: {
        sexualIntent: { action: 'allow' },
        conductControl: { state: 'normal' },
        intentCategories: ['pricing', 'services'],
        matchedKeywords: [],
        modelTier: 'standard',
        modelId: 'openrouter/google/gemini-2.0-flash',
        metaSendStatus: 'success',
        openclawSessionKey: 'direct',
        directResponse: { used: true, modelId: 'openrouter/google/gemini-2.0-flash' },
        policyValidation: { status: 'corrected', attempts: 2 },
        conversationHistory: { followUpHint: null, activeState: null },
      },
      pipelineError: null,
      kbSignature: 'kb-1',
      configSignature: 'cfg-1',
    });

    const followUp = DMResponseCacheService.buildSeedCandidate({
      messageText: 'Fiyatlari?',
      responseText: 'Mix masaj fiyatimiz ...',
      trace: {
        sexualIntent: { action: 'allow' },
        conductControl: { state: 'normal' },
        intentCategories: ['pricing', 'services'],
        matchedKeywords: [],
        modelTier: 'standard',
        modelId: 'openrouter/google/gemini-2.0-flash',
        metaSendStatus: 'success',
        openclawSessionKey: 'direct',
        directResponse: { used: true, modelId: 'openrouter/google/gemini-2.0-flash' },
        policyValidation: { status: 'pass', attempts: 1 },
        conversationHistory: {
          followUpHint: { topicLabel: 'mix masaj', rewrittenQuestion: 'mix masaj fiyatlari' },
          activeState: { usedForPlanning: true, repairedFromState: false },
        },
      },
      pipelineError: null,
      kbSignature: 'kb-1',
      configSignature: 'cfg-1',
    });

    expect(corrected).toBeNull();
    expect(followUp).toBeNull();
  });

  it('rejects complaint-like or non-direct historical responses during seeding', () => {
    const complaint = DMResponseCacheService.buildSeedCandidate({
      messageText: 'Masajdan memnun degilim',
      responseText: 'Yardimci olayim.',
      trace: {
        sexualIntent: { action: 'allow' },
        conductControl: { state: 'normal' },
        intentCategories: ['complaint'],
        matchedKeywords: [],
        modelTier: 'standard',
        modelId: 'openrouter/google/gemini-2.0-flash',
        metaSendStatus: 'success',
        openclawSessionKey: 'direct',
        directResponse: { used: true, modelId: 'openrouter/google/gemini-2.0-flash' },
        policyValidation: { status: 'pass', attempts: 1 },
        conversationHistory: { followUpHint: null, activeState: null },
      },
      pipelineError: null,
      kbSignature: 'kb-1',
      configSignature: 'cfg-1',
    });

    const nonDirect = DMResponseCacheService.buildSeedCandidate({
      messageText: 'Hamam var mi?',
      responseText: 'Hamamimiz vardir.',
      trace: {
        sexualIntent: { action: 'allow' },
        conductControl: { state: 'normal' },
        intentCategories: ['services'],
        matchedKeywords: [],
        modelTier: 'standard',
        modelId: 'openclaw/agent',
        metaSendStatus: 'success',
        openclawSessionKey: 'agent:main:main',
        directResponse: { used: false, modelId: 'openrouter/google/gemini-2.0-flash' },
        policyValidation: { status: 'pass', attempts: 1 },
        conversationHistory: { followUpHint: null, activeState: null },
      },
      pipelineError: null,
      kbSignature: 'kb-1',
      configSignature: 'cfg-1',
    });

    expect(complaint).toBeNull();
    expect(nonDirect).toBeNull();
  });

  it('lists cache rows for admin inspection by status', () => {
    const service = new DMResponseCacheService(new FakeCacheDb() as any);
    const activeParams = {
      cacheClass: 'direct_location' as const,
      normalizedMessage: 'neredesiniz',
      kbSignature: '10:2026-03-09T10:00:00.000Z',
      configSignature: 'cfg-1',
      conductState: 'normal',
    };
    const candidateParams = {
      cacheClass: 'general_info' as const,
      normalizedMessage: 'bilgi alabilir miyim',
      kbSignature: '10:2026-03-09T10:00:00.000Z',
      configSignature: 'cfg-1',
      conductState: 'normal',
    };

    service.recordObservation({
      ...activeParams,
      responseText: 'Pac Meydani civarindayiz.',
      sourceExecutionId: 'EXE-1',
      observedAt: '2026-03-10T10:00:00.000Z',
    });
    service.recordObservation({
      ...activeParams,
      responseText: 'Pac Meydani civarindayiz.',
      sourceExecutionId: 'EXE-2',
      observedAt: '2026-03-10T10:01:00.000Z',
    });
    service.recordObservation({
      ...activeParams,
      responseText: 'Pac Meydani civarindayiz.',
      sourceExecutionId: 'EXE-3',
      observedAt: '2026-03-10T10:02:00.000Z',
    });
    service.recordObservation({
      ...candidateParams,
      responseText: 'Kisaca temel bilgileri paylasayim.',
      sourceExecutionId: 'EXE-4',
      observedAt: '2026-03-10T11:00:00.000Z',
    });

    const allEntries = service.listEntries({ status: 'all', limit: 10 });
    const activeEntries = service.listEntries({ status: 'active', limit: 10 });
    const candidateEntries = service.listEntries({ status: 'candidate', limit: 10 });

    expect(allEntries).toHaveLength(2);
    expect(allEntries[0]).toMatchObject({
      cacheClass: 'direct_location',
      normalizedMessage: 'neredesiniz',
      responseText: 'Pac Meydani civarindayiz.',
      sourceExecutionId: 'EXE-3',
      observationCount: 3,
      status: 'active',
    });
    expect(activeEntries).toHaveLength(1);
    expect(activeEntries[0].status).toBe('active');
    expect(candidateEntries).toHaveLength(1);
    expect(candidateEntries[0]).toMatchObject({
      cacheClass: 'general_info',
      normalizedMessage: 'bilgi alabilir miyim',
      status: 'candidate',
    });
  });
});
