import mongoose, { Document, Schema } from 'mongoose';
import { UserRole } from '../types';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  refreshTokens: string[];
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['admin', 'data_engineer', 'analyst', 'viewer'],
      default: 'analyst',
    },
    refreshTokens: [{ type: String, select: false }],
    lastLoginAt: Date,
  },
  { timestamps: true }
);

UserSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
