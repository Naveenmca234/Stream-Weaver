import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string;
    if (!uploadId) return res.status(400).json({ message: 'uploadId is required' });

    const stmt = db.prepare(`SELECT * FROM transformation_rules WHERE job_id = ? AND rule_type = 'transform'`);
    const rules = stmt.all(uploadId);
    
    res.json({ rules: rules.map((r: any) => ({ ...r, config: JSON.parse(r.config) })) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch transformation rules', error: String(error) });
  }
});

router.post('/', (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId, field, operation, parameters, customCode } = req.body;
    if (!uploadId || !field || !operation) {
      return res.status(400).json({ message: 'uploadId, field, and operation are required' });
    }

    const ruleId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const config = JSON.stringify({ field, operation, parameters, customCode });

    const stmt = db.prepare(`
      INSERT INTO transformation_rules (id, job_id, rule_type, config)
      VALUES (?, ?, 'transform', ?)
    `);
    
    stmt.run(ruleId, uploadId, config);

    res.json({ message: 'Transformation rule added', ruleId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to add transformation rule', error: String(error) });
  }
});

router.delete('/:id', (req: AuthedRequest, res: Response) => {
  try {
    const ruleId = req.params.id;
    const stmt = db.prepare(`DELETE FROM transformation_rules WHERE id = ? AND rule_type = 'transform'`);
    stmt.run(ruleId);
    res.json({ message: 'Rule deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete transformation rule', error: String(error) });
  }
});

export default router;
