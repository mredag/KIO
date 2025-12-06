import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Database from 'better-sqlite3';

export function createAIPromptsRoutes(db: Database.Database) {
  const router = Router();

// Get all AI prompts
router.get('/', async (req: Request, res: Response) => {
  try {
    const prompts = db.prepare(`
      SELECT * FROM ai_system_prompts 
      ORDER BY workflow_type, name
    `).all();

    res.json(prompts);
  } catch (error) {
    console.error('Error fetching AI prompts:', error);
    res.status(500).json({ error: 'Failed to fetch AI prompts' });
  }
});

// Get active prompts by workflow type
router.get('/active/:workflowType', async (req: Request, res: Response) => {
  try {
    const { workflowType } = req.params;
    
    const prompts = db.prepare(`
      SELECT * FROM ai_system_prompts 
      WHERE workflow_type = ? AND is_active = 1
      ORDER BY name
    `).all(workflowType);

    res.json(prompts);
  } catch (error) {
    console.error('Error fetching active prompts:', error);
    res.status(500).json({ error: 'Failed to fetch active prompts' });
  }
});

// Get single prompt by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const prompt = db.prepare(`
      SELECT * FROM ai_system_prompts WHERE id = ?
    `).get(id);

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    res.json(prompt);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// Get prompt by name (for n8n workflows)
router.get('/by-name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const prompt = db.prepare(`
      SELECT system_message FROM ai_system_prompts 
      WHERE name = ? AND is_active = 1
    `).get(name);

    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found or inactive' });
    }

    res.json(prompt);
  } catch (error) {
    console.error('Error fetching prompt by name:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// Create new AI prompt
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, system_message, workflow_type, is_active } = req.body;

    if (!name || !system_message) {
      return res.status(400).json({ error: 'Name and system_message are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO ai_system_prompts (
        id, name, description, system_message, workflow_type, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      description || null,
      system_message,
      workflow_type || 'general',
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      now,
      now
    );

    const newPrompt = db.prepare('SELECT * FROM ai_system_prompts WHERE id = ?').get(id);
    res.status(201).json(newPrompt);
  } catch (error: any) {
    console.error('Error creating AI prompt:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Prompt name already exists' });
    }
    res.status(500).json({ error: 'Failed to create AI prompt' });
  }
});

// Update AI prompt
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, system_message, workflow_type, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM ai_system_prompts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE ai_system_prompts 
      SET 
        name = ?,
        description = ?,
        system_message = ?,
        workflow_type = ?,
        is_active = ?,
        version = version + 1,
        updated_at = ?
      WHERE id = ?
    `).run(
      name || existing.name,
      description !== undefined ? description : existing.description,
      system_message || existing.system_message,
      workflow_type || existing.workflow_type,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM ai_system_prompts WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating AI prompt:', error);
    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Prompt name already exists' });
    }
    res.status(500).json({ error: 'Failed to update AI prompt' });
  }
});

// Delete AI prompt
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM ai_system_prompts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    db.prepare('DELETE FROM ai_system_prompts WHERE id = ?').run(id);
    res.json({ message: 'Prompt deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI prompt:', error);
    res.status(500).json({ error: 'Failed to delete AI prompt' });
  }
});

  return router;
}
