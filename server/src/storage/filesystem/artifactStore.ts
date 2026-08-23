import path from 'path';
import fs from 'fs';

const STORAGE_ROOT = path.resolve(__dirname, '../../../../storage');

const DIRS = {
  uploads: path.join(STORAGE_ROOT, 'uploads'),
  processing: path.join(STORAGE_ROOT, 'processing'),
  outputs: path.join(STORAGE_ROOT, 'outputs'),
  failed: path.join(STORAGE_ROOT, 'failed'),
  reports: path.join(STORAGE_ROOT, 'reports'),
  logs: path.join(STORAGE_ROOT, 'logs'),
  temp: path.join(STORAGE_ROOT, 'temp'),
};

export const ArtifactStore = {
  init() {
    Object.values(DIRS).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  },

  getUploadPath(jobId: string, filename: string) {
    const jobDir = path.join(DIRS.uploads, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    return path.join(jobDir, filename);
  },

  getOutputPath(jobId: string, filename: string) {
    const jobDir = path.join(DIRS.outputs, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    return path.join(jobDir, filename);
  },

  getFailedPath(jobId: string) {
    const jobDir = path.join(DIRS.failed, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    return path.join(jobDir, 'failed.csv');
  },

  getReportPath(jobId: string) {
    const jobDir = path.join(DIRS.reports, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    return path.join(jobDir, 'report.json');
  },

  getLogPath(jobId: string) {
    const jobDir = path.join(DIRS.logs, jobId);
    if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });
    return path.join(jobDir, 'job.log');
  },

  async cleanupJob(jobId: string) {
    for (const dir of Object.values(DIRS)) {
      const jobDir = path.join(dir, jobId);
      try {
        await fs.promises.rm(jobDir, { recursive: true, force: true });
      } catch (e) {
        // ignore
      }
    }
  }
};
