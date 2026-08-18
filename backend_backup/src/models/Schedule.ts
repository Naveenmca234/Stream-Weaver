import mongoose, { Document, Schema } from 'mongoose';

export interface ISchedule extends Document {
  _id: mongoose.Types.ObjectId;
  pipelineId: mongoose.Types.ObjectId;
  datasetId: mongoose.Types.ObjectId;
  name: string;
  type: 'manual' | 'hourly' | 'daily' | 'weekly' | 'cron';
  cronExpression?: string;
  timezone: string;
  startDate?: Date;
  endDate?: Date;
  retryPolicy: {
    maxRetries: number;
    backoffMs: number;
  };
  concurrencyLimit: number;
  enabled: boolean;
  nextRunAt?: Date;
  lastRunAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    pipelineId: { type: Schema.Types.ObjectId, ref: 'Pipeline', required: true },
    datasetId: { type: Schema.Types.ObjectId, ref: 'Dataset', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['manual', 'hourly', 'daily', 'weekly', 'cron'], default: 'manual' },
    cronExpression: String,
    timezone: { type: String, default: 'UTC' },
    startDate: Date,
    endDate: Date,
    retryPolicy: {
      maxRetries: { type: Number, default: 3 },
      backoffMs: { type: Number, default: 5000 },
    },
    concurrencyLimit: { type: Number, default: 1 },
    enabled: { type: Boolean, default: true },
    nextRunAt: Date,
    lastRunAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ScheduleSchema.index({ pipelineId: 1 });
ScheduleSchema.index({ nextRunAt: 1, enabled: 1 });

export const Schedule = mongoose.model<ISchedule>('Schedule', ScheduleSchema);
