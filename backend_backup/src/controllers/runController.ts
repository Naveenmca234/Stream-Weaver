import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PipelineRun } from '../models/PipelineRun';
import { PipelineVersion } from '../models/Pipeline';
import { Dataset } from '../models/Dataset';
import { RejectedRecord } from '../models/RejectedRecord';
import { ETLEngine } from '../pipeline/ETLEngine';
import { PipelineCompiler } from '../pipeline/PipelineCompiler';
import { PipelineGraph } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function createRun(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { pipelineId, pipelineVersionId, datasetId } = req.body;

    if (!pipelineId || !pipelineVersionId || !datasetId) {
      res.status(400).json({
        error: 'pipelineId, pipelineVersionId, and datasetId are required',
      });
      return;
    }

    const [version, dataset] = await Promise.all([
      PipelineVersion.findById(pipelineVersionId),
      Dataset.findById(datasetId),
    ]);

    if (!version) {
      res.status(404).json({ error: 'Pipeline version not found' });
      return;
    }
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found' });
      return;
    }
    if (dataset.status !== 'ready') {
      res.status(400).json({ error: 'Dataset is not ready for processing' });
      return;
    }

    // Validate the graph
    const graph = version.graph as PipelineGraph;
    const validation = PipelineCompiler.validate(graph);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Pipeline validation failed',
        validationErrors: validation.errors,
        warnings: validation.warnings,
      });
      return;
    }

    // Get target collection
    const outputNode = graph.nodes.find((n) => n.type === 'mongodb_output');
    const targetCollection =
      (outputNode?.data as Record<string, unknown>)?.collection?.toString() ||
      'processed_records';

    const runId = `run_${uuidv4().replace(/-/g, '').substring(0, 8)}`;

    const run = await PipelineRun.create({
      runId,
      pipelineId,
      pipelineVersionId,
      datasetId,
      status: 'QUEUED',
      triggeredBy: req.user!.id,
      totalRows: dataset.estimatedRows || 0,
    });

    res.status(201).json({ runId, run });

    // Execute asynchronously
    ETLEngine.execute({
      runId,
      pipelineVersionId: version._id.toString(),
      datasetId: dataset._id.toString(),
      filePath: dataset.filePath,
      format: dataset.format,
      graph,
      targetCollection,
      totalRows: dataset.estimatedRows || 0,
      userId: req.user!.id,
    }).catch((err: Error) => {
      console.error(`[ETL] Run ${runId} failed:`, err.message);
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function listRuns(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.pipelineId) filter.pipelineId = req.query.pipelineId;
    if (req.query.status) filter.status = req.query.status;

    const [runs, total] = await Promise.all([
      PipelineRun.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('triggeredBy', 'name email')
        .populate('pipelineId', 'name'),
      PipelineRun.countDocuments(filter),
    ]);

    res.json({ runs, total, page, limit });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getRun(req: AuthRequest, res: Response): Promise<void> {
  try {
    const run = await PipelineRun.findOne({ runId: req.params.id })
      .populate('triggeredBy', 'name email')
      .populate('pipelineId', 'name')
      .populate('datasetId', 'originalName format size');

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(run);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function cancelRun(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const cancelled = ETLEngine.cancelRun(id);

    if (!cancelled) {
      // Check if run exists and can be cancelled
      const run = await PipelineRun.findOne({ runId: id });
      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
        res.status(400).json({ error: `Run is already ${run.status}` });
        return;
      }
    }

    res.json({ message: 'Cancellation requested', runId: id });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getRunErrors(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const skip = (page - 1) * limit;
    const stage = req.query.stage as string | undefined;

    const filter: Record<string, unknown> = { runId: id };
    if (stage) filter.stage = stage;

    const [errors, total] = await Promise.all([
      RejectedRecord.find(filter).sort({ rowNumber: 1 }).skip(skip).limit(limit),
      RejectedRecord.countDocuments(filter),
    ]);

    res.json({ errors, total, page, limit });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
