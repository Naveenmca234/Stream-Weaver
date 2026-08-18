import { Transform, TransformCallback } from 'stream';
import mongoose from 'mongoose';
import { config } from '../config';
import { BatchResult } from '../types';

export class BatchWriterTransform extends Transform {
  private batch: Record<string, unknown>[] = [];
  private batchNumber = 0;
  private totalInserted = 0;
  private totalFailed = 0;
  private queueDepth = 0;
  private maxQueueDepth: number;

  constructor(
    private collectionName: string,
    private batchSize: number = config.batchSize,
    private onBatchComplete: (result: BatchResult) => void,
    private onBackpressure?: (active: boolean, depth: number) => void
  ) {
    super({ objectMode: true, highWaterMark: batchSize * 2 });
    this.maxQueueDepth = batchSize * 4;
  }

  _transform(
    record: Record<string, unknown>,
    _enc: BufferEncoding,
    callback: TransformCallback
  ): void {
    // Remove internal tracking fields
    const { _row, _validationErrors, _parseError, ...cleanRecord } = record as Record<string, unknown>;
    void _row; void _validationErrors; void _parseError;

    this.batch.push(cleanRecord);
    this.queueDepth = this.batch.length;

    // Signal backpressure when approaching max
    if (this.queueDepth > this.maxQueueDepth * 0.75) {
      this.onBackpressure?.(true, this.queueDepth);
    }

    if (this.batch.length >= this.batchSize) {
      this._flushBatch(callback);
    } else {
      callback();
    }
  }

  _flush(callback: TransformCallback): void {
    if (this.batch.length > 0) {
      this._flushBatch(callback);
    } else {
      callback();
    }
  }

  private async _flushBatch(callback: TransformCallback): Promise<void> {
    const batchToWrite = this.batch.splice(0, this.batch.length);
    this.batchNumber++;
    this.queueDepth = 0;
    this.onBackpressure?.(false, 0);

    const startTime = Date.now();

    try {
      const db = mongoose.connection.db;
      if (!db) throw new Error('Database not connected');

      const collection = db.collection(this.collectionName);
      const ops = batchToWrite.map((doc) => ({
        insertOne: { document: doc },
      }));

      const result = await collection.bulkWrite(ops, {
        ordered: false, // Continue on individual failures
      });

      const inserted = result.insertedCount || 0;
      const failed = batchToWrite.length - inserted;
      this.totalInserted += inserted;
      this.totalFailed += failed;

      const latencyMs = Date.now() - startTime;

      this.onBatchComplete({
        batchNumber: this.batchNumber,
        inserted,
        updated: 0,
        failed,
        latencyMs,
      });

      callback();
    } catch (err: unknown) {
      const error = err as Error & { writeErrors?: unknown[] };
      // Handle partial batch failures
      if (error.writeErrors) {
        const failed = (error.writeErrors as unknown[]).length;
        this.totalFailed += failed;
        this.totalInserted += batchToWrite.length - failed;

        this.onBatchComplete({
          batchNumber: this.batchNumber,
          inserted: batchToWrite.length - failed,
          updated: 0,
          failed,
          latencyMs: Date.now() - startTime,
        });
        callback(); // Don't propagate partial failures
      } else {
        callback(error);
      }
    }
  }

  getStats() {
    return {
      batchNumber: this.batchNumber,
      totalInserted: this.totalInserted,
      totalFailed: this.totalFailed,
      queueDepth: this.queueDepth,
    };
  }
}
