import { Worker } from 'bullmq';
import { config } from '../config';
import IORedis from 'ioredis';

const connection = new IORedis((config as any).redisUrl || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const pipelineWorker = new Worker(
  'pipeline-jobs',
  async (job) => {
    const { runId, datasetId, pipelineId, userId } = job.data;
    console.log(`Worker processing job ${job.id} for run ${runId}`);
    return { success: true, runId };
  },
  { connection }
);

pipelineWorker.on('completed', (job) => {
  console.log(`Job ${job.id} has completed!`);
});

pipelineWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} has failed with ${err.message}`);
});
