import { randomUUID } from 'crypto';
import type { DatabaseService } from '../database/DatabaseService.js';
import type { KnowledgeEntry } from './KnowledgeBaseService.js';

type KnowledgeCategory = KnowledgeEntry['category'];
type ChangeOperationType = 'create' | 'update' | 'delete';
type ChangeSetStatus = 'previewed' | 'applied' | 'rolled_back';

const KB_CATEGORIES: KnowledgeCategory[] = [
  'services',
  'pricing',
  'hours',
  'policies',
  'contact',
  'general',
  'faq',
];

const MAX_KEY_LENGTH = 100;
const MAX_VALUE_LENGTH = 5000;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_OPERATIONS_PER_CHANGE_SET = 25;

export interface KnowledgeEntrySnapshot {
  id: string;
  category: KnowledgeCategory;
  key_name: string;
  value: string;
  description: string | null;
  is_active: number;
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface KnowledgeChangeDiffField {
  before: unknown;
  after: unknown;
}

export interface KnowledgeChangePreviewOperation {
  index: number;
  type: ChangeOperationType;
  entryId: string;
  current: KnowledgeEntrySnapshot | null;
  proposed: KnowledgeEntrySnapshot | null;
  changes: Record<string, KnowledgeChangeDiffField>;
  warnings: string[];
  noop: boolean;
}

export interface KnowledgeChangeSetPreviewSummary {
  totalOperations: number;
  createCount: number;
  updateCount: number;
  deleteCount: number;
  noopCount: number;
  affectedEntryIds: string[];
  affectedCategories: KnowledgeCategory[];
  scanSummary: {
    totalEntries: number;
    activeEntries: number;
    categories: KnowledgeCategory[];
  };
}

export interface KnowledgeChangeApplyOperationResult {
  index: number;
  type: ChangeOperationType;
  entryId: string;
  noop: boolean;
  before: KnowledgeEntrySnapshot | null;
  after: KnowledgeEntrySnapshot | null;
}

export interface KnowledgeChangeApplyResult {
  appliedBy: string | null;
  appliedAt: string;
  summary: {
    appliedCount: number;
    skippedNoopCount: number;
    affectedEntryIds: string[];
  };
  operations: KnowledgeChangeApplyOperationResult[];
}

export interface KnowledgeChangeRollbackResult {
  rolledBackBy: string | null;
  rolledBackAt: string;
  summary: {
    restoredCount: number;
    affectedEntryIds: string[];
  };
  operations: KnowledgeChangeApplyOperationResult[];
}

export interface KnowledgeChangeSetRecord {
  id: string;
  requestedBy: string | null;
  reason: string | null;
  summaryText: string | null;
  status: ChangeSetStatus;
  preview: {
    summary: KnowledgeChangeSetPreviewSummary;
    operations: KnowledgeChangePreviewOperation[];
  };
  applyResult: KnowledgeChangeApplyResult | null;
  rollbackResult: KnowledgeChangeRollbackResult | null;
  createdAt: string;
  updatedAt: string;
  appliedAt: string | null;
  rolledBackAt: string | null;
}

export interface KnowledgeChangeSetPreviewRequest {
  requestedBy?: string | null;
  reason?: string | null;
  summaryText?: string | null;
  operations: KnowledgeChangeOperationInput[];
}

export interface KnowledgeChangeOperationInput {
  type: ChangeOperationType;
  id?: string;
  category?: KnowledgeCategory;
  key_name?: string;
  value?: string;
  description?: string | null;
  is_active?: boolean;
}

export class KnowledgeBaseChangeSetError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'KnowledgeBaseChangeSetError';
  }
}

type ChangeSetRow = {
  id: string;
  requested_by: string | null;
  reason: string | null;
  summary_text: string | null;
  status: ChangeSetStatus;
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

export class KnowledgeBaseChangeSetService {
  constructor(private readonly dbService: DatabaseService) {}

  preview(request: KnowledgeChangeSetPreviewRequest): KnowledgeChangeSetRecord {
    const operations = this.normalizeOperations(request.operations);
    const allEntries = this.listAllEntries();
    const previewOperations = operations.map((operation, index) =>
      this.buildPreviewOperation({ operation, index })
    );
    const summary = this.buildPreviewSummary(previewOperations, allEntries);
    const id = randomUUID();
    const now = new Date().toISOString();

    this.rawDb()
      .prepare(`
        INSERT INTO knowledge_base_change_sets (
          id, requested_by, reason, summary_text, status,
          preview_payload, apply_payload, rollback_payload,
          created_at, updated_at, applied_at, rolled_back_at
        ) VALUES (?, ?, ?, ?, 'previewed', ?, NULL, NULL, ?, ?, NULL, NULL)
      `)
      .run(
        id,
        this.normalizeOptionalText(request.requestedBy),
        this.normalizeOptionalText(request.reason),
        this.normalizeOptionalText(request.summaryText),
        JSON.stringify({ summary, operations: previewOperations }),
        now,
        now
      );

    return this.getChangeSet(id)!;
  }

  getChangeSet(changeSetId: string): KnowledgeChangeSetRecord | null {
    const row = this.rawDb()
      .prepare(`SELECT * FROM knowledge_base_change_sets WHERE id = ?`)
      .get(changeSetId) as ChangeSetRow | undefined;

    return row ? this.mapChangeSetRow(row) : null;
  }

  apply(changeSetId: string, appliedBy?: string | null): KnowledgeChangeSetRecord {
    return this.dbService.transaction(() => {
      const row = this.getChangeSetRow(changeSetId);
      if (row.status !== 'previewed') {
        throw new KnowledgeBaseChangeSetError(
          `Change set ${changeSetId} is not previewed`,
          'INVALID_CHANGE_SET_STATUS',
          409,
          { status: row.status }
        );
      }

      const preview = this.parsePreviewPayload(row.preview_payload);
      const now = new Date().toISOString();
      const operations = preview.operations.map((operation) =>
        this.applyPreviewOperation(changeSetId, operation, now)
      );

      const applyResult: KnowledgeChangeApplyResult = {
        appliedBy: this.normalizeOptionalText(appliedBy),
        appliedAt: now,
        summary: {
          appliedCount: operations.filter((operation) => !operation.noop).length,
          skippedNoopCount: operations.filter((operation) => operation.noop).length,
          affectedEntryIds: Array.from(new Set(operations.map((operation) => operation.entryId))),
        },
        operations,
      };

      this.rawDb()
        .prepare(`
          UPDATE knowledge_base_change_sets
          SET status = 'applied',
              apply_payload = ?,
              applied_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(JSON.stringify(applyResult), now, now, changeSetId);

      return this.getChangeSet(changeSetId)!;
    });
  }

  rollback(changeSetId: string, rolledBackBy?: string | null): KnowledgeChangeSetRecord {
    return this.dbService.transaction(() => {
      const row = this.getChangeSetRow(changeSetId);
      if (row.status !== 'applied') {
        throw new KnowledgeBaseChangeSetError(
          `Change set ${changeSetId} is not applied`,
          'INVALID_CHANGE_SET_STATUS',
          409,
          { status: row.status }
        );
      }

      const historyRows = this.rawDb()
        .prepare(`
          SELECT *
          FROM knowledge_base_history
          WHERE change_set_id = ?
            AND operation_type IN ('create', 'update', 'delete')
          ORDER BY operation_index DESC
        `)
        .all(changeSetId) as HistoryRow[];

      if (historyRows.length === 0) {
        throw new KnowledgeBaseChangeSetError(
          `Change set ${changeSetId} has no applied history`,
          'MISSING_APPLY_HISTORY',
          409
        );
      }

      const now = new Date().toISOString();
      const operations = historyRows.map((historyRow) =>
        this.rollbackHistoryRow(historyRow, now)
      );

      const rollbackResult: KnowledgeChangeRollbackResult = {
        rolledBackBy: this.normalizeOptionalText(rolledBackBy),
        rolledBackAt: now,
        summary: {
          restoredCount: operations.filter((operation) => !operation.noop).length,
          affectedEntryIds: Array.from(new Set(operations.map((operation) => operation.entryId))),
        },
        operations,
      };

      this.rawDb()
        .prepare(`
          UPDATE knowledge_base_change_sets
          SET status = 'rolled_back',
              rollback_payload = ?,
              rolled_back_at = ?,
              updated_at = ?
          WHERE id = ?
        `)
        .run(JSON.stringify(rollbackResult), now, now, changeSetId);

      return this.getChangeSet(changeSetId)!;
    });
  }

  private rawDb() {
    return this.dbService.getDb();
  }

  private listAllEntries(): KnowledgeEntrySnapshot[] {
    const rows = this.rawDb()
      .prepare(`SELECT * FROM knowledge_base ORDER BY category, key_name`)
      .all() as KnowledgeEntry[];

    return rows.map((row) => this.toSnapshot(row));
  }

  private getEntryById(id: string): KnowledgeEntrySnapshot | null {
    const row = this.rawDb()
      .prepare(`SELECT * FROM knowledge_base WHERE id = ?`)
      .get(id) as KnowledgeEntry | undefined;

    return row ? this.toSnapshot(row) : null;
  }

  private getEntryByCategoryKey(category: KnowledgeCategory, keyName: string): KnowledgeEntrySnapshot | null {
    const row = this.rawDb()
      .prepare(`SELECT * FROM knowledge_base WHERE category = ? AND key_name = ?`)
      .get(category, keyName) as KnowledgeEntry | undefined;

    return row ? this.toSnapshot(row) : null;
  }

  private normalizeOperations(operations: KnowledgeChangeOperationInput[] | undefined) {
    if (!Array.isArray(operations) || operations.length === 0) {
      throw new KnowledgeBaseChangeSetError('At least one operation is required', 'INVALID_OPERATIONS', 400);
    }

    if (operations.length > MAX_OPERATIONS_PER_CHANGE_SET) {
      throw new KnowledgeBaseChangeSetError(
        `A change set can include at most ${MAX_OPERATIONS_PER_CHANGE_SET} operations`,
        'TOO_MANY_OPERATIONS',
        400
      );
    }

    return operations.map((operation, index) => this.normalizeOperation(operation, index));
  }

  private normalizeOperation(operation: KnowledgeChangeOperationInput, index: number): KnowledgeChangeOperationInput {
    if (!operation || typeof operation !== 'object') {
      throw new KnowledgeBaseChangeSetError(`Operation ${index + 1} is invalid`, 'INVALID_OPERATION', 400);
    }

    if (!operation.type || !['create', 'update', 'delete'].includes(operation.type)) {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} must specify type create, update, or delete`,
        'INVALID_OPERATION_TYPE',
        400
      );
    }

    if (operation.type === 'create') {
      return {
        type: 'create',
        category: this.validateCategory(operation.category, index),
        key_name: this.validateKeyName(operation.key_name, index),
        value: this.validateValue(operation.value, index),
        description: this.validateDescription(operation.description, index),
        is_active: this.validateIsActive(operation.is_active),
      };
    }

    if (!operation.id || typeof operation.id !== 'string' || !operation.id.trim()) {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} must include a valid entry id`,
        'MISSING_ENTRY_ID',
        400
      );
    }

    if (operation.type === 'delete') {
      return {
        type: 'delete',
        id: operation.id.trim(),
      };
    }

    const normalized: KnowledgeChangeOperationInput = {
      type: 'update',
      id: operation.id.trim(),
    };

    if (operation.category !== undefined) normalized.category = this.validateCategory(operation.category, index);
    if (operation.key_name !== undefined) normalized.key_name = this.validateKeyName(operation.key_name, index);
    if (operation.value !== undefined) normalized.value = this.validateValue(operation.value, index);
    if (operation.description !== undefined) normalized.description = this.validateDescription(operation.description, index);
    if (operation.is_active !== undefined) normalized.is_active = this.validateIsActive(operation.is_active);

    return normalized;
  }

  private validateCategory(category: KnowledgeCategory | undefined, index: number): KnowledgeCategory {
    if (!category || !KB_CATEGORIES.includes(category)) {
      throw new KnowledgeBaseChangeSetError(`Operation ${index + 1} has an invalid category`, 'INVALID_CATEGORY', 400);
    }

    return category;
  }

  private validateKeyName(keyName: string | undefined, index: number): string {
    if (typeof keyName !== 'string' || !keyName.trim()) {
      throw new KnowledgeBaseChangeSetError(`Operation ${index + 1} has an invalid key_name`, 'INVALID_KEY_NAME', 400);
    }

    const trimmed = keyName.trim();
    if (trimmed.length > MAX_KEY_LENGTH) {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} key_name exceeds ${MAX_KEY_LENGTH} characters`,
        'INVALID_KEY_NAME',
        400
      );
    }

    return trimmed;
  }

  private validateValue(value: string | undefined, index: number): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new KnowledgeBaseChangeSetError(`Operation ${index + 1} has an invalid value`, 'INVALID_VALUE', 400);
    }

    const trimmed = value.trim();
    if (trimmed.length > MAX_VALUE_LENGTH) {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} value exceeds ${MAX_VALUE_LENGTH} characters`,
        'INVALID_VALUE',
        400
      );
    }

    return trimmed;
  }

  private validateDescription(description: string | null | undefined, index: number): string | null | undefined {
    if (description === undefined) {
      return undefined;
    }

    if (description === null) {
      return null;
    }

    if (typeof description !== 'string') {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} has an invalid description`,
        'INVALID_DESCRIPTION',
        400
      );
    }

    const trimmed = description.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} description exceeds ${MAX_DESCRIPTION_LENGTH} characters`,
        'INVALID_DESCRIPTION',
        400
      );
    }

    return trimmed || null;
  }

  private validateIsActive(value: boolean | undefined): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== 'boolean') {
      throw new KnowledgeBaseChangeSetError('is_active must be a boolean', 'INVALID_IS_ACTIVE', 400);
    }

    return value;
  }

  private buildPreviewOperation(params: { operation: KnowledgeChangeOperationInput; index: number }): KnowledgeChangePreviewOperation {
    const { operation, index } = params;

    if (operation.type === 'create') {
      const conflictingEntry = this.getEntryByCategoryKey(operation.category!, operation.key_name!);
      if (conflictingEntry) {
        throw new KnowledgeBaseChangeSetError(
          `Operation ${index + 1} conflicts with existing entry ${conflictingEntry.id}`,
          'KB_ENTRY_CONFLICT',
          409,
          { conflictingEntryId: conflictingEntry.id }
        );
      }

      const plannedId = randomUUID();
      const proposed: KnowledgeEntrySnapshot = {
        id: plannedId,
        category: operation.category!,
        key_name: operation.key_name!,
        value: operation.value!,
        description: operation.description ?? null,
        is_active: operation.is_active === undefined ? 1 : (operation.is_active ? 1 : 0),
        version: 1,
        created_at: null,
        updated_at: null,
      };

      return {
        index,
        type: 'create',
        entryId: plannedId,
        current: null,
        proposed,
        changes: this.diffSnapshots(null, proposed),
        warnings: [],
        noop: false,
      };
    }

    const current = this.getEntryById(operation.id!);
    if (!current) {
      throw new KnowledgeBaseChangeSetError(
        `Operation ${index + 1} entry ${operation.id} was not found`,
        'KB_ENTRY_NOT_FOUND',
        404,
        { entryId: operation.id }
      );
    }

    if (operation.type === 'delete') {
      return {
        index,
        type: 'delete',
        entryId: current.id,
        current,
        proposed: null,
        changes: this.diffSnapshots(current, null),
        warnings: [],
        noop: false,
      };
    }

    const baseProposed: KnowledgeEntrySnapshot = {
      ...current,
      category: operation.category ?? current.category,
      key_name: operation.key_name ?? current.key_name,
      value: operation.value ?? current.value,
      description: operation.description !== undefined ? (operation.description ?? null) : current.description,
      is_active: operation.is_active !== undefined ? (operation.is_active ? 1 : 0) : current.is_active,
      version: current.version,
      created_at: current.created_at,
      updated_at: current.updated_at,
    };

    if (baseProposed.category !== current.category || baseProposed.key_name !== current.key_name) {
      const conflictingEntry = this.getEntryByCategoryKey(baseProposed.category, baseProposed.key_name);
      if (conflictingEntry && conflictingEntry.id !== current.id) {
        throw new KnowledgeBaseChangeSetError(
          `Operation ${index + 1} conflicts with existing entry ${conflictingEntry.id}`,
          'KB_ENTRY_CONFLICT',
          409,
          { conflictingEntryId: conflictingEntry.id }
        );
      }
    }

    if (this.snapshotsEqual(current, baseProposed)) {
      return {
        index,
        type: 'update',
        entryId: current.id,
        current,
        proposed: current,
        changes: {},
        warnings: ['No live KB fields will change.'],
        noop: true,
      };
    }

    const proposed: KnowledgeEntrySnapshot = {
      ...baseProposed,
      version: current.version + 1,
      updated_at: null,
    };

    return {
      index,
      type: 'update',
      entryId: current.id,
      current,
      proposed,
      changes: this.diffSnapshots(current, proposed),
      warnings: [],
      noop: false,
    };
  }

  private buildPreviewSummary(
    operations: KnowledgeChangePreviewOperation[],
    allEntries: KnowledgeEntrySnapshot[]
  ): KnowledgeChangeSetPreviewSummary {
    const categories = Array.from(new Set(allEntries.map((entry) => entry.category))).sort() as KnowledgeCategory[];
    const affectedCategories = Array.from(
      new Set(
        operations
          .map((operation) => operation.proposed?.category || operation.current?.category)
          .filter((value): value is KnowledgeCategory => Boolean(value))
      )
    ).sort() as KnowledgeCategory[];

    return {
      totalOperations: operations.length,
      createCount: operations.filter((operation) => operation.type === 'create').length,
      updateCount: operations.filter((operation) => operation.type === 'update').length,
      deleteCount: operations.filter((operation) => operation.type === 'delete').length,
      noopCount: operations.filter((operation) => operation.noop).length,
      affectedEntryIds: operations.map((operation) => operation.entryId),
      affectedCategories,
      scanSummary: {
        totalEntries: allEntries.length,
        activeEntries: allEntries.filter((entry) => entry.is_active === 1).length,
        categories,
      },
    };
  }

  private diffSnapshots(before: KnowledgeEntrySnapshot | null, after: KnowledgeEntrySnapshot | null) {
    const fields: Array<keyof KnowledgeEntrySnapshot> = ['id', 'category', 'key_name', 'value', 'description', 'is_active', 'version'];
    const changes: Record<string, KnowledgeChangeDiffField> = {};

    for (const field of fields) {
      const beforeValue = before ? before[field] : null;
      const afterValue = after ? after[field] : null;
      if (beforeValue !== afterValue) {
        changes[field] = { before: beforeValue, after: afterValue };
      }
    }

    return changes;
  }

  private snapshotsEqual(left: KnowledgeEntrySnapshot | null, right: KnowledgeEntrySnapshot | null): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  private applyPreviewOperation(
    changeSetId: string,
    operation: KnowledgeChangePreviewOperation,
    now: string
  ): KnowledgeChangeApplyOperationResult {
    if (operation.type === 'create') {
      if (this.getEntryById(operation.entryId)) {
        throw new KnowledgeBaseChangeSetError(
          `Entry ${operation.entryId} already exists`,
          'STALE_PREVIEW',
          409,
          { entryId: operation.entryId }
        );
      }

      const conflictingEntry = this.getEntryByCategoryKey(operation.proposed!.category, operation.proposed!.key_name);
      if (conflictingEntry) {
        throw new KnowledgeBaseChangeSetError(
          `Entry ${conflictingEntry.id} now occupies ${operation.proposed!.category}/${operation.proposed!.key_name}`,
          'STALE_PREVIEW',
          409,
          { conflictingEntryId: conflictingEntry.id, entryId: operation.entryId }
        );
      }

      const after: KnowledgeEntrySnapshot = {
        ...operation.proposed!,
        created_at: now,
        updated_at: now,
      };

      this.insertSnapshot(after);
      this.insertHistory(changeSetId, operation.index, 'create', after.id, null, after, now);

      return {
        index: operation.index,
        type: 'create',
        entryId: after.id,
        noop: false,
        before: null,
        after,
      };
    }

    const current = this.getEntryById(operation.entryId);
    if (!this.snapshotsEqual(current, operation.current)) {
      throw new KnowledgeBaseChangeSetError(
        `Entry ${operation.entryId} changed after preview`,
        'STALE_PREVIEW',
        409,
        {
          entryId: operation.entryId,
          previewCurrent: operation.current,
          liveCurrent: current,
        }
      );
    }

    if (operation.type === 'delete') {
      this.deleteSnapshot(operation.entryId);
      this.insertHistory(changeSetId, operation.index, 'delete', operation.entryId, current, null, now);

      return {
        index: operation.index,
        type: 'delete',
        entryId: operation.entryId,
        noop: false,
        before: current,
        after: null,
      };
    }

    if (operation.noop) {
      this.insertHistory(changeSetId, operation.index, 'update', operation.entryId, current, current, now);
      return {
        index: operation.index,
        type: 'update',
        entryId: operation.entryId,
        noop: true,
        before: current,
        after: current,
      };
    }

    const after: KnowledgeEntrySnapshot = {
      ...operation.proposed!,
      version: current!.version + 1,
      created_at: current!.created_at,
      updated_at: now,
    };

    if (after.category !== current!.category || after.key_name !== current!.key_name) {
      const conflictingEntry = this.getEntryByCategoryKey(after.category, after.key_name);
      if (conflictingEntry && conflictingEntry.id !== operation.entryId) {
        throw new KnowledgeBaseChangeSetError(
          `Entry ${conflictingEntry.id} now occupies ${after.category}/${after.key_name}`,
          'STALE_PREVIEW',
          409,
          { conflictingEntryId: conflictingEntry.id, entryId: operation.entryId }
        );
      }
    }

    this.updateSnapshot(after);
    this.insertHistory(changeSetId, operation.index, 'update', operation.entryId, current, after, now);

    return {
      index: operation.index,
      type: 'update',
      entryId: operation.entryId,
      noop: false,
      before: current,
      after,
    };
  }

  private rollbackHistoryRow(historyRow: HistoryRow, now: string): KnowledgeChangeApplyOperationResult {
    const beforeState = historyRow.before_state ? (JSON.parse(historyRow.before_state) as KnowledgeEntrySnapshot) : null;
    const afterState = historyRow.after_state ? (JSON.parse(historyRow.after_state) as KnowledgeEntrySnapshot) : null;
    const liveCurrent = historyRow.entry_id ? this.getEntryById(historyRow.entry_id) : null;

    if (!this.snapshotsEqual(liveCurrent, afterState)) {
      throw new KnowledgeBaseChangeSetError(
        `Entry ${historyRow.entry_id} changed after apply; rollback aborted`,
        'STALE_ROLLBACK',
        409,
        {
          entryId: historyRow.entry_id,
          applyAfter: afterState,
          liveCurrent,
        }
      );
    }

    if (beforeState === null && afterState !== null) {
      this.deleteSnapshot(afterState.id);
    } else if (beforeState !== null && afterState === null) {
      this.insertSnapshot(beforeState);
    } else if (beforeState !== null) {
      this.updateSnapshot(beforeState);
    }

    this.insertHistory(
      historyRow.change_set_id,
      historyRow.operation_index,
      'rollback',
      historyRow.entry_id,
      afterState,
      beforeState,
      now
    );

    return {
      index: historyRow.operation_index,
      type: historyRow.operation_type as ChangeOperationType,
      entryId: historyRow.entry_id || beforeState?.id || afterState?.id || 'unknown',
      noop: false,
      before: afterState,
      after: beforeState,
    };
  }

  private insertSnapshot(snapshot: KnowledgeEntrySnapshot) {
    this.rawDb()
      .prepare(`
        INSERT INTO knowledge_base (
          id, category, key_name, value, description,
          is_active, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        snapshot.id,
        snapshot.category,
        snapshot.key_name,
        snapshot.value,
        snapshot.description,
        snapshot.is_active,
        snapshot.version,
        snapshot.created_at,
        snapshot.updated_at
      );
  }

  private updateSnapshot(snapshot: KnowledgeEntrySnapshot) {
    this.rawDb()
      .prepare(`
        UPDATE knowledge_base
        SET category = ?,
            key_name = ?,
            value = ?,
            description = ?,
            is_active = ?,
            version = ?,
            created_at = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        snapshot.category,
        snapshot.key_name,
        snapshot.value,
        snapshot.description,
        snapshot.is_active,
        snapshot.version,
        snapshot.created_at,
        snapshot.updated_at,
        snapshot.id
      );
  }

  private deleteSnapshot(entryId: string) {
    this.rawDb().prepare(`DELETE FROM knowledge_base WHERE id = ?`).run(entryId);
  }

  private insertHistory(
    changeSetId: string,
    operationIndex: number,
    operationType: 'create' | 'update' | 'delete' | 'rollback',
    entryId: string | null,
    beforeState: KnowledgeEntrySnapshot | null,
    afterState: KnowledgeEntrySnapshot | null,
    createdAt: string
  ) {
    this.rawDb()
      .prepare(`
        INSERT INTO knowledge_base_history (
          id, change_set_id, operation_index, operation_type,
          entry_id, before_state, after_state, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        randomUUID(),
        changeSetId,
        operationIndex,
        operationType,
        entryId,
        beforeState ? JSON.stringify(beforeState) : null,
        afterState ? JSON.stringify(afterState) : null,
        createdAt
      );
  }

  private parsePreviewPayload(payload: string) {
    return JSON.parse(payload) as {
      summary: KnowledgeChangeSetPreviewSummary;
      operations: KnowledgeChangePreviewOperation[];
    };
  }

  private getChangeSetRow(changeSetId: string): ChangeSetRow {
    const row = this.rawDb()
      .prepare(`SELECT * FROM knowledge_base_change_sets WHERE id = ?`)
      .get(changeSetId) as ChangeSetRow | undefined;

    if (!row) {
      throw new KnowledgeBaseChangeSetError(`Change set ${changeSetId} was not found`, 'CHANGE_SET_NOT_FOUND', 404);
    }

    return row;
  }

  private mapChangeSetRow(row: ChangeSetRow): KnowledgeChangeSetRecord {
    return {
      id: row.id,
      requestedBy: row.requested_by,
      reason: row.reason,
      summaryText: row.summary_text,
      status: row.status,
      preview: this.parsePreviewPayload(row.preview_payload),
      applyResult: row.apply_payload ? (JSON.parse(row.apply_payload) as KnowledgeChangeApplyResult) : null,
      rollbackResult: row.rollback_payload ? (JSON.parse(row.rollback_payload) as KnowledgeChangeRollbackResult) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      appliedAt: row.applied_at,
      rolledBackAt: row.rolled_back_at,
    };
  }

  private toSnapshot(entry: KnowledgeEntry): KnowledgeEntrySnapshot {
    return {
      id: entry.id,
      category: entry.category,
      key_name: entry.key_name,
      value: entry.value,
      description: entry.description,
      is_active: entry.is_active,
      version: entry.version,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
    };
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
