import mongoose from 'mongoose';
import { Book } from '../../models/Book.js';
import { BookChunk } from '../../models/BookChunk.js';
import { connectDB } from '../../config/db.js';
import { loadBookFriendEnv } from '../../config/env.js';
import { fetchGutenbergText } from './gutenberg.js';
import { splitIntoChapters } from './chapters.js';
import { chunkChapterText } from './chunking.js';
import { embedText } from '../retrieval/embeddingService.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const id = Number(args[0]);
  if (!Number.isFinite(id) || id <= 0) throw new Error('Usage: node src/scripts/ingestBook.js <gutenbergId>');
  return { gutenbergId: id };
};

export const ingestBook = async (gutenbergId) => {
  loadBookFriendEnv();
  await connectDB();

  const text = await fetchGutenbergText(gutenbergId);
  const chapters = splitIntoChapters(text);

  // Basic metadata guess from header lines if present; allow override later via manual edits.
  const titleGuess = `Gutenberg ${gutenbergId}`;

  const book = await Book.findOneAndUpdate(
    { gutenbergId },
    { $set: { gutenbergId, title: titleGuess, indexed: false, chapterCount: chapters.length } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Clear existing chunks (re-ingestion).
  await BookChunk.deleteMany({ gutenbergId });

  let globalChunkIndex = 0;
  const docs = [];

  for (const chapter of chapters) {
    const chapterChunks = chunkChapterText({ chapterText: chapter.text });
    let chapterOffset = 0;

    for (const chunk of chapterChunks) {
      globalChunkIndex += 1;
      const embedding = await embedText(chunk.text);
      const startOffset = chapterOffset;
      const endOffset = chapterOffset + chunk.text.length;
      chapterOffset = endOffset;

      docs.push({
        bookId: book._id,
        gutenbergId,
        chunkIndex: globalChunkIndex,
        chapterIndex: chapter.chapterIndex,
        chapterTitle: chapter.chapterTitle,
        text: chunk.text,
        embedding,
        tokenCount: chunk.tokenCount,
        startOffset,
        endOffset,
        createdAt: new Date(),
      });

      // Bulk insert in batches to keep memory stable.
      if (docs.length >= 200) {
        await BookChunk.insertMany(docs, { ordered: false });
        docs.length = 0;
      }
    }
  }

  if (docs.length) await BookChunk.insertMany(docs, { ordered: false });

  await Book.updateOne({ _id: book._id }, { $set: { indexed: true } });

  return { gutenbergId, chunks: globalChunkIndex, chapters: chapters.length };
};

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const { gutenbergId } = parseArgs();
  ingestBook(gutenbergId)
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('[BOOKFRIEND][INGEST] Done:', result);
      return mongoose.disconnect();
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[BOOKFRIEND][INGEST] Failed:', error);
      process.exitCode = 1;
    });
}
