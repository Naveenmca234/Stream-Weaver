import mongoose, { Document, Schema } from 'mongoose';

export interface IConnection extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: 'mongodb' | 'postgresql' | 'rest_api' | 's3';
  config: Record<string, unknown>;
  status: 'untested' | 'connected' | 'failed';
  lastTestedAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConnectionSchema = new Schema<IConnection>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['mongodb', 'postgresql', 'rest_api', 's3'], required: true },
    config: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['untested', 'connected', 'failed'], default: 'untested' },
    lastTestedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ConnectionSchema.index({ createdBy: 1 });

export const Connection = mongoose.model<IConnection>('Connection', ConnectionSchema);
