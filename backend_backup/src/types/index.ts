export type UserRole = 'admin' | 'data_engineer' | 'analyst' | 'viewer';

export type Permission =
  | 'create_pipeline'
  | 'edit_pipeline'
  | 'execute_pipeline'
  | 'delete_pipeline'
  | 'view_datasets'
  | 'upload_datasets'
  | 'manage_connections'
  | 'view_monitoring'
  | 'manage_users';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'create_pipeline',
    'edit_pipeline',
    'execute_pipeline',
    'delete_pipeline',
    'view_datasets',
    'upload_datasets',
    'manage_connections',
    'view_monitoring',
    'manage_users',
  ],
  data_engineer: [
    'create_pipeline',
    'edit_pipeline',
    'execute_pipeline',
    'view_datasets',
    'upload_datasets',
    'manage_connections',
    'view_monitoring',
  ],
  analyst: ['view_datasets', 'view_monitoring'],
  viewer: ['view_datasets'],
};

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
  detectedAt: Date;
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

export interface RunProgress {
  runId: string;
  status: RunStatus;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  throughput: number;
  etaSeconds: number;
  elapsedSeconds: number;
  memoryMb: number;
  cpuPercent: number;
  batchNumber: number;
  currentStage: string;
  dbLatencyMs: number;
  queueDepth: number;
  backpressureActive: boolean;
  startedAt: Date;
}

export type NodeType =
  | 'csv_input'
  | 'ndjson_input'
  | 'map_fields'
  | 'rename'
  | 'filter'
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'normalize'
  | 'replace'
  | 'parse_date'
  | 'format_date'
  | 'number_conversion'
  | 'conditional'
  | 'deduplicate'
  | 'custom_js'
  | 'required'
  | 'type_check'
  | 'regex'
  | 'email'
  | 'range'
  | 'length'
  | 'date_validation'
  | 'custom_rule'
  | 'mongodb_output'
  | 'file_output';

export interface PipelineNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  label: string;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface PipelineGraph {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  version: number;
  settings: Record<string, unknown>;
}

export interface ValidationError {
  rowNumber: number;
  field: string;
  value: unknown;
  stage: string;
  error: string;
  timestamp: Date;
}

export interface BatchResult {
  batchNumber: number;
  inserted: number;
  updated: number;
  failed: number;
  latencyMs: number;
}

export interface WebSocketEvent {
  type:
    | 'run.started'
    | 'run.progress'
    | 'run.stage'
    | 'run.batch'
    | 'run.error'
    | 'run.warning'
    | 'run.completed'
    | 'run.failed'
    | 'run.cancelled'
    | 'system.metrics';
  payload: unknown;
}

export interface SystemMetrics {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
  cpuPercent: number;
  activeRuns: number;
  queueDepth: number;
  timestamp: Date;
}
