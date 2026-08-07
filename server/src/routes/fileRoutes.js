 import { Router } from 'express';

import {
  getCsvPreview,
  getFileUploadConfig,
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

export default router;