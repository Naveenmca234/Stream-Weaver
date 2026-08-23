import { Worker } from 'node:worker_threads';
import path from 'node:path';

class JobManager {
  private workers = new Map<string, Worker>();
  private io: any = null;

  setIo(ioInstance: any) {
    this.io = ioInstance;
  }

  startJob(jobId: string) {
    if (this.workers.has(jobId)) {
      throw new Error('Job is already running');
    }

    const workerPath = path.resolve(__dirname, './jobWorker.ts');
    
    // Use tsx or ts-node in development to run ts files directly, 
    // but typically we run compiled js in production.
    // For simplicity in this demo environment, we will pass execArgv to support TS if needed,
    // or just run via the standard pipeline inside the main process if worker_threads + TS is tricky.
    // Assuming tsx/ts-node registers automatically if we require it.
    const worker = new Worker(workerPath, {
      workerData: { jobId },
      execArgv: process.env.NODE_ENV !== 'production' ? ['--require', 'tsx'] : []
    });

    worker.on('message', (msg) => {
      if (msg.type === 'socket' && this.io) {
        this.io.to(msg.room).emit(msg.event, msg.data);
      }
    });

    worker.on('error', (err) => {
      console.error(`Worker error for job ${jobId}:`, err);
      this.workers.delete(jobId);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
      this.workers.delete(jobId);
    });

    this.workers.set(jobId, worker);
  }

  cancelJob(jobId: string) {
    const worker = this.workers.get(jobId);
    if (worker) {
      // Terminate the worker thread immediately.
      worker.terminate();
      this.workers.delete(jobId);
      return true;
    }
    return false;
  }
}

export const jobManager = new JobManager();
