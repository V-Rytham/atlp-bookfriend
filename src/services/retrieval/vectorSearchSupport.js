import mongoose from 'mongoose';
import { getEmbeddingDim, getVectorIndexName } from '../../config/env.js';

let cached = null;

export const isVectorSearchAvailable = async () => {
  if (cached != null) return cached;

  try {
    const coll = mongoose.connection.collection('book_chunks');
    const indexName = getVectorIndexName();
    const dim = getEmbeddingDim();
    // A minimal probe. If the stage or index is unavailable, Atlas will error.
    await coll.aggregate([
      {
        $vectorSearch: {
          index: indexName,
          path: 'embedding',
          queryVector: new Array(dim).fill(0),
          numCandidates: 1,
          limit: 1,
        },
      },
      { $limit: 1 },
      { $project: { _id: 1 } },
    ]).toArray();

    cached = true;
    return true;
  } catch {
    cached = false;
    return false;
  }
};
