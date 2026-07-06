import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    gutenbergId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    synopsis: { type: String, default: '' }, // Stores book desciption/summary
    tags: { type: [String], default: [] },
    indexed: { type: Boolean, default: false, index: true }, // If vector db indexing exists, indexed = true
    chapterCount: { type: Number, default: 0 },
  },
  { collection: 'books', timestamps: true },
);
// In serverless environments, models may get compiled multiple times, That cause `OverwriteModelError`, mongoose.models.Book is the solutoin
export const Book = mongoose.models.Book || mongoose.model('Book', bookSchema);

