import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { db } from '../storage/sqlite/database';
import { ArtifactStore } from '../storage/filesystem/artifactStore';
import { createReadStream } from 'node:fs';
import { parse } from 'csv-parse';
import * as fs from 'node:fs/promises';
import path from 'node:path';

const router = Router();
router.use(requireAuth);

type ColumnProfile = {
  name: string;
  type: string;
  totalValues: number;
  missingValues: number;
  uniqueValues: number;
};

type DatasetProfile = {
  totalRows: number;
  totalColumns: number;
  qualityScore: number;
  columns: ColumnProfile[];
};

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const uploadId = req.query.uploadId as string;
    if (!uploadId || typeof uploadId !== 'string') {
      return res.status(400).json({ message: 'uploadId query parameter is required' });
    }

    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(uploadId) as any;
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const extension = path.extname(job.original_filename).toLowerCase();
    const sourcePath = ArtifactStore.getUploadPath(uploadId, `source${extension}`);
    
    // Check if report already exists to cache the result
    const reportPath = ArtifactStore.getReportPath(uploadId);
    try {
      const existingReport = await fs.readFile(reportPath, 'utf8');
      return res.json({ profile: JSON.parse(existingReport) });
    } catch (e) {
      // no existing report, generate it
    }

    // Generate basic profile by streaming the file
    let totalRows = 0;
    const columnsStats: Record<string, { missing: number, vals: Set<any>, numericCount: number }> = {};
    
    if (extension === '.csv') {
      const parser = parse({ columns: true, skip_empty_lines: true });
      const readStream = createReadStream(sourcePath);
      
      for await (const record of readStream.pipe(parser)) {
        totalRows++;
        // Profile up to first 50,000 rows for speed
        if (totalRows > 50000) continue; 
        
        for (const [key, value] of Object.entries(record)) {
          if (!columnsStats[key]) {
            columnsStats[key] = { missing: 0, vals: new Set(), numericCount: 0 };
          }
          
          if (value === '' || value === null || value === undefined) {
            columnsStats[key].missing++;
          } else {
             // To prevent memory bloat, only track up to 1000 unique values per column
            if (columnsStats[key].vals.size < 1000) {
              columnsStats[key].vals.add(value);
            }
            if (!isNaN(Number(value))) {
              columnsStats[key].numericCount++;
            }
          }
        }
      }
    } else {
      // Fallback for non-csv
      return res.json({ 
        profile: { totalRows: job.row_count, totalColumns: 0, qualityScore: 100, columns: [] } 
      });
    }

    const columns: ColumnProfile[] = Object.entries(columnsStats).map(([name, stat]) => {
      const type = stat.numericCount > (totalRows - stat.missing) * 0.8 ? 'number' : 'string';
      return {
        name,
        type,
        totalValues: totalRows,
        missingValues: stat.missing,
        uniqueValues: stat.vals.size >= 1000 ? 1000 : stat.vals.size,
      };
    });

    const completeness = totalRows > 0 
      ? 100 - Math.round((columns.reduce((s, c) => s + c.missingValues, 0) / (totalRows * columns.length || 1)) * 100) 
      : 100;

    const profile: DatasetProfile = {
      totalRows,
      totalColumns: columns.length,
      qualityScore: completeness,
      columns
    };

    // Save report for future calls
    await fs.writeFile(reportPath, JSON.stringify(profile));

    res.json({ profile });
  } catch (error) {
    console.error('Profiling error:', error);
    res.status(500).json({ message: 'Unable to compute dataset profile', error: String(error) });
  }
});

export default router;
