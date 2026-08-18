import { Queue } from 'bullmq';
import { config } from '../config';
import IORedis from 'ioredis';

// Create a shared Redis connection for the queue
const connection = new IORedis((config as any).redisUrl || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const pipelineQueue = new Queue('pipeline-jobs', {
  connection,
});

export async function enqueuePipelineRun(jobData: any) {
  return await pipelineQueue.add('run-pipeline', jobData, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
}
