import mongoose, { Document, Schema } from 'mongoose';

export interface IRejectedRecord extends Document {
  _id: mongoose.Types.ObjectId;
  runId: string;
  rowNumber: number;
  field: string;
  value: unknown;
  stage: string;
  error: string;
  rawRecord: Record<string, unknown>;
  timestamp: Date;
}

const RejectedRecordSchema = new Schema<IRejectedRecord>(
  {
    runId: { type: String, required: true, index: true },
    rowNumber: { type: Number, required: true },
    field: { type: String, default: '' },
    value: { type: Schema.Types.Mixed },
    stage: { type: String, required: true },
    error: { type: String, required: true },
    rawRecord: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

RejectedRecordSchema.index({ runId: 1, timestamp: -1 });
RejectedRecordSchema.index({ runId: 1, stage: 1 });

export const RejectedRecord = mongoose.model<IRejectedRecord>(
  'RejectedRecord',
  RejectedRecordSchema
);
