import { workerData, parentPort } from 'node:worker_threads';
import { runETLJob } from '../services/etl/pipeline';

const { jobId } = workerData;

async function execute() {
  try {
    // Mock the socket.io interface to forward events to the parent thread
    const ioMock = {
      to: (room: string) => ({
        emit: (event: string, data: any) => {
          if (parentPort) {
            parentPort.postMessage({ type: 'socket', room, event, data });
          }
        }
      })
    };

    await runETLJob(jobId, ioMock);
    
    if (parentPort) {
      parentPort.postMessage({ type: 'completed' });
    }
  } catch (error) {
    if (parentPort) {
      parentPort.postMessage({ type: 'failed', error: String(error) });
    }
  }
}

execute();
