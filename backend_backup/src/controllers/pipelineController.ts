import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Pipeline, PipelineVersion } from '../models/Pipeline';
import { PipelineCompiler } from '../pipeline/PipelineCompiler';
import { PipelineGraph } from '../types';

export async function createPipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { name, description, graph, tags } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Pipeline name is required' });
      return;
    }

    const pipeline = await Pipeline.create({
      name,
      description: description || '',
      tags: tags || [],
      currentVersion: 1,
      status: 'draft',
      createdBy: req.user!.id,
    });

    // Create initial version
    const version = await PipelineVersion.create({
      pipelineId: pipeline._id,
      version: 1,
      graph: graph || { nodes: [], edges: [], version: 1, settings: {} },
      notes: 'Initial version',
      status: 'draft',
    });

    res.status(201).json({ pipeline, version });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function listPipelines(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '20'), 10);
    const skip = (page - 1) * limit;

    const [pipelines, total] = await Promise.all([
      Pipeline.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email'),
      Pipeline.countDocuments(),
    ]);

    res.json({ pipelines, total, page, limit });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getPipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const pipeline = await Pipeline.findById(req.params.id).populate(
      'createdBy',
      'name email'
    );
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    const currentVersion = await PipelineVersion.findOne({
      pipelineId: pipeline._id,
      version: pipeline.currentVersion,
    });

    res.json({ pipeline, currentVersion });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function updatePipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { name, description, graph, notes, tags } = req.body;

    const pipeline = await Pipeline.findById(req.params.id);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    if (name) pipeline.name = name;
    if (description !== undefined) pipeline.description = description;
    if (tags) pipeline.tags = tags;

    if (graph) {
      // Create new version
      const newVersion = pipeline.currentVersion + 1;
      pipeline.currentVersion = newVersion;

      await PipelineVersion.create({
        pipelineId: pipeline._id,
        version: newVersion,
        graph,
        notes: notes || `Version ${newVersion}`,
        status: 'draft',
      });
    }

    await pipeline.save();

    const currentVersion = await PipelineVersion.findOne({
      pipelineId: pipeline._id,
      version: pipeline.currentVersion,
    });

    res.json({ pipeline, currentVersion });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function validatePipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { graph } = req.body;

    if (!graph) {
      res.status(400).json({ error: 'Graph is required for validation' });
      return;
    }

    const result = PipelineCompiler.validate(graph as PipelineGraph);
    res.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function publishPipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const pipeline = await Pipeline.findById(req.params.id);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    const version = await PipelineVersion.findOneAndUpdate(
      { pipelineId: pipeline._id, version: pipeline.currentVersion },
      {
        status: 'published',
        publishedBy: req.user!.id,
        publishedAt: new Date(),
        notes: req.body.notes || `Published v${pipeline.currentVersion}`,
      },
      { new: true }
    );

    pipeline.status = 'published';
    await pipeline.save();

    res.json({ pipeline, version });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getPipelineVersions(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const versions = await PipelineVersion.find({
      pipelineId: req.params.id,
    })
      .sort({ version: -1 })
      .populate('publishedBy', 'name email');

    res.json(versions);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function rollbackPipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { version } = req.body;
    const pipeline = await Pipeline.findById(req.params.id);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }

    const targetVersion = await PipelineVersion.findOne({
      pipelineId: pipeline._id,
      version,
    });

    if (!targetVersion) {
      res.status(404).json({ error: `Version ${version} not found` });
      return;
    }

    // Create a new version based on the target
    const newVersion = pipeline.currentVersion + 1;
    await PipelineVersion.create({
      pipelineId: pipeline._id,
      version: newVersion,
      graph: targetVersion.graph,
      notes: `Rolled back from v${version}`,
      status: 'draft',
    });

    pipeline.currentVersion = newVersion;
    await pipeline.save();

    res.json({ pipeline, newVersion });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function deletePipeline(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const pipeline = await Pipeline.findByIdAndDelete(req.params.id);
    if (!pipeline) {
      res.status(404).json({ error: 'Pipeline not found' });
      return;
    }
    await PipelineVersion.deleteMany({ pipelineId: req.params.id });
    res.json({ message: 'Pipeline deleted' });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
