import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';
import { generateDataProfile } from '../services/profileService';
import { ArtifactStore } from '../storage/filesystem/artifactStore';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { jobManager } from '../workers/jobManager';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

router.get('/', (req: AuthedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const stmt = db.prepare(`SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`);
    const jobs = stmt.all(userId, limit, offset);
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Could not load job history', error: String(error) });
  }
});

router.get('/:jobId', (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const stmt = db.prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`);
    const job = stmt.get(jobId, req.user?.id);
    
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not load job', error: String(error) });
  }
});

router.get('/:jobId/mappings', (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const stmt = db.prepare(`SELECT * FROM mappings WHERE job_id = ?`);
    const mappings = stmt.all(jobId);
    res.json({ mappings });
  } catch (error) {
    res.status(500).json({ message: 'Could not load mappings', error: String(error) });
  }
});

router.post('/:jobId/mappings', (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    
    const mappingSchema = z.array(z.object({
      sourceField: z.string().min(1),
      targetField: z.string().min(1),
      transformRule: z.any().optional()
    }));

    const parseResult = mappingSchema.safeParse(req.body.mappings);
    if (!parseResult.success) {
      return res.status(400).json({ message: 'Invalid mappings payload', errors: parseResult.error.errors });
    }
    const mappings = parseResult.data;

    // Clear old mappings
    db.prepare(`DELETE FROM mappings WHERE job_id = ?`).run(jobId);

    const stmt = db.prepare(`
      INSERT INTO mappings (id, job_id, source_field, target_field, transform_rule)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insert = db.transaction((maps: any[]) => {
      for (const map of maps) {
         stmt.run(
           `${jobId}-${map.targetField}`, 
           jobId, 
           map.sourceField, 
           map.targetField, 
           map.transformRule ? JSON.stringify(map.transformRule) : null
         );
      }
    });

    insert(mappings);

    // Update job status
    db.prepare(`UPDATE jobs SET status = 'mapped' WHERE id = ?`).run(jobId);

    res.json({ message: 'Mappings saved' });
  } catch (error) {
    res.status(500).json({ message: 'Could not save mappings', error: String(error) });
  }
});

router.delete('/:jobId', async (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const stmt = db.prepare(`SELECT * FROM jobs WHERE id = ? AND user_id = ?`);
    const job = stmt.get(jobId, req.user?.id);
    
    if (!job && req.user?.role !== 'admin') {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Delete from SQLite (cascades to mappings, rules, events)
    db.prepare(`DELETE FROM jobs WHERE id = ?`).run(jobId);

    // Delete artifacts from disk
    await ArtifactStore.cleanupJob(jobId);

    res.json({ message: 'Job and related data deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete job', error: String(error) });
  }
});

router.post('/:jobId/run', (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    jobManager.startJob(jobId);
    res.json({ message: 'Job execution started' });
  } catch (error) {
    res.status(500).json({ message: 'Could not start job', error: String(error) });
  }
});

router.post('/:jobId/cancel', (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const cancelled = jobManager.cancelJob(jobId);
    if (cancelled) {
      db.prepare(`UPDATE jobs SET status = 'cancelled' WHERE id = ?`).run(jobId);
      res.json({ message: 'Job execution cancelled' });
    } else {
      res.status(404).json({ message: 'Job is not running' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Could not cancel job', error: String(error) });
  }
});

router.get('/:jobId/preview', async (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const type = req.query.type === 'source' ? 'source' : 'processed';
    
    // First figure out the original file extension if we want source
    let targetPath = '';
    if (type === 'source') {
      const stmt = db.prepare(`SELECT original_filename FROM jobs WHERE id = ?`);
      const job = stmt.get(jobId) as any;
      if (!job) return res.status(404).json({ message: 'Job not found' });
      const extension = path.extname(job.original_filename).toLowerCase();
      targetPath = ArtifactStore.getUploadPath(jobId, `source${extension}`);
    } else {
      targetPath = ArtifactStore.getOutputPath(jobId, 'processed.csv');
    }

    try {
      await fs.access(targetPath);
    } catch {
      return res.json({ rows: [], columns: [] }); // File doesn't exist yet
    }

    const records: any[] = [];
    const columns = new Set<string>();
    
    if (targetPath.endsWith('.csv')) {
      const { parse } = require('csv-parse');
      const { createReadStream } = require('node:fs');
      const parser = parse({ columns: true, skip_empty_lines: true, to_line: 50 });
      const readStream = createReadStream(targetPath);
      
      try {
        for await (const record of readStream.pipe(parser)) {
          records.push(record);
          Object.keys(record).forEach(k => columns.add(k));
        }
      } catch (err) {
        console.error('Preview stream error:', err);
      }
    } else if (targetPath.endsWith('.json')) {
      const { streamArray } = require('stream-json/streamers/StreamArray');
      const { createReadStream } = require('node:fs');
      const parser = streamArray();
      const readStream = createReadStream(targetPath);
      
      try {
        for await (const { value } of readStream.pipe(parser)) {
          if (records.length >= 50) {
            readStream.destroy();
            break;
          }
          records.push(value);
          if (typeof value === 'object' && value !== null) {
            Object.keys(value).forEach(k => columns.add(k));
          }
        }
      } catch (err) {
        console.error('Preview stream error:', err);
      }
    } else if (targetPath.endsWith('.xls') || targetPath.endsWith('.xlsx')) {
      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(targetPath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      rows.slice(0, 50).forEach((record: any) => {
        records.push(record);
        Object.keys(record).forEach(k => columns.add(k));
      });
    }

    res.json({ rows: records, columns: Array.from(columns) });
  } catch (error) {
    res.status(500).json({ message: 'Could not load preview', error: String(error) });
  }
});

router.get('/:id/profile', async (req: AuthedRequest, res: Response) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
    if (!job) return res.status(404).json({ message: 'Job not found' });
    
    // Safety check: ensure user owns the job or is anonymous (if no auth)
    if (job.user_id && req.user?.id && job.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const uploadPath = path.join(__dirname, '../../storage/uploads', `${req.params.id}.csv`);
    if (!(await fs.stat(uploadPath).catch(() => false))) {
      return res.status(404).json({ message: 'Original file no longer exists for profiling.' });
    }

    const profile = await generateDataProfile(uploadPath, 50000);
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate profile', error: String(error) });
  }
});

router.get('/:jobId/download', async (req: AuthedRequest, res: Response) => {
  try {
    const jobId = req.params.jobId as string;
    const type = req.query.type as string; // 'processed' or 'failed'
    
    let targetPath = '';
    let fileName = '';
    
    if (type === 'failed') {
      targetPath = ArtifactStore.getFailedPath(jobId);
      fileName = 'failed_rows.csv';
    } else {
      targetPath = ArtifactStore.getOutputPath(jobId, 'processed.csv');
      fileName = 'processed.csv';
    }

    try {
      await fs.access(targetPath);
    } catch {
      return res.status(404).json({ message: 'Artifact not found or has not been generated yet.' });
    }

    res.download(targetPath, fileName);
  } catch (error) {
    res.status(500).json({ message: 'Could not download file', error: String(error) });
  }
});

export default router;
