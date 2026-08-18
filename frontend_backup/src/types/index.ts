export type UserRole = 'admin' | 'data_engineer' | 'analyst' | 'viewer';

export type FieldType =
  | 'string'
  | 'integer'
  | 'float'
  | 'boolean'
  | 'date'
  | 'null'
  | 'array'
  | 'object'
  | 'unknown';

export interface FieldSchema {
  name: string;
  type: FieldType;
  nullable: boolean;
  nullPercentage: number;
  uniqueCount: number;
  min?: string | number;
  max?: string | number;
  sampleValues: string[];
  isPotentialPii: boolean;
  overriddenType?: FieldType;
}

export interface DatasetSchema {
  fields: FieldSchema[];
  totalFields: number;
  sampleSize: number;
  detectedAt: string;
}

export interface Dataset {
  _id: string;
  filename: string;
  originalName: string;
  format: 'csv' | 'ndjson';
  size: number;
  estimatedRows: number;
  schema?: DatasetSchema;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  uploadedBy: { _id: string; name: string; email: string };
  createdAt: string;
}

export type RunStatus =
  | 'QUEUED'
  | 'UPLOADING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'COMPLETED_WITH_WARNINGS'
  | 'FAILED'
  | 'CANCELLED';

export interface PipelineRun {
  _id: string;
  runId: string;
  pipelineId: any;
  pipelineVersionId: string;
  datasetId: any;
  status: RunStatus;
  triggeredBy: { _id: string; name: string; email: string };
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  peakMemoryMb: number;
  avgThroughput: number;
  durationMs: number;
  lastBatchNumber: number;
  lastCheckpoint: number;
  currentStage: string;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Pipeline {
  _id: string;
  name: string;
  description: string;
  tags: string[];
  currentVersion: number;
  status: 'draft' | 'published' | 'archived';
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface Connection {
  _id: string;
  name: string;
  type: 'mongodb' | 'postgresql' | 'rest_api' | 's3';
  config: any;
  status: 'untested' | 'connected' | 'failed';
  lastTestedAt?: string;
  createdBy: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface SystemMetrics {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  uptime: number;
  wsClients: number;
}
