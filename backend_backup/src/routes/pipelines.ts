import { Router } from 'express';
import * as pipelines from '../controllers/pipelineController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  authorize('create_pipeline'),
  auditLog('pipeline_created', 'pipeline'),
  pipelines.createPipeline
);
router.get('/', pipelines.listPipelines);
router.get('/:id', pipelines.getPipeline);
router.put(
  '/:id',
  authorize('edit_pipeline'),
  auditLog('pipeline_modified', 'pipeline'),
  pipelines.updatePipeline
);
router.post(
  '/:id/validate',
  authorize('edit_pipeline'),
  pipelines.validatePipeline
);
router.post(
  '/:id/publish',
  authorize('edit_pipeline'),
  auditLog('pipeline_published', 'pipeline'),
  pipelines.publishPipeline
);
router.get('/:id/versions', pipelines.getPipelineVersions);
router.post(
  '/:id/rollback',
  authorize('edit_pipeline'),
  auditLog('pipeline_rollback', 'pipeline'),
  pipelines.rollbackPipeline
);
router.delete(
  '/:id',
  authorize('delete_pipeline'),
  auditLog('pipeline_deleted', 'pipeline'),
  pipelines.deletePipeline
);

export default router;
