import mongoose, { Document, Schema } from 'mongoose';
import { DatasetSchema } from '../types';

export interface IDataset {
  _id: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  format: 'csv' | 'ndjson';
  size: number;
  estimatedRows: number;
  schema?: DatasetSchema;
  filePath: string;
  checksum: string;
  uploadedBy: mongoose.Types.ObjectId;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const FieldSchemaSchema = new Schema(
  {
    name: String,
    type: String,
    nullable: Boolean,
    nullPercentage: Number,
    uniqueCount: Number,
    min: Schema.Types.Mixed,
    max: Schema.Types.Mixed,
    sampleValues: [String],
    isPotentialPii: Boolean,
    overriddenType: String,
  },
  { _id: false }
);

const DatasetSchemaSchema = new Schema(
  {
    fields: [FieldSchemaSchema],
    totalFields: Number,
    sampleSize: Number,
    detectedAt: Date,
  },
  { _id: false }
);

const DatasetMongoSchema = new Schema<IDataset>(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    format: { type: String, enum: ['csv', 'ndjson'], required: true },
    size: { type: Number, required: true },
    estimatedRows: { type: Number, default: 0 },
    schema: DatasetSchemaSchema,
    filePath: { type: String, required: true },
    checksum: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['uploading', 'processing', 'ready', 'error'],
      default: 'uploading',
    },
    errorMessage: String,
    tags: [String],
  },
  { timestamps: true }
);

DatasetMongoSchema.index({ uploadedBy: 1, createdAt: -1 });
DatasetMongoSchema.index({ status: 1 });
DatasetMongoSchema.index({ checksum: 1 });

export const Dataset = mongoose.model<IDataset>('Dataset', DatasetMongoSchema);
