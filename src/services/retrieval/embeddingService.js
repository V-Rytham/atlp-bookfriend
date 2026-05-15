import { getEmbeddingDim, getEmbeddingModelId } from '../../config/env.js';

let extractorPromise = null;

const l2Normalize = (vector) => {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < vector.length; i += 1) vector[i] /= norm;
  return vector;
};

const toFloatArray = (arr) => {
  const out = Array.from(arr, (v) => Number(v) || 0);
  return out;
};

const loadExtractor = async () => {
  if (extractorPromise) return extractorPromise;

  extractorPromise = (async () => {
    const { pipeline, env } = await import('@xenova/transformers');

    // Keep this conservative for low-memory deployments.
    env.allowLocalModels = false;
    env.useBrowserCache = false;

    const modelId = getEmbeddingModelId();
    const extractor = await pipeline('feature-extraction', modelId, {
      quantized: true,
    });
    return extractor;
  })();

  return extractorPromise;
};

export const embedText = async (text) => {
  const expectedDim = getEmbeddingDim();
  const extractor = await loadExtractor();

  const input = String(text || '').trim();
  if (!input) {
    return new Array(expectedDim).fill(0);
  }

  // For bge-* models, mean pooling + normalization is the standard.
  const output = await extractor(input, { pooling: 'mean', normalize: true });
  const data = output?.data;
  if (!data || data.length !== expectedDim) {
    const vector = toFloatArray(data || []);
    if (vector.length !== expectedDim) {
      throw new Error(`Embedding dim mismatch. Expected ${expectedDim}, got ${vector.length}.`);
    }
    return l2Normalize(vector);
  }

  return toFloatArray(data);
};

