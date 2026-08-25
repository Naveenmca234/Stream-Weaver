import { Router, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { parse } from 'csv-parse';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';
import { ArtifactStore } from '../storage/filesystem/artifactStore';
import * as XLSX from 'xlsx';

const router = Router();
const upload = multer({ dest: 'uploads/' });

const SUPPORTED_UPLOAD_EXTENSIONS = new Set(['.csv', '.json', '.xls', '.xlsx', '.xlsm']);

const isSupportedUploadFile = (fileName: string) => {
  const extension = path.extname(fileName).toLowerCase();
  return SUPPORTED_UPLOAD_EXTENSIONS.has(extension);
};

router.post('/finalize', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { tusFileId, fileName, clientUploadId } = req.body;
  if (!tusFileId || !fileName) return res.status(400).json({ message: 'Missing file details' });

  const io = req.app.get('io');
  const tempFilePath = path.resolve(__dirname, `../../../storage/uploads/${tusFileId}`);
  const extension = path.extname(fileName).toLowerCase();
  let fileSize = 0;
  try {
    const stat = await fs.promises.stat(tempFilePath);
    fileSize = stat.size;
  } catch {
    return res.status(404).json({ message: 'Tus file not found' });
  }

  const userId = req.user?.id || 'anonymous';

  if (!isSupportedUploadFile(fileName)) {
    fs.unlinkSync(tempFilePath);
    return res.status(400).json({ message: 'Unsupported file type.' });
  }

  const jobId = (typeof clientUploadId === 'string' && clientUploadId.trim())
    || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Create job in SQLite
  const stmtInsert = db.prepare(`
    INSERT INTO jobs (id, user_id, status, original_filename, file_size) 
    VALUES (?, ?, ?, ?, ?)
  `);
  stmtInsert.run(jobId, userId, 'uploading', fileName, fileSize);

  const finalUploadPath = ArtifactStore.getUploadPath(jobId, `source${extension}`);

  try {
    // 1. Move temp file to artifact store
    await fs.promises.rename(tempFilePath, finalUploadPath);
    // Remove the .info file left by Tus
    await fs.promises.unlink(`${tempFilePath}.info`).catch(() => {});

    // 2. Stream to count rows and extract preview
    let totalRows = 0;
    const preview: any[] = [];
    const columns = new Set<string>();

    if (extension === '.csv') {
      const parser = parse({ columns: true, skip_empty_lines: true });
      const readStream = createReadStream(finalUploadPath);
      
      for await (const record of readStream.pipe(parser)) {
        totalRows++;
        if (preview.length < 100) preview.push(record);
        if (totalRows <= 100) {
          Object.keys(record).forEach(k => columns.add(k));
        }
      }
    } else if (extension === '.json') {
       const readStream = createReadStream(finalUploadPath);
       const parser = streamArray();
       
       try {
         for await (const { value } of readStream.pipe(parser)) {
           totalRows++;
           if (preview.length < 100) preview.push(value);
           if (totalRows <= 100 && typeof value === 'object' && value !== null) {
             Object.keys(value).forEach(k => columns.add(k));
           }
         }
       } catch (err) {
         console.warn('JSON stream parsing failed. File must be a valid JSON array.', err);
         throw new Error('Invalid JSON format. Please upload a valid JSON array.');
       }
    } else if (['.xls', '.xlsx'].includes(extension)) {
       const workbook = XLSX.readFile(finalUploadPath);
       const sheet = workbook.Sheets[workbook.SheetNames[0]];
       const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
       totalRows = rows.length;
       rows.slice(0, 100).forEach((record: any) => {
         preview.push(record);
         Object.keys(record).forEach(k => columns.add(k));
       });
    }

    // Update job status in SQLite
    const stmtUpdate = db.prepare(`
      UPDATE jobs 
      SET status = 'uploaded', row_count = ?
      WHERE id = ?
    `);
    stmtUpdate.run(totalRows, jobId);

    // Initial mapping entries based on columns
    const stmtMapping = db.prepare(`
      INSERT INTO mappings (id, job_id, source_field, target_field)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertMappings = db.transaction((cols: string[]) => {
      for (const col of cols) {
        stmtMapping.run(`${jobId}-${col}`, jobId, col, col); // Default 1:1 map
      }
    });
    insertMappings(Array.from(columns));

    if (io) {
      io.to(jobId).emit('import-progress', { 
        uploadId: jobId, progress: 100, stage: 'upload_complete', rowsProcessed: totalRows 
      });
    }

    res.json({
      message: 'Upload successful',
      jobId,
      fileName,
      totalRows,
      columns: Array.from(columns),
      preview
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    db.prepare(`UPDATE jobs SET status = 'failed' WHERE id = ?`).run(jobId);
    try {
      await fs.promises.unlink(finalUploadPath);
    } catch (cleanupError) {}
    res.status(500).json({ message: 'Upload processing failed', error: error instanceof Error ? error.message : String(error) });
  }
});

router.post('/', requireAuth, upload.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const io = req.app.get('io');
  const tempFilePath = path.resolve(req.file.path);
  const extension = path.extname(req.file.originalname).toLowerCase();
  const fileName = req.file.originalname;
  const fileSize = req.file.size;
  const userId = req.user?.id || 'anonymous';

  if (!isSupportedUploadFile(fileName)) {
    fs.unlinkSync(tempFilePath);
    return res.status(400).json({ message: 'Unsupported file type.' });
  }

  const jobId = (typeof req.body.clientUploadId === 'string' && req.body.clientUploadId.trim())
    || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Create job in SQLite
  const stmtInsert = db.prepare(`
    INSERT INTO jobs (id, user_id, status, original_filename, file_size) 
    VALUES (?, ?, ?, ?, ?)
  `);
  stmtInsert.run(jobId, userId, 'uploading', fileName, fileSize);

  const finalUploadPath = ArtifactStore.getUploadPath(jobId, `source${extension}`);

  try {
    // 1. Move temp file to artifact store
    await fs.promises.rename(tempFilePath, finalUploadPath);

    // 2. Stream to count rows and extract preview
    let totalRows = 0;
    const preview: any[] = [];
    const columns = new Set<string>();

    if (extension === '.csv') {
      const parser = parse({ columns: true, skip_empty_lines: true });
      const readStream = createReadStream(finalUploadPath);
      
      for await (const record of readStream.pipe(parser)) {
        totalRows++;
        if (preview.length < 100) preview.push(record);
        if (totalRows <= 100) {
          Object.keys(record).forEach(k => columns.add(k));
        }
      }
    } else if (extension === '.json') {
       // Simple fallback for JSON (assuming streamable JSON array for now)
       const readStream = createReadStream(finalUploadPath);
       const parser = streamArray();
       
       try {
         for await (const { value } of readStream.pipe(parser)) {
           totalRows++;
           if (preview.length < 100) preview.push(value);
           if (totalRows <= 100 && typeof value === 'object' && value !== null) {
             Object.keys(value).forEach(k => columns.add(k));
           }
         }
       } catch (err) {
         console.warn('JSON stream parsing failed. File must be a valid JSON array.', err);
         throw new Error('Invalid JSON format. Please upload a valid JSON array.');
       }
    } else if (['.xls', '.xlsx'].includes(extension)) {
       const workbook = XLSX.readFile(finalUploadPath);
       const sheet = workbook.Sheets[workbook.SheetNames[0]];
       const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
       totalRows = rows.length;
       rows.slice(0, 100).forEach((record: any) => {
         preview.push(record);
         Object.keys(record).forEach(k => columns.add(k));
       });
    }

    // Update job status in SQLite
    const stmtUpdate = db.prepare(`
      UPDATE jobs 
      SET status = 'uploaded', row_count = ?
      WHERE id = ?
    `);
    stmtUpdate.run(totalRows, jobId);

    // Initial mapping entries based on columns
    const stmtMapping = db.prepare(`
      INSERT INTO mappings (id, job_id, source_field, target_field)
      VALUES (?, ?, ?, ?)
    `);
    
    const insertMappings = db.transaction((cols: string[]) => {
      for (const col of cols) {
        stmtMapping.run(`${jobId}-${col}`, jobId, col, col); // Default 1:1 map
      }
    });
    insertMappings(Array.from(columns));

    if (io) {
      io.to(jobId).emit('import-progress', { 
        uploadId: jobId, progress: 100, stage: 'upload_complete', rowsProcessed: totalRows 
      });
    }

    res.json({
      message: 'Upload successful',
      jobId,
      fileName,
      totalRows,
      columns: Array.from(columns),
      preview
    });

  } catch (error) {
    console.error('Upload processing error:', error);
    db.prepare(`UPDATE jobs SET status = 'failed' WHERE id = ?`).run(jobId);
    try {
      await fs.promises.unlink(finalUploadPath);
    } catch (cleanupError) {
      // Ignore if file doesn't exist or already removed
    }
    res.status(500).json({ message: 'Upload processing failed', error: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
