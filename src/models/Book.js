import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    gutenbergId: { type: Number, required: true, unique: true, index: true },
    title: { type: String, required: true },
    author: { type: String, default: '' },
    synopsis: { type: String, default: '' },
    tags: { type: [String], default: [] },
    indexed: { type: Boolean, default: false, index: true },
    chapterCount: { type: Number, default: 0 },
  },
  { collection: 'books', timestamps: true },
);

export const Book = mongoose.models.Book || mongoose.model('Book', bookSchema);

