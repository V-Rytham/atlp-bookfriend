import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let loaded = false;

const normalize = (value) => String(value || '')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .toLowerCase();

export const loadBookFriendEnv = () => {
  if (loaded) return;

  const candidates = [
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local'),
  ];

  const existingPaths = candidates.filter((envPath) => fs.existsSync(envPath));
  for (const envPath of existingPaths) {
    // Do not override explicit environment variables (Render / CI / shells).
    dotenv.config({ path: envPath, override: false });
  }
  if (!existingPaths.length) dotenv.config();

  loaded = true;
};

export const resolveLlmProvider = () => {
  const explicitProvider = normalize(process.env.BOOKFRIEND_LLM_PROVIDER);
  if (explicitProvider) return { provider: explicitProvider, source: 'env:BOOKFRIEND_LLM_PROVIDER' };

  if (process.env.GROQ_API_KEY || process.env.BOOKFRIEND_GROQ_API_KEY) {
    return { provider: 'groq', source: 'inferred:groq-key' };
  }

  return { provider: 'mock', source: 'default:fallback' };
};

export const getSessionTtlMs = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_SESSION_TTL_MS || '', 10);
  return Number.isFinite(parsed) && parsed > 60_000 ? parsed : (2 * 60 * 60_000);
};

export const getMaxHistory = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_MAX_HISTORY || '12', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
};

export const getRetrievalTopK = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_RETRIEVAL_TOPK || '5', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
};

export const getMaxChunkChars = () => {
  const parsed = Number.parseInt(process.env.BOOKFRIEND_MAX_CHUNK_CHARS || '1200', 10);
  return Number.isFinite(parsed) && parsed > 200 ? parsed : 1200;
};

export const getGroqModel = () => process.env.BOOKFRIEND_GROQ_MODEL || 'llama-3.3-70b-versatile';
export const getGroqFallbackModel = () => process.env.BOOKFRIEND_GROQ_FALLBACK_MODEL || 'llama-3.1-8b-instant';

export const getVectorIndexName = () => process.env.BOOKFRIEND_ATLAS_VECTOR_INDEX || 'book_chunks_embedding';
export const getEmbeddingModelId = () => process.env.BOOKFRIEND_EMBEDDING_MODEL || 'Xenova/bge-small-en-v1.5';
export const getEmbeddingDim = () => 384;
