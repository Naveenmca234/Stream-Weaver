import { Router } from 'express';

import {
  getCsvPreview,
  getFileUploadConfig,
  previewMappedRows,
  uploadCsvFile,
} from '../controllers/fileController.js';

import {
  validateUploadId,
} from '../middleware/validateUploadId.js';

const router = Router();

router.get(
  '/config',
  getFileUploadConfig,
);

router.post(
  '/upload',
  uploadCsvFile,
);

router.get(
  '/:uploadId/preview',
  validateUploadId,
  getCsvPreview,
);

router.post(
  '/:uploadId/mapping/preview',
  validateUploadId,
  previewMappedRows,
);

export default router;
