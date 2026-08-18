import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { PipelineRun } from '../models/PipelineRun';
import { Dataset } from '../models/Dataset';
import { Pipeline } from '../models/Pipeline';
import { AuditLog } from '../models/AuditLog';
import { WebSocketServer } from '../websocket/WebSocketServer';

export async function getMonitoringMetrics(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const mem = process.memoryUsage();
    const wss = WebSocketServer.getInstance();

    const [
      activeRuns,
      totalRuns,
      totalDatasets,
      totalPipelines,
      recentRuns,
      failedRunsToday,
    ] = await Promise.all([
      PipelineRun.countDocuments({ status: 'RUNNING' }),
      PipelineRun.countDocuments(),
      Dataset.countDocuments(),
      Pipeline.countDocuments(),
      PipelineRun.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('pipelineId', 'name')
        .populate('triggeredBy', 'name'),
      PipelineRun.countDocuments({
        status: 'FAILED',
        createdAt: { $gte: new Date(Date.now() - 86400000) },
      }),
    ]);

    // Aggregate stats from completed runs
    const stats = await PipelineRun.aggregate([
      { $match: { status: { $in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] } } },
      {
        $group: {
          _id: null,
          totalProcessed: { $sum: '$processedRows' },
          totalSuccessful: { $sum: '$successfulRows' },
          totalFailed: { $sum: '$failedRows' },
          avgThroughput: { $avg: '$avgThroughput' },
          avgDuration: { $avg: '$durationMs' },
          peakMemory: { $max: '$peakMemoryMb' },
        },
      },
    ]);

    const aggregated = stats[0] || {};

    res.json({
      system: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
        arrayBuffers: Math.round(mem.arrayBuffers / 1024 / 1024),
        uptime: Math.round(process.uptime()),
        wsClients: wss.getClientCount(),
      },
      runs: {
        active: activeRuns,
        total: totalRuns,
        failedToday: failedRunsToday,
        totalProcessed: aggregated.totalProcessed || 0,
        totalSuccessful: aggregated.totalSuccessful || 0,
        totalFailed: aggregated.totalFailed || 0,
        avgThroughput: Math.round(aggregated.avgThroughput || 0),
        avgDurationMs: Math.round(aggregated.avgDuration || 0),
        peakMemoryMb: aggregated.peakMemory || 0,
      },
      datasets: { total: totalDatasets },
      pipelines: { total: totalPipelines },
      recentRuns,
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getHealth(req: AuthRequest, res: Response): Promise<void> {
  try {
    const mem = process.memoryUsage();

    const checks: Record<string, { status: string; latencyMs?: number }> = {
      api: { status: 'ok' },
      mongodb: { status: 'unknown' },
      etlEngine: { status: 'ok' },
      webSocket: { status: 'ok' },
      sandbox: { status: 'ok' },
    };

    // MongoDB health check
    const dbStart = Date.now();
    try {
      const { connection } = await import('mongoose');
      if (connection.readyState === 1) {
        const db = connection.db;
        await db?.admin().ping();
        checks.mongodb = { status: 'ok', latencyMs: Date.now() - dbStart };
      } else {
        checks.mongodb = { status: 'disconnected' };
      }
    } catch {
      checks.mongodb = { status: 'error', latencyMs: Date.now() - dbStart };
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok');

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'healthy' : 'degraded',
      checks,
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
      },
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}

export async function getAuditLogs(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const page = parseInt(String(req.query.page || '1'), 10);
    const limit = parseInt(String(req.query.limit || '50'), 10);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.userId) filter.userId = req.query.userId;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email'),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit });
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({ error: error.message });
  }
}
