import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

export function createIntegrationAIPromptsRoutes(db: Database.Database) {
  const router = Router();

// Get system message by prompt name (for n8n workflows)
// No authentication required - this is called by n8n workflows
router.get('/prompt/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const prompt = db.prepare(`
      SELECT system_message, workflow_type, version, updated_at 
      FROM ai_system_prompts 
      WHERE name = ? AND is_active = 1
    `).get(name);

    if (!prompt) {
      return res.status(404).json({ 
        error: 'Prompt not found or inactive',
        fallback: 'You are a helpful AI assistant.' 
      });
    }

    res.json({
      systemMessage: prompt.system_message,
      workflowType: prompt.workflow_type,
      version: prompt.version,
      updatedAt: prompt.updated_at
    });
  } catch (error) {
    console.error('Error fetching prompt for integration:', error);
    res.status(500).json({ 
      error: 'Failed to fetch prompt',
      fallback: 'You are a helpful AI assistant.'
    });
  }
});

// Get all active prompts for a workflow type
router.get('/prompts/:workflowType', async (req: Request, res: Response) => {
  try {
    const { workflowType } = req.params;
    
    const prompts = db.prepare(`
      SELECT id, name, description, workflow_type, version, updated_at
      FROM ai_system_prompts 
      WHERE workflow_type = ? AND is_active = 1
      ORDER BY name
    `).all(workflowType);

    res.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts for workflow type:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

  return router;
}
