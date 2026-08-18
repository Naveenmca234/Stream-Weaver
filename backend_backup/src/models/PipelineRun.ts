import mongoose, { Document, Schema } from 'mongoose';
import { RunStatus } from '../types';

export interface IPipelineRun extends Document {
  _id: mongoose.Types.ObjectId;
  runId: string;
  pipelineId: mongoose.Types.ObjectId;
  pipelineVersionId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  status: RunStatus;
  triggeredBy: mongoose.Types.ObjectId;
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
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PipelineRunSchema = new Schema<IPipelineRun>(
  {
    runId: { type: String, required: true, unique: true },
    pipelineId: { type: Schema.Types.ObjectId, ref: 'Pipeline', required: true },
    pipelineVersionId: { type: Schema.Types.ObjectId, ref: 'PipelineVersion', required: true },
    datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true },
    status: {
      type: String,
      enum: ['QUEUED', 'UPLOADING', 'RUNNING', 'PAUSED', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'CANCELLED'],
      default: 'QUEUED',
    },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    successfulRows: { type: Number, default: 0 },
    failedRows: { type: Number, default: 0 },
    peakMemoryMb: { type: Number, default: 0 },
    avgThroughput: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    lastBatchNumber: { type: Number, default: 0 },
    lastCheckpoint: { type: Number, default: 0 },
    currentStage: { type: String, default: 'QUEUED' },
    errorMessage: String,
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

PipelineRunSchema.index({ pipelineId: 1, createdAt: -1 });
PipelineRunSchema.index({ status: 1 });
PipelineRunSchema.index({ runId: 1 }, { unique: true });
PipelineRunSchema.index({ triggeredBy: 1, createdAt: -1 });

export const PipelineRun = mongoose.model<IPipelineRun>('PipelineRun', PipelineRunSchema);
