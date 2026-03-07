import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import type { DatabaseService } from '../database/DatabaseService.js';
import { KnowledgeBaseService, type KnowledgeEntry } from '../services/KnowledgeBaseService.js';
import { createIntegrationRoutes } from './integrationRoutes.js';

type ChangeSetRow = {
  id: string;
  requested_by: string | null;
  reason: string | null;
  summary_text: string | null;
  status: 'previewed' | 'applied' | 'rolled_back';
  preview_payload: string;
  apply_payload: string | null;
  rollback_payload: string | null;
  created_at: string;
  updated_at: string;
  applied_at: string | null;
  rolled_back_at: string | null;
};

type HistoryRow = {
  id: string;
  change_set_id: string;
  operation_index: number;
  operation_type: 'create' | 'update' | 'delete' | 'rollback';
  entry_id: string | null;
  before_state: string | null;
  after_state: string | null;
  created_at: string;
};

type LogRow = {
  id: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  details: unknown;
  created_at: string;
};

class FakeRawDb {
  private knowledgeBase = new Map<string, KnowledgeEntry>();
  private changeSets = new Map<string, ChangeSetRow>();
  private history: HistoryRow[] = [];
  private logs = new Map<number, LogRow>();
  private logId = 1;

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized === 'SELECT * FROM knowledge_base WHERE id = ?') {
      return {
        get: (id: string) => this.clone(this.knowledgeBase.get(id) || null),
      };
    }

    if (normalized === 'SELECT * FROM knowledge_base WHERE category = ? AND key_name = ?') {
      return {
        get: (category: string, keyName: string) =>
          this.clone(this.findKnowledgeByCategoryKey(category, keyName)),
      };
    }

    if (normalized === 'SELECT * FROM knowledge_base ORDER BY category, key_name') {
      return {
        all: () => this.sortedKnowledgeRows(),
      };
    }

    if (normalized.startsWith('INSERT INTO knowledge_base (')) {
      return {
        run: (...args: unknown[]) => {
          const [id, category, key_name, value, description, is_active] = args as [
            string,
            KnowledgeEntry['category'],
            string,
            string,
            string | null,
            number
          ];
          const hasExplicitVersion = args.length === 9;
          const version = hasExplicitVersion ? (args[6] as number) : 1;
          const created_at = hasExplicitVersion ? (args[7] as string) : (args[6] as string);
          const updated_at = hasExplicitVersion ? (args[8] as string) : (args[7] as string);

          this.assertUniqueCategoryKey(category, key_name, id);
          this.knowledgeBase.set(id, {
            id,
            category,
            key_name,
            value,
            description,
            is_active,
            version,
            created_at,
            updated_at,
          });

          return { changes: 1 };
        },
      };
    }

    if (normalized.startsWith('UPDATE knowledge_base SET')) {
      return {
        run: (...args: unknown[]) => {
          const setClause = normalized.split(' SET ')[1].split(' WHERE ')[0];
          const segments = setClause.split(',').map((segment) => segment.trim());
          const id = args[args.length - 1] as string;
          const existing = this.knowledgeBase.get(id);
          if (!existing) {
            return { changes: 0 };
          }

          const next = this.clone(existing) as KnowledgeEntry;
          let argIndex = 0;
          for (const segment of segments) {
            const [field, expression] = segment.split(' = ');
            if (expression === 'version + 1') {
              next.version += 1;
              continue;
            }

            (next as unknown as Record<string, unknown>)[field] = args[argIndex];
            argIndex += 1;
          }
          this.assertUniqueCategoryKey(next.category, next.key_name, id);
          this.knowledgeBase.set(id, next);
          return { changes: 1 };
        },
      };
    }

    if (normalized === 'DELETE FROM knowledge_base WHERE id = ?') {
      return {
        run: (id: string) => ({ changes: this.knowledgeBase.delete(id) ? 1 : 0 }),
      };
    }

    if (normalized === 'SELECT * FROM knowledge_base_change_sets WHERE id = ?') {
      return {
        get: (id: string) => this.clone(this.changeSets.get(id) || null),
      };
    }

    if (normalized.startsWith('INSERT INTO knowledge_base_change_sets (')) {
      return {
        run: (
          id: string,
          requested_by: string | null,
          reason: string | null,
          summary_text: string | null,
          preview_payload: string,
          created_at: string,
          updated_at: string
        ) => {
          this.changeSets.set(id, {
            id,
            requested_by,
            reason,
            summary_text,
            status: 'previewed',
            preview_payload,
            apply_payload: null,
            rollback_payload: null,
            created_at,
            updated_at,
            applied_at: null,
            rolled_back_at: null,
          });
          return { changes: 1 };
        },
      };
    }

    if (normalized.includes("UPDATE knowledge_base_change_sets SET status = 'applied'")) {
      return {
        run: (apply_payload: string, applied_at: string, updated_at: string, id: string) => {
          const row = this.changeSets.get(id);
          if (!row) {
            return { changes: 0 };
          }
          row.status = 'applied';
          row.apply_payload = apply_payload;
          row.applied_at = applied_at;
          row.updated_at = updated_at;
          this.changeSets.set(id, row);
          return { changes: 1 };
        },
      };
    }

    if (normalized.includes("UPDATE knowledge_base_change_sets SET status = 'rolled_back'")) {
      return {
        run: (rollback_payload: string, rolled_back_at: string, updated_at: string, id: string) => {
          const row = this.changeSets.get(id);
          if (!row) {
            return { changes: 0 };
          }
          row.status = 'rolled_back';
          row.rollback_payload = rollback_payload;
          row.rolled_back_at = rolled_back_at;
          row.updated_at = updated_at;
          this.changeSets.set(id, row);
          return { changes: 1 };
        },
      };
    }

    if (normalized.includes('FROM knowledge_base_history') && normalized.includes("operation_type IN ('create', 'update', 'delete')")) {
      return {
        all: (changeSetId: string) =>
          this.history
            .filter((row) => row.change_set_id === changeSetId && row.operation_type !== 'rollback')
            .sort((left, right) => right.operation_index - left.operation_index)
            .map((row) => this.clone(row)),
      };
    }

    if (normalized.startsWith('INSERT INTO knowledge_base_history (')) {
      return {
        run: (
          id: string,
          change_set_id: string,
          operation_index: number,
          operation_type: HistoryRow['operation_type'],
          entry_id: string | null,
          before_state: string | null,
          after_state: string | null,
          created_at: string
        ) => {
          this.history.push({
            id,
            change_set_id,
            operation_index,
            operation_type,
            entry_id,
            before_state,
            after_state,
            created_at,
          });
          return { changes: 1 };
        },
      };
    }

    if (normalized.startsWith('INSERT INTO system_logs')) {
      return {
        run: (level: LogRow['level'], message: string, details: string | null, created_at: string) => {
          const id = this.logId++;
          this.logs.set(id, {
            id,
            level,
            message,
            details: details ? JSON.parse(details) : null,
            created_at,
          });
          return { lastInsertRowid: id };
        },
      };
    }

    if (normalized === 'SELECT * FROM system_logs WHERE id = ?') {
      return {
        get: (id: number) => this.clone(this.logs.get(id) || null),
      };
    }

    throw new Error(`Unexpected SQL in fake DB: ${normalized}`);
  }

  close() {
    this.knowledgeBase.clear();
    this.changeSets.clear();
    this.history = [];
    this.logs.clear();
  }

  private sortedKnowledgeRows() {
    return Array.from(this.knowledgeBase.values())
      .sort((left, right) => {
        if (left.category === right.category) {
          return left.key_name.localeCompare(right.key_name);
        }
        return left.category.localeCompare(right.category);
      })
      .map((row) => this.clone(row));
  }

  private findKnowledgeByCategoryKey(category: string, keyName: string) {
    for (const row of this.knowledgeBase.values()) {
      if (row.category === category && row.key_name === keyName) {
        return row;
      }
    }
    return null;
  }

  private assertUniqueCategoryKey(category: string, keyName: string, currentId: string) {
    for (const row of this.knowledgeBase.values()) {
      if (row.id !== currentId && row.category === category && row.key_name === keyName) {
        throw new Error('UNIQUE constraint failed: knowledge_base.category, knowledge_base.key_name');
      }
    }
  }

  private clone<T>(value: T): T {
    return value === null ? value : JSON.parse(JSON.stringify(value));
  }
}

function createFakeDatabaseService() {
  const rawDb = new FakeRawDb();

  const dbService = {
    db: rawDb,
    getDb() {
      return rawDb;
    },
    transaction<T>(fn: () => T): T {
      return fn();
    },
    createLog(data: { level: 'info' | 'warn' | 'error'; message: string; details?: unknown }) {
      const now = new Date().toISOString();
      const insertStatement = rawDb.prepare(
        'INSERT INTO system_logs (level, message, details, created_at) VALUES (?, ?, ?, ?)'
      ) as {
        run: (
          level: 'info' | 'warn' | 'error',
          message: string,
          details: string | null,
          created_at: string
        ) => { lastInsertRowid: number };
      };
      const selectStatement = rawDb.prepare('SELECT * FROM system_logs WHERE id = ?') as {
        get: (id: number) => LogRow | null;
      };
      const result = insertStatement.run(
        data.level,
        data.message,
        data.details ? JSON.stringify(data.details) : null,
        now
      );
      return selectStatement.get(result.lastInsertRowid);
    },
    close() {
      rawDb.close();
    },
  };

  return dbService as unknown as DatabaseService & { close(): void };
}

describe('Integration KB change-set routes', () => {
  let app: Express;
  let dbService: DatabaseService & { close(): void };
  let knowledgeBaseService: KnowledgeBaseService;
  let targetEntry: KnowledgeEntry;

  const validApiKey = 'test-api-key-12345';

  beforeEach(() => {
    dbService = createFakeDatabaseService();
    knowledgeBaseService = new KnowledgeBaseService(dbService);

    targetEntry = knowledgeBaseService.create({
      category: 'faq',
      key_name: 'agent_preview_test_entry',
      value: 'Eski test cevabi',
      description: 'Preview protocol test entry',
      is_active: true,
    });

    process.env.KIO_API_KEY = validApiKey;

    app = express();
    app.use(express.json());
    app.use('/api/integrations', createIntegrationRoutes(dbService));
  });

  afterEach(() => {
    dbService.close();
    delete process.env.KIO_API_KEY;
  });

  it('previews KB updates without mutating live data', async () => {
    const previewRes = await request(app)
      .post('/api/integrations/knowledge/change-sets/preview')
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({
        requestedBy: 'forge',
        reason: 'Update test FAQ copy',
        operations: [
          {
            type: 'update',
            id: targetEntry.id,
            value: 'Yeni test cevabi',
            description: 'Updated by preview test',
          },
        ],
      })
      .expect(201);

    expect(previewRes.body.status).toBe('previewed');
    expect(previewRes.body.preview.summary.totalOperations).toBe(1);
    expect(previewRes.body.preview.operations[0].current.value).toBe('Eski test cevabi');
    expect(previewRes.body.preview.operations[0].proposed.value).toBe('Yeni test cevabi');

    const liveEntry = knowledgeBaseService.getById(targetEntry.id);
    expect(liveEntry?.value).toBe('Eski test cevabi');
    expect(liveEntry?.description).toBe('Preview protocol test entry');
  });

  it('applies a previewed KB change set and returns the final state', async () => {
    const previewRes = await request(app)
      .post('/api/integrations/knowledge/change-sets/preview')
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({
        requestedBy: 'forge',
        operations: [
          {
            type: 'update',
            id: targetEntry.id,
            value: 'Uygulanmis test cevabi',
          },
        ],
      })
      .expect(201);

    const changeSetId = previewRes.body.id as string;

    const applyRes = await request(app)
      .post(`/api/integrations/knowledge/change-sets/${changeSetId}/apply`)
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({ appliedBy: 'forge' })
      .expect(200);

    expect(applyRes.body.status).toBe('applied');
    expect(applyRes.body.applyResult.summary.appliedCount).toBe(1);
    expect(applyRes.body.applyResult.operations[0].after.value).toBe('Uygulanmis test cevabi');

    const liveEntry = knowledgeBaseService.getById(targetEntry.id);
    expect(liveEntry?.value).toBe('Uygulanmis test cevabi');
    expect(liveEntry?.version).toBe(targetEntry.version + 1);

    const fetchRes = await request(app)
      .get(`/api/integrations/knowledge/change-sets/${changeSetId}`)
      .set('Authorization', `Bearer ${validApiKey}`)
      .expect(200);

    expect(fetchRes.body.status).toBe('applied');
    expect(fetchRes.body.applyResult.summary.appliedCount).toBe(1);
  });

  it('rejects apply when the live KB changed after preview', async () => {
    const previewRes = await request(app)
      .post('/api/integrations/knowledge/change-sets/preview')
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({
        requestedBy: 'forge',
        operations: [
          {
            type: 'update',
            id: targetEntry.id,
            value: 'Previewlenen yeni cevap',
          },
        ],
      })
      .expect(201);

    knowledgeBaseService.update(targetEntry.id, {
      value: 'Araya giren manuel degisiklik',
    });

    const applyRes = await request(app)
      .post(`/api/integrations/knowledge/change-sets/${previewRes.body.id}/apply`)
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({ appliedBy: 'forge' })
      .expect(409);

    expect(applyRes.body.code).toBe('STALE_PREVIEW');
    expect(knowledgeBaseService.getById(targetEntry.id)?.value).toBe('Araya giren manuel degisiklik');
  });

  it('rolls back an applied KB change set', async () => {
    const previewRes = await request(app)
      .post('/api/integrations/knowledge/change-sets/preview')
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({
        requestedBy: 'forge',
        operations: [
          {
            type: 'update',
            id: targetEntry.id,
            value: 'Geri alinacak cevap',
            description: 'rollback test',
          },
        ],
      })
      .expect(201);

    const changeSetId = previewRes.body.id as string;

    await request(app)
      .post(`/api/integrations/knowledge/change-sets/${changeSetId}/apply`)
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({ appliedBy: 'forge' })
      .expect(200);

    const rollbackRes = await request(app)
      .post(`/api/integrations/knowledge/change-sets/${changeSetId}/rollback`)
      .set('Authorization', `Bearer ${validApiKey}`)
      .send({ rolledBackBy: 'forge' })
      .expect(200);

    expect(rollbackRes.body.status).toBe('rolled_back');
    expect(rollbackRes.body.rollbackResult.summary.restoredCount).toBe(1);
    expect(knowledgeBaseService.getById(targetEntry.id)?.value).toBe('Eski test cevabi');
    expect(knowledgeBaseService.getById(targetEntry.id)?.description).toBe('Preview protocol test entry');
  });
});
