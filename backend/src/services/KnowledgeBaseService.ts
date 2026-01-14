import { randomUUID } from 'crypto';
import type { DatabaseService } from '../database/DatabaseService.js';

/**
 * Knowledge Base Entry interface
 * Requirements: 3.2, 3.3, 3.4, 3.5
 */
export interface KnowledgeEntry {
  id: string;
  category: 'services' | 'pricing' | 'hours' | 'policies' | 'contact' | 'general' | 'faq';
  key_name: string;
  value: string;
  description: string | null;
  is_active: number;
  version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a knowledge entry
 */
export interface KnowledgeEntryInput {
  category: 'services' | 'pricing' | 'hours' | 'policies' | 'contact' | 'general' | 'faq';
  key_name: string;
  value: string;
  description?: string;
  is_active?: boolean;
}

/**
 * Knowledge Base Service
 * Manages dynamic business information for AI workflows
 * Requirements: 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3
 */
export class KnowledgeBaseService {
  constructor(private db: DatabaseService) {}

  /**
   * Get all knowledge entries
   * Requirements: 3.1
   */
  getAll(): KnowledgeEntry[] {
    const query = `
      SELECT * FROM knowledge_base 
      ORDER BY category, key_name
    `;
    return this.db['db'].prepare(query).all() as KnowledgeEntry[];
  }

  /**
   * Get knowledge entries by category
   * Requirements: 4.1, 4.3
   */
  getByCategory(category: string): KnowledgeEntry[] {
    const query = `
      SELECT * FROM knowledge_base 
      WHERE category = ?
      ORDER BY key_name
    `;
    return this.db['db'].prepare(query).all(category) as KnowledgeEntry[];
  }

  /**
   * Get a single knowledge entry by ID
   * Requirements: 3.2
   */
  getById(id: string): KnowledgeEntry | null {
    const query = 'SELECT * FROM knowledge_base WHERE id = ?';
    const result = this.db['db'].prepare(query).get(id) as KnowledgeEntry | undefined;
    return result || null;
  }

  /**
   * Create a new knowledge entry
   * Requirements: 3.2
   */
  create(entry: KnowledgeEntryInput): KnowledgeEntry {
    const id = randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO knowledge_base (
        id, category, key_name, value, description, 
        is_active, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `;

    this.db['db'].prepare(query).run(
      id,
      entry.category,
      entry.key_name,
      entry.value,
      entry.description || null,
      entry.is_active !== undefined ? (entry.is_active ? 1 : 0) : 1,
      now,
      now
    );

    return this.getById(id)!;
  }

  /**
   * Update a knowledge entry
   * Increments version number on update
   * Requirements: 3.3
   */
  update(id: string, updates: Partial<KnowledgeEntryInput>): KnowledgeEntry {
    const now = new Date().toISOString();
    const updateFields: string[] = [];
    const values: any[] = [];

    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      values.push(updates.category);
    }
    if (updates.key_name !== undefined) {
      updateFields.push('key_name = ?');
      values.push(updates.key_name);
    }
    if (updates.value !== undefined) {
      updateFields.push('value = ?');
      values.push(updates.value);
    }
    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.is_active !== undefined) {
      updateFields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }

    // Always increment version and update timestamp
    updateFields.push('version = version + 1');
    updateFields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const query = `
      UPDATE knowledge_base 
      SET ${updateFields.join(', ')} 
      WHERE id = ?
    `;

    this.db['db'].prepare(query).run(...values);

    return this.getById(id)!;
  }

  /**
   * Delete a knowledge entry
   * Requirements: 3.4
   */
  delete(id: string): boolean {
    const query = 'DELETE FROM knowledge_base WHERE id = ?';
    const result = this.db['db'].prepare(query).run(id);
    return result.changes > 0;
  }

  /**
   * Get knowledge context for n8n workflows
   * Returns active entries grouped by category
   * Requirements: 7.1, 7.2, 7.3
   */
  getContext(): Record<string, Record<string, string>> {
    const query = `
      SELECT category, key_name, value 
      FROM knowledge_base 
      WHERE is_active = 1
      ORDER BY category, key_name
    `;

    const entries = this.db['db'].prepare(query).all() as Array<{
      category: string;
      key_name: string;
      value: string;
    }>;

    // Group by category
    const context: Record<string, Record<string, string>> = {};

    for (const entry of entries) {
      if (!context[entry.category]) {
        context[entry.category] = {};
      }
      context[entry.category][entry.key_name] = entry.value;
    }

    return context;
  }
}
