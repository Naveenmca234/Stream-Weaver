import { pipeline as streamPipeline } from 'stream/promises';
import { Transform } from 'stream';
import fs from 'fs';
import { PipelineGraph, PipelineNode, RunStatus, BatchResult } from '../types';
import { CSVParserStream } from '../parsers/CSVParser';
import { NDJSONParserStream } from '../parsers/NDJSONParser';
import { buildTransformFromNode } from '../transformers';
import { ValidationStream, buildValidationFromNode } from '../validators';
import { BatchWriterTransform } from '../streams/BatchWriter';
import { RejectedRecord } from '../models/RejectedRecord';
import { PipelineRun } from '../models/PipelineRun';
import { WebSocketServer } from '../websocket/WebSocketServer';
import { config } from '../config';

export interface RunContext {
  runId: string;
  pipelineVersionId: string;
  datasetId: string;
  filePath: string;
  format: 'csv' | 'ndjson';
  graph: PipelineGraph;
  targetCollection: string;
  totalRows: number;
  userId: string;
}

export class ETLEngine {
  private static activeRuns = new Map<string, { cancel: () => void }>();

  static isRunActive(runId: string): boolean {
    return ETLEngine.activeRuns.has(runId);
  }

  static cancelRun(runId: string): boolean {
    const run = ETLEngine.activeRuns.get(runId);
    if (run) {
      run.cancel();
      return true;
    }
    return false;
  }

  static async execute(ctx: RunContext): Promise<void> {
    const {
      runId,
      filePath,
      format,
      graph,
      targetCollection,
      totalRows,
    } = ctx;

    let cancelled = false;
    let processedRows = 0;
    let successfulRows = 0;
    let failedRows = 0;
    let currentStage = 'parsing';
    let batchNumber = 0;
    let backpressureActive = false;
    let queueDepth = 0;
    const startTime = Date.now();

    // Register cancel handler
    ETLEngine.activeRuns.set(runId, {
      cancel: () => { cancelled = true; },
    });

    const wss = WebSocketServer.getInstance();

    const emitProgress = () => {
      const elapsedMs = Date.now() - startTime;
      const elapsedSec = elapsedMs / 1000;
      const throughput = elapsedSec > 0 ? Math.round(processedRows / elapsedSec) : 0;
      const remaining = totalRows > 0 ? totalRows - processedRows : 0;
      const etaSec = throughput > 0 ? Math.round(remaining / throughput) : 0;
      const mem = process.memoryUsage();

      wss.broadcast({
        type: 'run.progress',
        payload: {
          runId,
          status: 'RUNNING' as RunStatus,
          totalRows,
          processedRows,
          successfulRows,
          failedRows,
          throughput,
          etaSeconds: etaSec,
          elapsedSeconds: Math.round(elapsedSec),
          memoryMb: Math.round(mem.rss / 1024 / 1024),
          cpuPercent: 0,
          batchNumber,
          currentStage,
          backpressureActive,
          queueDepth,
        },
      });
    };

    // Emit progress every second
    const progressInterval = setInterval(emitProgress, 1000);

    try {
      await PipelineRun.findOneAndUpdate(
        { runId },
        { status: 'RUNNING', startedAt: new Date(), currentStage: 'parsing' }
      );

      wss.broadcast({ type: 'run.started', payload: { runId } });

      // --- Build streaming pipeline ---
      const readStream = fs.createReadStream(filePath);

      // Cancellation passthrough
      const cancelGuard = new Transform({
        objectMode: true,
        transform(chunk, _enc, cb) {
          if (cancelled) {
            cb(new Error('CANCELLED'));
          } else {
            this.push(chunk);
            cb();
          }
        },
      });

      // Counter stream
      const counter = new Transform({
        objectMode: true,
        transform(record, _enc, cb) {
          processedRows++;
          this.push(record);
          cb();
        },
      });

      // Rejected record handler
      const rejectedBuffer: Array<{
        record: Record<string, unknown>;
        field: string;
        value: unknown;
        stage: string;
        error: string;
      }> = [];

      const flushRejected = async () => {
        if (rejectedBuffer.length === 0) return;
        const docs = rejectedBuffer.splice(0, rejectedBuffer.length).map((r) => ({
          runId,
          rowNumber: (r.record._row as number) || 0,
          field: r.field,
          value: r.value,
          stage: r.stage,
          error: r.error,
          rawRecord: r.record,
          timestamp: new Date(),
        }));
        await RejectedRecord.insertMany(docs, { ordered: false }).catch(() => {});
        failedRows += docs.length;

        wss.broadcast({
          type: 'run.error',
          payload: { runId, count: docs.length, stage: 'validation' },
        });
      };

      const collectRejected = (
        record: Record<string, unknown>,
        field: string,
        value: unknown,
        stage: string,
        error: string
      ) => {
        rejectedBuffer.push({ record, field, value, stage, error });
        if (rejectedBuffer.length >= 100) {
          flushRejected();
        }
      };

      // Batch writer
      const batchWriter = new BatchWriterTransform(
        targetCollection,
        config.batchSize,
        (result: BatchResult) => {
          batchNumber = result.batchNumber;
          successfulRows += result.inserted;
          failedRows += result.failed;
          currentStage = 'MongoDB';

          wss.broadcast({
            type: 'run.batch',
            payload: {
              runId,
              batchNumber: result.batchNumber,
              inserted: result.inserted,
              failed: result.failed,
              latencyMs: result.latencyMs,
            },
          });
        },
        (active: boolean, depth: number) => {
          backpressureActive = active;
          queueDepth = depth;
          if (active) {
            wss.broadcast({
              type: 'run.warning',
              payload: { runId, message: 'BACKPRESSURE: ACTIVE', queueDepth: depth },
            });
          }
        }
      );

      // Build transform stages from graph
      const nodes = graph.nodes;
      const transformStages: Transform[] = [];

      // Sort nodes by execution order (topological)
      const sortedNodes = ETLEngine.topologicalSort(nodes, graph.edges);

      for (const node of sortedNodes) {
        currentStage = node.label || node.type;

        if (
          node.type === 'csv_input' ||
          node.type === 'ndjson_input' ||
          node.type === 'mongodb_output'
        ) {
          continue; // Handled separately
        }

        // Transform nodes
        const transform = buildTransformFromNode(
          node,
          runId,
          (record, reason, field) => {
            collectRejected(record, field || '', record[field || ''], 'transform', reason);
          }
        );

        if (transform) {
          transformStages.push(transform);
        }

        // Validation nodes
        if (
          [
            'required',
            'type_check',
            'regex',
            'email',
            'range',
            'length',
            'date_validation',
          ].includes(node.type)
        ) {
          const validator = buildValidationFromNode(node, (record, field, value, error) => {
            collectRejected(record, field, value, 'validation', error);
          });
          if (validator) transformStages.push(validator);
        }
      }

      // Parser
      const parser =
        format === 'csv' ? new CSVParserStream() : new NDJSONParserStream();

      // Execute the full streaming pipeline
      await streamPipeline(
        readStream,
        parser,
        cancelGuard,
        counter,
        ...transformStages,
        batchWriter
      );

      await flushRejected();

      const durationMs = Date.now() - startTime;
      const finalStatus: RunStatus =
        failedRows > 0 ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED';

      await PipelineRun.findOneAndUpdate(
        { runId },
        {
          status: finalStatus,
          processedRows,
          successfulRows,
          failedRows,
          totalRows: processedRows,
          durationMs,
          peakMemoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          avgThroughput: durationMs > 0 ? Math.round((processedRows / durationMs) * 1000) : 0,
          lastBatchNumber: batchNumber,
          lastCheckpoint: processedRows,
          completedAt: new Date(),
          currentStage: 'COMPLETED',
        }
      );

      wss.broadcast({
        type: 'run.completed',
        payload: {
          runId,
          status: finalStatus,
          processedRows,
          successfulRows,
          failedRows,
          durationMs,
          batchNumber,
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      const isCancelled = error.message === 'CANCELLED';

      const finalStatus: RunStatus = isCancelled ? 'CANCELLED' : 'FAILED';

      await PipelineRun.findOneAndUpdate(
        { runId },
        {
          status: finalStatus,
          processedRows,
          successfulRows,
          failedRows,
          errorMessage: isCancelled ? 'Run cancelled by user' : error.message,
          completedAt: new Date(),
          durationMs: Date.now() - startTime,
          currentStage: isCancelled ? 'CANCELLED' : 'FAILED',
        }
      );

      wss.broadcast({
        type: isCancelled ? 'run.cancelled' : 'run.failed',
        payload: {
          runId,
          error: isCancelled ? 'Cancelled' : error.message,
          processedRows,
        },
      });
    } finally {
      clearInterval(progressInterval);
      ETLEngine.activeRuns.delete(runId);
    }
  }

  private static topologicalSort(
    nodes: PipelineGraph['nodes'],
    edges: PipelineGraph['edges']
  ): PipelineGraph['nodes'] {
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    for (const edge of edges) {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return sorted.map((id) => nodeMap.get(id)!).filter(Boolean);
  }
}
