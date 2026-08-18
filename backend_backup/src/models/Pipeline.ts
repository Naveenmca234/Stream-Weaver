import mongoose, { Document, Schema } from 'mongoose';
import { PipelineGraph } from '../types';

export interface IPipeline extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  tags: string[];
  currentVersion: number;
  status: 'draft' | 'published' | 'archived';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPipelineVersion extends Document {
  _id: mongoose.Types.ObjectId;
  pipelineId: mongoose.Types.ObjectId;
  version: number;
  graph: PipelineGraph;
  notes: string;
  publishedBy?: mongoose.Types.ObjectId;
  publishedAt?: Date;
  status: 'draft' | 'published';
  createdAt: Date;
}

const PipelineSchema = new Schema<IPipeline>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    tags: [String],
    currentVersion: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

PipelineSchema.index({ createdBy: 1, createdAt: -1 });
PipelineSchema.index({ status: 1 });

const PipelineVersionSchema = new Schema<IPipelineVersion>(
  {
    pipelineId: { type: Schema.Types.ObjectId, ref: 'Pipeline', required: true },
    version: { type: Number, required: true },
    graph: { type: Schema.Types.Mixed, required: true },
    notes: { type: String, default: '' },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  },
  { timestamps: true }
);

PipelineVersionSchema.index({ pipelineId: 1, version: -1 });

export const Pipeline = mongoose.model<IPipeline>('Pipeline', PipelineSchema);
export const PipelineVersion = mongoose.model<IPipelineVersion>(
  'PipelineVersion',
  PipelineVersionSchema
);
