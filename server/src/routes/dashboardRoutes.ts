import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';

const router = Router();
router.use(requireAuth);

router.get('/metrics', (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    // Aggregate overall metrics from jobs
    const jobsStmt = db.prepare(`
      SELECT 
        COUNT(*) as totalJobs,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedJobs,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as runningJobs,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedJobs,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelledJobs,
        SUM(row_count) as totalRows,
        SUM(failed_rows) as totalFailedRows,
        SUM(file_size) as totalDataProcessed
      FROM jobs 
      WHERE user_id = ?
    `);

    const metrics = jobsStmt.get(userId) as any;

    const summary = {
      totalJobs: metrics.totalJobs || 0,
      completedJobs: metrics.completedJobs || 0,
      runningJobs: metrics.runningJobs || 0,
      failedJobs: metrics.failedJobs || 0,
      cancelledJobs: metrics.cancelledJobs || 0,
      totalRows: metrics.totalRows || 0,
      totalFailedRows: metrics.totalFailedRows || 0,
      totalDataProcessed: metrics.totalDataProcessed || 0
    };

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ message: 'Could not load dashboard metrics', error: String(error) });
  }
});

export default router;
