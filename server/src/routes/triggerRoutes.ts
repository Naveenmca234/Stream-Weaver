import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db } from '../storage/sqlite/database';
import { ArtifactStore } from '../storage/filesystem/artifactStore';
import { jobManager } from '../workers/jobManager';
import path from 'node:path';
import fs from 'node:fs';

const router = Router();
const upload = multer({ dest: path.join(__dirname, '../../storage/uploads/') });

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const templateId = req.body.templateId;
    const file = req.file;

    // Optional API Key check here
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== 'secret-admin-key') { // Simple demo auth
       return res.status(401).json({ message: 'Invalid API Key' });
    }

    if (!file) return res.status(400).json({ message: 'CSV File is required' });
    if (!templateId) return res.status(400).json({ message: 'templateId is required' });

    // Fetch the Workflow Template
    const template = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(templateId) as any;
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const definition = JSON.parse(template.definition);

    // 1. Create a new Job
    const jobId = `job-${Date.now()}`;
    const targetPath = ArtifactStore.getUploadPath(jobId, path.extname(file.originalname).toLowerCase());
    fs.renameSync(file.path, targetPath);

    db.prepare(`
      INSERT INTO jobs (id, original_filename, status, total_size, row_count, failed_rows)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(jobId, file.originalname, 'pending', file.size, 0, 0);

    // 2. Hydrate the rules based on the template definition
    const insertMapping = db.prepare(`INSERT INTO mappings (job_id, source_field, target_field, transform_rule) VALUES (?, ?, ?, ?)`);
    const insertCleaning = db.prepare(`INSERT INTO transformation_rules (job_id, rule_type, field, config) VALUES (?, ?, ?, ?)`);

    const mappingsArray = Object.entries(definition);
    for (const [target, config] of mappingsArray) {
       const conf = config as any;
       // Save mapping and custom code
       insertMapping.run(jobId, conf.source, target, JSON.stringify({ customCode: conf.transformCode }));
       
       // Save auto cleaning if present
       if (conf.autoClean) {
          insertCleaning.run(jobId, 'cleaning', target, JSON.stringify({ column: conf.source, operation: conf.autoClean }));
       }
    }

    // 3. Trigger Job in background
    jobManager.startJob(jobId); // No websocket for API triggers

    res.json({ message: 'Pipeline triggered successfully', jobId });
  } catch (error) {
    res.status(500).json({ message: 'Failed to trigger pipeline', error: String(error) });
  }
});

export default router;
