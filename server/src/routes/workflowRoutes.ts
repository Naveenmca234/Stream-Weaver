import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';

const router = Router();
router.use(requireAuth);

// Get all workflows for the current user
router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const stmt = db.prepare(`SELECT id, name, created_at FROM workflows WHERE user_id = ? ORDER BY created_at DESC`);
    const workflows = stmt.all(userId);
    res.json({ workflows });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch workflows', error: String(error) });
  }
});

// Get a specific workflow's definition
router.get('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const stmt = db.prepare(`SELECT * FROM workflows WHERE id = ? AND user_id = ?`);
    const workflow = stmt.get(req.params.id, userId) as any;
    
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    
    res.json({ workflow: { ...workflow, definition: JSON.parse(workflow.definition) } });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch workflow', error: String(error) });
  }
});

// Create a new workflow template
router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { name, definition } = req.body;
    
    if (!name || !definition) {
      return res.status(400).json({ message: 'Name and definition are required' });
    }

    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const stmt = db.prepare(`
      INSERT INTO workflows (id, user_id, name, definition)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(workflowId, userId, name, JSON.stringify(definition));
    res.json({ message: 'Workflow saved successfully', id: workflowId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save workflow', error: String(error) });
  }
});

// Delete a workflow
router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const stmt = db.prepare(`DELETE FROM workflows WHERE id = ? AND user_id = ?`);
    const result = stmt.run(req.params.id, userId);
    
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Workflow not found or already deleted' });
    }
    
    res.json({ message: 'Workflow deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete workflow', error: String(error) });
  }
});

export default router;
