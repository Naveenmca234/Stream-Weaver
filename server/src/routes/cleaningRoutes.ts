import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string;
    if (!uploadId) return res.status(400).json({ message: 'uploadId is required' });

    const stmt = db.prepare(`SELECT * FROM transformation_rules WHERE job_id = ? AND rule_type = 'cleaning'`);
    const rules = stmt.all(uploadId);
    
    res.json({ rules: rules.map((r: any) => ({ ...r, config: JSON.parse(r.config) })) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch cleaning rules', error: String(error) });
  }
});

router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId, column, operation, parameters } = req.body;
    if (!uploadId || !column || !operation) {
      return res.status(400).json({ message: 'uploadId, column, and operation are required' });
    }

    const ruleId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const config = JSON.stringify({ column, operation, parameters });

    const stmt = db.prepare(`
      INSERT INTO transformation_rules (id, job_id, rule_type, config)
      VALUES (?, ?, 'cleaning', ?)
    `);
    
    stmt.run(ruleId, uploadId, config);

    res.json({ message: 'Cleaning rule added', ruleId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add cleaning rule', error: String(error) });
  }
});

router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const ruleId = req.params.id;
    const stmt = db.prepare(`DELETE FROM transformation_rules WHERE id = ? AND rule_type = 'cleaning'`);
    stmt.run(ruleId);
    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete cleaning rule', error: String(error) });
  }
});

export default router;
