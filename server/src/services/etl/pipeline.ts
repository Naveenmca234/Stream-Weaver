import { pipeline as streamPipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { parse as streamParse } from 'csv-parse';
import { stringify as streamStringify } from 'csv-stringify';
import { db } from '../../storage/sqlite/database';
import { ArtifactStore } from '../../storage/filesystem/artifactStore';
import { DestinationConnector } from '../connectors/connector';
import { CsvConnector } from '../connectors/CsvConnector';
import { PostgresConnector } from '../connectors/postgresConnector';
import path from 'node:path';
import Piscina from 'piscina';

export const runETLJob = async (jobId: string, io?: any) => {
  const job = db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(jobId) as any;
  if (!job) throw new Error('Job not found');

  db.prepare(`UPDATE jobs SET status = 'processing' WHERE id = ?`).run(jobId);

  const mappings = db.prepare(`SELECT * FROM mappings WHERE job_id = ?`).all(jobId) as any[];
  const transforms = db.prepare(`SELECT * FROM transformation_rules WHERE job_id = ? AND rule_type = 'transform'`).all(jobId) as any[];
  const cleaning = db.prepare(`SELECT * FROM transformation_rules WHERE job_id = ? AND rule_type = 'cleaning'`).all(jobId) as any[];
  const validations = db.prepare(`SELECT * FROM validation_rules WHERE job_id = ?`).all(jobId) as any[];

  const extension = path.extname(job.original_filename).toLowerCase();
  const sourcePath = ArtifactStore.getUploadPath(jobId, `source${extension}`);
  const outPath = ArtifactStore.getOutputPath(jobId, `processed.csv`);
  const failedPath = ArtifactStore.getFailedPath(jobId);

  let rowsProcessed = 0;
  let rowsFailed = 0;
  const start = Date.now();

  const readable = createReadStream(sourcePath);
  const parser = streamParse({ columns: true, skip_empty_lines: true });
  
  let destination: DestinationConnector;
  // If POSTGRES_URL is set and job has postgres destination flag (mocked via env for now), use Postgres
  if (process.env.POSTGRES_URL && process.env.DEFAULT_DESTINATION === 'postgres') {
    destination = new PostgresConnector({
      connectionString: process.env.POSTGRES_URL,
      tableName: `job_${jobId.replace(/[^a-zA-Z0-9]/g, '_')}`
    });
  } else {
    destination = new CsvConnector(outPath);
  }
  await destination.connect();

  const failedOutput = createWriteStream(failedPath);
  const failedStringifier = streamStringify({ header: true });
  failedStringifier.pipe(failedOutput);

  // Initialize Worker Pool
  const isTs = __filename.endsWith('.ts');
  const pool = new Piscina({
    filename: path.resolve(__dirname, isTs ? 'transformWorker.ts' : 'transformWorker.js'),
    execArgv: isTs ? ['--import', 'tsx'] : []
  });

  const BATCH_SIZE = 500;
  const MAX_CONCURRENCY = 8;
  
  let currentBatch: any[] = [];
  let activePromises: Set<Promise<void>> = new Set();
  let streamFailed = false;
  let streamError: Error | null = null;

  const flushBatch = async (batchToFlush: any[]) => {
    if (batchToFlush.length === 0) return;
    
    const task = pool.run({
      batch: batchToFlush,
      mappings,
      cleaning,
      transforms,
      validations
    }).then(async (results: any[]) => {
      const validRows = [];
      for (const res of results) {
        rowsProcessed++;
        if (res.failed) {
          rowsFailed++;
          failedStringifier.write({ ...res.row, __failReason: res.failReason });
        } else {
          validRows.push(res.outputRow);
        }
      }

      if (validRows.length > 0) {
        await destination.writeBatch(validRows);
      }
      
      if (io && rowsProcessed % 2000 < BATCH_SIZE) { // Report roughly every 2000 rows
         const elapsed = Math.max((Date.now() - start) / 1000, 0.001);
         io.to(jobId).emit('import-progress', {
            jobId,
            stage: 'TRANSFORMING',
            rowsProcessed,
            failedRows: rowsFailed,
            rowsPerSecond: Math.round(rowsProcessed / elapsed),
            percent: Math.min(100, Math.round((rowsProcessed / job.row_count) * 100))
         });
      }
    });

    activePromises.add(task);
    task.finally(() => {
      activePromises.delete(task);
    });

    if (activePromises.size >= MAX_CONCURRENCY) {
      await Promise.race(activePromises);
    }
  };

  try {
    for await (const row of readable.pipe(parser)) {
      if (streamFailed) throw streamError;
      
      currentBatch.push(row);
      if (currentBatch.length >= BATCH_SIZE) {
        await flushBatch(currentBatch);
        currentBatch = [];
      }
    }
    
    // Flush remaining
    if (currentBatch.length > 0) {
      await flushBatch(currentBatch);
    }

    // Wait for all active promises to finish
    await Promise.all(activePromises);

    await destination.disconnect();
    failedStringifier.end();

    db.prepare(`UPDATE jobs SET status = 'completed', row_count = ?, failed_rows = ? WHERE id = ?`)
      .run(rowsProcessed, rowsFailed, jobId);
      
    if (io) {
      io.to(jobId).emit('import-progress', {
         jobId,
         stage: 'COMPLETED',
         rowsProcessed,
         failedRows: rowsFailed,
         percent: 100
      });
    }

  } catch (err: any) {
    streamFailed = true;
    streamError = err;
    db.prepare(`UPDATE jobs SET status = 'failed' WHERE id = ?`).run(jobId);
    throw err;
  }
};
