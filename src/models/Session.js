import mongoose from 'mongoose';
import { getSessionTtlMs } from '../config/env.js';

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    gutenbergId: { type: Number, default: null, index: true },
    ragEnabled: { type: Boolean, default: false },
    messages: { type: [messageSchema], default: [] },
    expiresAt: { type: Date, required: true, index: true },
  },
  { collection: 'sessions' },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

sessionSchema.statics.buildExpiresAt = function buildExpiresAt() {
  return new Date(Date.now() + getSessionTtlMs());
};

export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

