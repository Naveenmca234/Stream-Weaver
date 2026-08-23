import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string;
    if (!uploadId) return res.status(400).json({ message: 'uploadId is required' });

    const stmt = db.prepare(`SELECT * FROM validation_rules WHERE job_id = ?`);
    const rules = stmt.all(uploadId);
    
    res.json({ rules });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch validation rules', error: String(error) });
  }
});

router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId, field, ruleType, severity } = req.body;
    if (!uploadId || !field || !ruleType) {
      return res.status(400).json({ message: 'uploadId, field, and ruleType are required' });
    }

    const ruleId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const stmt = db.prepare(`
      INSERT INTO validation_rules (id, job_id, field, rule_type, severity)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(ruleId, uploadId, field, ruleType, severity || 'ERROR');

    res.json({ message: 'Validation rule added', ruleId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add validation rule', error: String(error) });
  }
});

router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const ruleId = req.params.id;
    const stmt = db.prepare(`DELETE FROM validation_rules WHERE id = ?`);
    stmt.run(ruleId);
    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete validation rule', error: String(error) });
  }
});

export default router;
