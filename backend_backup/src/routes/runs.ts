import { Router } from 'express';
import * as runs from '../controllers/runController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('execute_pipeline'),
  auditLog('pipeline_executed', 'run'),
  runs.createRun
);
router.get('/', runs.listRuns);
router.get('/:id', runs.getRun);
router.post(
  '/:id/cancel',
  authorize('execute_pipeline'),
  auditLog('pipeline_cancelled', 'run'),
  runs.cancelRun
);
router.get('/:id/errors', runs.getRunErrors);

export default router;
