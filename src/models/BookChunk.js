import mongoose from 'mongoose';
import { getEmbeddingDim } from '../config/env.js';

const embeddingDim = getEmbeddingDim();

const bookChunkSchema = new mongoose.Schema(
  {
    bookId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'Book' },
    gutenbergId: { type: Number, required: true, index: true },
    chunkIndex: { type: Number, required: true },
    chapterIndex: { type: Number, required: true, index: true },
    chapterTitle: { type: String, default: '' },
    text: { type: String, required: true },
    embedding: {
      type: [Number],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === embeddingDim,
        message: `embedding must be length ${embeddingDim}`,
      },
      required: true,
    },
    tokenCount: { type: Number, default: 0 },
    startOffset: { type: Number, default: 0 },
    endOffset: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: 'book_chunks' },
);

bookChunkSchema.index({ gutenbergId: 1, chapterIndex: 1 });
bookChunkSchema.index({ bookId: 1, chapterIndex: 1 });

export const BookChunk = mongoose.models.BookChunk || mongoose.model('BookChunk', bookChunkSchema);

