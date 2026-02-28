/**
 * Tags & Custom Fields API Routes.
 * Factory pattern: createTagsRoutes(db)
 */
import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

let _db: Database.Database;

export function createTagsRoutes(db: Database.Database): Router {
  _db = db;
  const router = Router();

  // Ensure tables exist
  _db.exec(`
    CREATE TABLE IF NOT EXISTS mc_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS mc_tag_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_id INTEGER NOT NULL REFERENCES mc_tags(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('job','agent','conversation','board')),
      entity_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tag_id, entity_type, entity_id)
    );
    CREATE TABLE IF NOT EXISTS mc_custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      field_type TEXT NOT NULL CHECK(field_type IN ('text','number','date','select','boolean')),
      entity_type TEXT NOT NULL CHECK(entity_type IN ('job','agent')),
      options TEXT,
      required INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS mc_custom_field_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_id INTEGER NOT NULL REFERENCES mc_custom_fields(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(field_id, entity_id)
    );
  `);

  // ===== TAGS =====

  // GET /tags — List all tags
  router.get('/tags', (_req: Request, res: Response) => {
    try {
      const tags = _db.prepare('SELECT * FROM mc_tags ORDER BY name').all();
      res.json(tags);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /tags — Create tag
  router.post('/tags', (req: Request, res: Response) => {
    try {
      const { name, color, description } = req.body;
      if (!name) return res.status(400).json({ error: 'name required' });
      const result = _db.prepare('INSERT INTO mc_tags (name, color, description) VALUES (?, ?, ?)')
        .run(name, color || '#6b7280', description || null);
      res.status(201).json(_db.prepare('SELECT * FROM mc_tags WHERE id = ?').get(result.lastInsertRowid));
    } catch (err: any) {
      if (err.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Tag already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /tags/:id — Update tag
  router.patch('/tags/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, color, description } = req.body;
      const existing = _db.prepare('SELECT * FROM mc_tags WHERE id = ?').get(id);
      if (!existing) return res.status(404).json({ error: 'Tag not found' });
      _db.prepare('UPDATE mc_tags SET name = COALESCE(?, name), color = COALESCE(?, color), description = COALESCE(?, description) WHERE id = ?')
        .run(name || null, color || null, description !== undefined ? description : null, id);
      res.json(_db.prepare('SELECT * FROM mc_tags WHERE id = ?').get(id));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /tags/:id — Delete tag
  router.delete('/tags/:id', (req: Request, res: Response) => {
    try {
      _db.prepare('DELETE FROM mc_tags WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /tags/:id/assign — Assign tag to entity
  router.post('/tags/:id/assign', (req: Request, res: Response) => {
    try {
      const { entity_type, entity_id } = req.body;
      if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required' });
      _db.prepare('INSERT OR IGNORE INTO mc_tag_assignments (tag_id, entity_type, entity_id) VALUES (?, ?, ?)')
        .run(req.params.id, entity_type, entity_id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /tags/:id/assign — Remove tag assignment
  router.delete('/tags/:id/assign', (req: Request, res: Response) => {
    try {
      const { entity_type, entity_id } = req.body;
      _db.prepare('DELETE FROM mc_tag_assignments WHERE tag_id = ? AND entity_type = ? AND entity_id = ?')
        .run(req.params.id, entity_type, entity_id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /tags/entity/:type/:id — Get tags for entity
  router.get('/tags/entity/:type/:id', (req: Request, res: Response) => {
    try {
      const tags = _db.prepare(`
        SELECT t.* FROM mc_tags t
        JOIN mc_tag_assignments ta ON ta.tag_id = t.id
        WHERE ta.entity_type = ? AND ta.entity_id = ?
        ORDER BY t.name
      `).all(req.params.type, req.params.id);
      res.json(tags);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ===== CUSTOM FIELDS =====

  // GET /custom-fields — List field definitions
  router.get('/custom-fields', (req: Request, res: Response) => {
    try {
      const entityType = req.query.entity_type as string;
      const where = entityType ? 'WHERE entity_type = ?' : '';
      const params = entityType ? [entityType] : [];
      const fields = _db.prepare(`SELECT * FROM mc_custom_fields ${where} ORDER BY name`).all(...params);
      res.json(fields);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // POST /custom-fields — Create field definition
  router.post('/custom-fields', (req: Request, res: Response) => {
    try {
      const { name, field_type, entity_type, options, required } = req.body;
      if (!name || !field_type || !entity_type) return res.status(400).json({ error: 'name, field_type, entity_type required' });
      const result = _db.prepare('INSERT INTO mc_custom_fields (name, field_type, entity_type, options, required) VALUES (?, ?, ?, ?, ?)')
        .run(name, field_type, entity_type, options ? JSON.stringify(options) : null, required ? 1 : 0);
      res.status(201).json(_db.prepare('SELECT * FROM mc_custom_fields WHERE id = ?').get(result.lastInsertRowid));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PATCH /custom-fields/:id — Update field definition
  router.patch('/custom-fields/:id', (req: Request, res: Response) => {
    try {
      const { name, options, required } = req.body;
      _db.prepare('UPDATE mc_custom_fields SET name = COALESCE(?, name), options = COALESCE(?, options), required = COALESCE(?, required) WHERE id = ?')
        .run(name || null, req.body.options !== undefined ? JSON.stringify(req.body.options) : null, required !== undefined ? (required ? 1 : 0) : null, req.params.id);
      res.json(_db.prepare('SELECT * FROM mc_custom_fields WHERE id = ?').get(req.params.id));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // DELETE /custom-fields/:id — Delete field definition
  router.delete('/custom-fields/:id', (req: Request, res: Response) => {
    try {
      _db.prepare('DELETE FROM mc_custom_fields WHERE id = ?').run(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // GET /custom-fields/values/:entityType/:entityId — Get values for entity
  router.get('/custom-fields/values/:entityType/:entityId', (req: Request, res: Response) => {
    try {
      const values = _db.prepare(`
        SELECT cf.*, cfv.value, cfv.id as value_id
        FROM mc_custom_fields cf
        LEFT JOIN mc_custom_field_values cfv ON cfv.field_id = cf.id AND cfv.entity_id = ?
        WHERE cf.entity_type = ?
        ORDER BY cf.name
      `).all(req.params.entityId, req.params.entityType);
      res.json(values);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // PUT /custom-fields/values/:fieldId/:entityId — Set value
  router.put('/custom-fields/values/:fieldId/:entityId', (req: Request, res: Response) => {
    try {
      const { value } = req.body;
      _db.prepare(`
        INSERT INTO mc_custom_field_values (field_id, entity_id, value)
        VALUES (?, ?, ?)
        ON CONFLICT(field_id, entity_id) DO UPDATE SET value = excluded.value
      `).run(req.params.fieldId, req.params.entityId, value);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  return router;
}
