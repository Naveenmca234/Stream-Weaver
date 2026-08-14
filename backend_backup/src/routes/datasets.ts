import { Router } from 'express';
import * as datasets from '../controllers/datasetController';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.post(
  '/upload',
  authorize('upload_datasets'),
  auditLog('dataset_uploaded', 'dataset'),
  datasets.uploadDataset
);
router.get('/', authorize('view_datasets'), datasets.listDatasets);
router.get('/:id', authorize('view_datasets'), datasets.getDataset);
router.get('/:id/schema', authorize('view_datasets'), datasets.getDatasetSchema);
router.patch(
  '/:id/schema',
  authorize('upload_datasets'),
  datasets.updateDatasetSchema
);
router.get('/:id/preview', authorize('view_datasets'), datasets.getDatasetPreview);
router.delete(
  '/:id',
  authorize('delete_pipeline'),
  auditLog('dataset_deleted', 'dataset'),
  datasets.deleteDataset
);

export default router;
