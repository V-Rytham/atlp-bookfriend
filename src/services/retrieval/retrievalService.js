import mongoose from 'mongoose';
import { getMaxChunkChars, getVectorIndexName } from '../../config/env.js';
import { embedText } from './embeddingService.js';
import { isVectorSearchAvailable } from './vectorSearchSupport.js';

const clampInt = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const buildSpoilerFilter = (gutenbergId, chapterProgress) => {
  const filter = { gutenbergId: Number(gutenbergId) };
  if (chapterProgress == null) return filter;
  const progressNum = Number(chapterProgress);
  if (!Number.isFinite(progressNum)) return filter;
  filter.chapterIndex = { $lte: Math.floor(progressNum) };
  return filter;
};

export const retrieveRelevantChunksForQuery = async ({
  gutenbergId,
  query,
  chapterProgress,
  topK = 5,
}) => {
  const available = await isVectorSearchAvailable();
  if (!available) return [];

  const limit = clampInt(topK, 1, 10, 5);
  const queryVector = await embedText(query);
  const indexName = getVectorIndexName();
  const maxChunkChars = getMaxChunkChars();

  const filter = buildSpoilerFilter(gutenbergId, chapterProgress);
  const numCandidates = Math.min(200, Math.max(50, limit * 40));

  const coll = mongoose.connection.collection('book_chunks');
  const raw = await coll.aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector,
        numCandidates,
        limit,
        filter,
      },
    },
    {
      $project: {
        _id: 0,
        chapterIndex: 1,
        chapterTitle: 1,
        chunkIndex: 1,
        text: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]).toArray();

  const progressNum = Number.isFinite(Number(chapterProgress)) ? Math.floor(Number(chapterProgress)) : null;
  const reranked = raw
    .map((item) => ({
      chapterIndex: item.chapterIndex,
      chapterTitle: item.chapterTitle,
      chunkIndex: item.chunkIndex,
      text: String(item.text || '').slice(0, maxChunkChars),
      score: Number(item.score) || 0,
      proximity: progressNum == null ? 0 : Math.abs((Number(item.chapterIndex) || 0) - progressNum),
    }))
    .sort((a, b) => {
      if (a.proximity !== b.proximity) return a.proximity - b.proximity;
      return b.score - a.score;
    });

  return reranked.slice(0, limit);
};

