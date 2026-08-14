import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline as streamPipeline } from 'stream/promises';
import { AuthRequest } from '../middleware/auth';
import { Dataset } from '../models/Dataset';
import { config } from '../config';
import { CSVParserStream } from '../parsers/CSVParser';
import { NDJSONParserStream } from '../parsers/NDJSONParser';
import {
  createAccumulator,
  accumulateRecord,
  buildSchema,
} from '../services/schemaDetector';
import { Transform } from 'stream';

function ensureUploadDir(): void {
  if (!fs.existsSync(config.uploadDir)) {
    fs.mkdirSync(config.uploadDir, { recursive: true });
  }
}

export async function uploadDataset(
  req: AuthRequest,
  res: Response
): Promise<void> {
  ensureUploadDir();

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    res.status(400).json({ error: 'Multipart form data required' });
    return;
  }

  const bb = Busboy({
    headers: req.headers,
    limits: { fileSize: config.maxFileSize, files: 1 },
  });

  let dataset: any = null;
  let fileSaved = false;

  bb.on('file', async (_field, fileStream, info) => {
    const { filename, mimeType } = info;
    const ext = path.extname(filename).toLowerCase();
    const format: 'csv' | 'ndjson' =
      ext === '.csv' ? 'csv' : 'ndjson';

    const uniqueFilename = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(config.uploadDir, uniqueFilename);

    // Compute checksum as we stream
    const hash = crypto.createHash('sha256');
    let fileSize = 0;

    const hashTransform = new Transform({
      transform(chunk, _enc, cb) {
        hash.update(chunk);
        fileSize += chunk.length;
        this.push(chunk);
        cb();
      },
    });

    const writeStream = fs.createWriteStream(filePath);

    try {
      // Create placeholder record
      dataset = await Dataset.create({
        filename: uniqueFilename,
        originalName: filename,
        format,
        size: 0,
        filePath,
        checksum: 'pending',
        uploadedBy: req.user!.id,
        status: 'uploading',
      });

      // Stream to disk
      await streamPipeline(fileStream, hashTransform, writeStream);
      fileSaved = true;

      const checksum = hash.digest('hex');

      // Check for duplicate
      const duplicate = await Dataset.findOne({
        checksum,
        _id: { $ne: dataset._id },
      });

      if (duplicate) {
        await Dataset.findByIdAndDelete(dataset._id);
        fs.unlinkSync(filePath);
        res.status(409).json({
          error: 'Duplicate dataset detected',
          existingId: duplicate._id,
        });
        return;
      }

      await Dataset.findByIdAndUpdate(dataset._id, {
        size: fileSize,
        checksum,
        status: 'processing',
      });

      res.status(202).json({
        id: dataset._id,
        filename: uniqueFilename,
        originalName: filename,
        size: fileSize,
        format,
        status: 'processing',
        message: 'File uploaded. Schema detection in progress.',
      });

      // Async schema detection
      detectSchemaAsync(dataset._id.toString(), filePath, format);
    } catch (err: unknown) {
      const error = err as Error;
      if (dataset) {
        await Dataset.findByIdAndUpdate(dataset._id, {
          status: 'error',
          errorMessage: error.message,
        });
      }
      if (!fileSaved && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  bb.on('error', (err: Error) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  });

  req.pipe(bb);
}

async function detectSchemaAsync(
  datasetId: string,
  filePath: string,
  format: 'csv' | 'ndjson'
): Promise<void> {
  const acc = createAccumulator();
  let estimatedRows = 0;

  try {
    const readStream = fs.createReadStream(filePath);
    const parser =
      format === 'csv' ? new CSVParserStream() : new NDJSONParserStream();

    const accumulator = new Transform({
      objectMode: true,
      transform(record, _enc, cb) {
        if (!record._parseError) {
          accumulateRecord(acc, record as Record<string, string>);
          estimatedRows++;
        }
        this.push(record);
        cb();
      },
    });

    // Count all rows (even after maxSamples for schema)
    const counter = new Transform({
      objectMode: true,
      transform(_record, _enc, cb) {
        estimatedRows++;
        cb();
      },
    });

    await streamPipeline(readStream, parser, accumulator);

    const schema = buildSchema(acc);

    await Dataset.findByIdAndUpdate(datasetId, {
      schema,
      estimatedRows: acc.sampleSize,
      status: 'ready',
    });
  } catch (err: unknown) {
    const error = err as Error;
    await Dataset.findByIdAndUpdate(datasetId, {
      status: 'error',
      errorMessage: `Schema detection failed: ${error.message}`,
    });
  }
}

export async function listDatasets(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const skip = (page - 1) * limit;

    const [datasets, total] = await Promise.all([
      Dataset.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('uploadedBy', 'name email'),
      Dataset.countDocuments(),
    ]);

    res.json({ datasets, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getDataset(req: AuthRequest, res: Response): Promise<void> {
  try {
    const dataset = await Dataset.findById(req.params.id).populate(
      'uploadedBy',
      'name email'
    );
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found' });
      return;
    }
    res.json(dataset);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getDatasetSchema(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const dataset = await Dataset.findById(req.params.id, 'schema status');
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found' });
      return;
    }
    if (dataset.status !== 'ready') {
      res.status(202).json({ message: 'Schema detection in progress', status: dataset.status });
      return;
    }
    res.json(dataset.schema);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getDatasetPreview(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found' });
      return;
    }

    if (dataset.status !== 'ready') {
      res.status(202).json({ message: 'Dataset not ready', status: dataset.status });
      return;
    }

    const maxRows = Math.min(
      parseInt(String(req.query.rows || '1000'), 10),
      5000
    );

    const rows: Record<string, unknown>[] = [];
    const readStream = fs.createReadStream(dataset.filePath);
    const parser =
      dataset.format === 'csv'
        ? new CSVParserStream()
        : new NDJSONParserStream();

    const collector = new Transform({
      objectMode: true,
      transform(record, _enc, cb) {
        if (rows.length < maxRows) {
          rows.push(record);
        } else {
          // Signal done - destroy the read stream
          readStream.destroy();
        }
        cb();
      },
    });

    try {
      await streamPipeline(readStream, parser, collector);
    } catch {
      // Ignore stream destruction errors from early termination
    }

    res.json({
      rows,
      total: rows.length,
      columns: dataset.schema?.fields.map((f) => f.name) || Object.keys(rows[0] || {}),
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function deleteDataset(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const dataset = await Dataset.findByIdAndDelete(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found' });
      return;
    }
    // Delete file from disk
    if (fs.existsSync(dataset.filePath)) {
      fs.unlinkSync(dataset.filePath);
    }
    res.json({ message: 'Dataset deleted' });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function updateDatasetSchema(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { fields } = req.body;
    const dataset = await Dataset.findById(req.params.id);
    if (!dataset || !dataset.schema) {
      res.status(404).json({ error: 'Dataset or schema not found' });
      return;
    }

    // Apply overrides
    for (const override of fields as Array<{ name: string; overriddenType: string }>) {
      const field = dataset.schema.fields.find((f) => f.name === override.name);
      if (field) {
        field.overriddenType = override.overriddenType as typeof field.overriddenType;
      }
    }

    await dataset.save();
    res.json(dataset.schema);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
