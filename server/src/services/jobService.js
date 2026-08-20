import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { parse } from 'csv-parse';

import { CsvRowObjectTransform } from '../streams/csvRowObjectTransform.js';
import { MappingTransform } from '../streams/mappingTransform.js';
import { SandboxTransform } from '../streams/sandboxTransform.js';
import { ProgressTransform } from '../streams/progressTransform.js';
import { createHttpError } from '../utils/httpError.js';
import { emitJobEvent } from '../sockets/socketServer.js';
import {
  getActiveJobForUpload,
  getJob,
  registerJob,
  toPublicJob,
  updateJob,
} from './jobRegistry.js';
import { getUpload, updateUploadStatus } from './uploadRegistry.js';

const DESTINATION_FIELD_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLOCKED_FIELDS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_RECORD_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_MAPPINGS = 200;
const MAX_TRANSFORMATIONS = 100;
const MAX_TRANSFORM_CODE_LENGTH = 4000;

function normalizeMappings(rawMappings) {
  if (!Array.isArray(rawMappings) || rawMappings.length === 0) {
    throw createHttpError(
      400,
      'MAPPING_REQUIRED',
      'At least one mapping is required before processing.',
    );
  }

  if (rawMappings.length > MAX_MAPPINGS) {
    throw createHttpError(
      400,
      'TOO_MANY_MAPPINGS',
      `A maximum of ${MAX_MAPPINGS} mappings is supported.`,
    );
  }

  const sourceIndexes = new Set();
  const sourceKeys = new Set();
  const destinationFields = new Set();

  return rawMappings.map((mapping, index) => {
    const sourceKey = String(mapping?.sourceKey ?? '').trim();
    const sourceIndex = mapping?.sourceIndex;
    const destinationField = String(mapping?.destinationField ?? '').trim();

    if (!sourceKey || !Number.isInteger(sourceIndex) || sourceIndex < 0) {
      throw createHttpError(
        400,
        'INVALID_SOURCE_MAPPING',
        `Mapping ${index + 1} contains an invalid source column.`,
      );
    }

    if (
      !destinationField ||
      destinationField.length > 120 ||
      !DESTINATION_FIELD_PATTERN.test(destinationField) ||
      BLOCKED_FIELDS.has(destinationField)
    ) {
      throw createHttpError(
        400,
        'INVALID_DESTINATION_FIELD',
        `Mapping ${index + 1} contains an invalid destination field.`,
      );
    }

    const destinationKey = destinationField.toLocaleLowerCase();

    if (
      sourceIndexes.has(sourceIndex) ||
      sourceKeys.has(sourceKey) ||
      destinationFields.has(destinationKey)
    ) {
      throw createHttpError(
        400,
        'DUPLICATE_MAPPING',
        'Source and destination fields must be unique.',
      );
    }

    sourceIndexes.add(sourceIndex);
    sourceKeys.add(sourceKey);
    destinationFields.add(destinationKey);

    return {
      sourceKey,
      sourceIndex,
      destinationField,
    };
  });
}

function normalizeTransformations(rawTransformations, mappings) {
  if (rawTransformations == null) {
    return [];
  }

  if (!Array.isArray(rawTransformations)) {
    throw createHttpError(
      400,
      'INVALID_TRANSFORMATIONS',
      'Transformations must be supplied as an array.',
    );
  }

  if (rawTransformations.length > MAX_TRANSFORMATIONS) {
    throw createHttpError(
      400,
      'TOO_MANY_TRANSFORMATIONS',
      `A maximum of ${MAX_TRANSFORMATIONS} transformations is supported.`,
    );
  }

  const allowedFields = new Set(
    mappings.map((mapping) => mapping.destinationField),
  );
  const usedFields = new Set();

  return rawTransformations
    .map((transformation, index) => {
      const field = String(transformation?.field ?? '').trim();
      const code = String(transformation?.code ?? '').trim();

      if (!field || !allowedFields.has(field)) {
        throw createHttpError(
          400,
          'INVALID_TRANSFORMATION_FIELD',
          `Transformation ${index + 1} must target a mapped destination field.`,
        );
      }

      if (!code) {
        return null;
      }

      if (code.length > MAX_TRANSFORM_CODE_LENGTH) {
        throw createHttpError(
          400,
          'TRANSFORMATION_TOO_LARGE',
          `Transformation ${index + 1} exceeds the maximum code length.`,
        );
      }

      if (usedFields.has(field)) {
        throw createHttpError(
          400,
          'DUPLICATE_TRANSFORMATION_FIELD',
          `Only one inline transformation may target "${field}".`,
        );
      }

      usedFields.add(field);

      return { field, code };
    })
    .filter(Boolean);
}

function getActiveUpload(uploadId) {
  const upload = getUpload(uploadId);

  if (!upload) {
    throw createHttpError(
      404,
      'UPLOAD_NOT_FOUND',
      'The temporary upload could not be found. Upload the dataset again.',
    );
  }

  if (upload.expiresAtMs <= Date.now()) {
    throw createHttpError(
      410,
      'UPLOAD_EXPIRED',
      'This temporary upload has expired. Upload the dataset again.',
    );
  }

  return upload;
}

function publish(jobId, eventName) {
  const job = getJob(jobId);

  if (!job) {
    return;
  }

  emitJobEvent(jobId, eventName, toPublicJob(job));
}

async function runProcessingJob({ jobId, upload, mappings, transformations }) {
  const source = createReadStream(upload.filePath, {
    highWaterMark: 64 * 1024,
  });

  const parser = parse({
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    max_record_size: MAX_RECORD_SIZE_BYTES,
    trim: false,
  });

  const csvObjectTransform = new CsvRowObjectTransform({
    sourceColumns: mappings.map((mapping) => ({
      key: mapping.sourceKey,
      index: mapping.sourceIndex,
    })),
  });

  const mappingTransform = new MappingTransform({ mappings });
  const sandboxTransform = new SandboxTransform({
    transformations,
    memoryLimitMb: 16,
    timeoutMs: 50,
  });

  const progressTransform = new ProgressTransform({
    emitEveryRows: 250,
    emitEveryMs: 250,
    onProgress(snapshot) {
      const byteProgress = upload.sizeBytes > 0
        ? Math.round((source.bytesRead / upload.sizeBytes) * 100)
        : 0;

      updateJob(jobId, {
        status: 'running',
        stage: transformations.length > 0 ? 'sandbox-transform' : 'stream-transform',
        progressPercent: Math.min(99, Math.max(0, byteProgress)),
        rowsProcessed: snapshot.rowsProcessed,
        successfulRows: snapshot.rowsProcessed,
        failedRows: 0,
        rowsPerSecond: snapshot.rowsPerSecond,
        elapsedSeconds: snapshot.elapsedSeconds,
      });

      publish(jobId, 'job:progress');
    },
  });

  const sink = new Writable({
    objectMode: true,
    write(_row, _encoding, callback) {
      callback();
    },
  });

  updateUploadStatus(upload.uploadId, 'processing');
  updateJob(jobId, {
    status: 'running',
    stage: 'stream-started',
    progressPercent: 0,
  });
  publish(jobId, 'job:started');

  try {
    await pipeline(
      source,
      parser,
      csvObjectTransform,
      mappingTransform,
      sandboxTransform,
      progressTransform,
      sink,
    );

    const completedAt = new Date().toISOString();
    const current = getJob(jobId);

    updateJob(jobId, {
      status: 'completed',
      stage: 'completed',
      progressPercent: 100,
      rowsProcessed: progressTransform.rowsProcessed,
      successfulRows: progressTransform.rowsProcessed,
      failedRows: 0,
      rowsPerSecond: current?.rowsPerSecond ?? 0,
      elapsedSeconds: current?.elapsedSeconds ?? 0,
      completedAt,
      error: null,
    });

    publish(jobId, 'job:completed');
  } catch (error) {
    updateJob(jobId, {
      status: 'failed',
      stage: 'failed',
      completedAt: new Date().toISOString(),
      error: {
        code: error?.code || 'PROCESSING_FAILED',
        message: error?.message || 'Dataset processing failed.',
      },
    });

    publish(jobId, 'job:failed');
  } finally {
    source.destroy();
    parser.destroy();
    csvObjectTransform.destroy();
    mappingTransform.destroy();
    sandboxTransform.destroy();
    progressTransform.destroy();
    sink.destroy();

    if (getUpload(upload.uploadId)) {
      updateUploadStatus(upload.uploadId, 'ready');
    }
  }
}

export function startProcessingJob(uploadId, rawMappings, rawTransformations) {
  const upload = getActiveUpload(uploadId);

  const activeJob = getActiveJobForUpload(uploadId);

  if (activeJob) {
    throw createHttpError(
      409,
      'JOB_ALREADY_RUNNING',
      'A processing job is already running for this upload.',
    );
  }

  const mappings = normalizeMappings(rawMappings);
  const transformations = normalizeTransformations(
    rawTransformations,
    mappings,
  );

  const now = new Date().toISOString();
  const jobId = randomUUID();

  const job = registerJob({
    jobId,
    uploadId,
    fileName: upload.originalFileName,
    status: 'queued',
    stage: 'queued',
    progressPercent: 0,
    rowsProcessed: 0,
    successfulRows: 0,
    failedRows: 0,
    rowsPerSecond: 0,
    elapsedSeconds: 0,
    startedAt: now,
    completedAt: null,
    error: null,
  });

  setImmediate(() => {
    void runProcessingJob({
      jobId,
      upload,
      mappings,
      transformations,
    });
  });

  return toPublicJob(job);
}

export function getProcessingJob(jobId) {
  const job = getJob(jobId);

  if (!job) {
    throw createHttpError(
      404,
      'JOB_NOT_FOUND',
      'The processing job could not be found.',
    );
  }

  return toPublicJob(job);
}
