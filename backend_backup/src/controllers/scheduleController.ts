import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Schedule } from '../models/Schedule';

export async function listSchedules(req: AuthRequest, res: Response): Promise<void> {
  try {
    const schedules = await Schedule.find()
      .populate('pipelineId', 'name')
      .populate('datasetId', 'originalName')
      .populate('createdBy', 'name email');
    res.json(schedules);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function createSchedule(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { pipelineId, datasetId, name, type, cronExpression, timezone, startDate, endDate, retryPolicy, concurrencyLimit } = req.body;

    const schedule = await Schedule.create({
      pipelineId,
      datasetId,
      name,
      type: type || 'manual',
      cronExpression,
      timezone: timezone || 'UTC',
      startDate,
      endDate,
      retryPolicy: retryPolicy || { maxRetries: 3, backoffMs: 5000 },
      concurrencyLimit: concurrencyLimit || 1,
      createdBy: req.user!.id,
    });

    res.status(201).json(schedule);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function updateSchedule(req: AuthRequest, res: Response): Promise<void> {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!schedule) { res.status(404).json({ error: 'Schedule not found' }); return; }
    res.json(schedule);
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
}

export async function deleteSchedule(req: AuthRequest, res: Response): Promise<void> {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ message: 'Schedule deleted' });
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message });
  }
}
