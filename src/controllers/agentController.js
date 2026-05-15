import { Book } from '../models/Book.js';
import mongoose from 'mongoose';
import { appendMessage, createSession, endSession, getSessionById } from '../services/sessions/sessionService.js';
import { retrieveRelevantChunksForQuery } from '../services/retrieval/retrievalService.js';
import { generateAgentReply } from '../services/llm/llmService.js';
import { buildBookFriendPrompt } from '../services/prompt/promptService.js';
import { getMaxHistory, getRetrievalTopK } from '../config/env.js';

const parseGutenbergId = (value) => {
  if (value == null) return null;
  const raw = String(value).trim();
  const match = raw.match(/^([a-z0-9_-]+):(.+)$/i);
  if (match) {
    const [, sourceRaw, sourceIdRaw] = match;
    const source = String(sourceRaw || '').trim().toLowerCase();
    const sourceId = String(sourceIdRaw || '').trim();
    if (source === 'gutenberg' && /^\d+$/.test(sourceId)) return Number.parseInt(sourceId, 10);
  }

  const gMatch = raw.match(/^g?(\d+)$/i);
  if (gMatch) return Number.parseInt(gMatch[1], 10);
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  return null;
};

export const getBookStatus = async (req, res) => {
  const gutenbergId = parseGutenbergId(req.params?.gutenbergId);
  if (!gutenbergId) return res.status(400).json({ message: 'Invalid gutenbergId.' });

  const book = await Book.findOne({ gutenbergId }).select('indexed').lean();
  const indexed = Boolean(book?.indexed);

  res.json({ indexed, ragEnabled: indexed });
};

export const startAgentSession = async (req, res) => {
  const { user_id: userId, book_id: bookId } = req.body || {};
  if (!userId || !bookId) return res.status(400).json({ message: 'user_id and book_id are required.' });

  let gutenbergId = parseGutenbergId(bookId);
  if (!gutenbergId && mongoose.Types.ObjectId.isValid(String(bookId))) {
    const bookById = await Book.findById(String(bookId)).select('gutenbergId indexed').lean();
    gutenbergId = bookById?.gutenbergId || null;
  }
  if (!gutenbergId) return res.status(400).json({ message: 'book_id must be a Gutenberg id (e.g. 1342).' });

  const book = await Book.findOne({ gutenbergId }).select('indexed').lean();
  const ragEnabled = Boolean(book?.indexed);

  const sessionId = await createSession({ userId, gutenbergId, ragEnabled });
  return res.status(201).json({ session_id: sessionId });
};

export const sendAgentMessage = async (req, res) => {
  const { session_id: sessionId, message, chapter_progress: chapterProgress } = req.body || {};
  if (!sessionId || !message) return res.status(400).json({ message: 'session_id and message are required.' });

  const session = await getSessionById(sessionId);
  if (!session) return res.status(404).json({ message: 'Session not found or expired.' });

  await appendMessage({ sessionId, role: 'user', content: String(message) });

  const gutenbergId = session?.gutenbergId;
  const ragEnabled = Boolean(session?.ragEnabled && gutenbergId != null);

  const topK = getRetrievalTopK();
  const maxHistory = getMaxHistory();

  let bookMeta = null;
  let retrievedChunks = [];

  if (gutenbergId != null) {
    bookMeta = await Book.findOne({ gutenbergId })
      .select('title author synopsis tags gutenbergId indexed chapterCount')
      .lean();
  }

  const effectiveRag = Boolean(bookMeta?.indexed) && Boolean(gutenbergId != null);

  if (effectiveRag) {
    try {
      retrievedChunks = await retrieveRelevantChunksForQuery({
        gutenbergId,
        query: String(message),
        chapterProgress,
        topK,
      });
    } catch {
      retrievedChunks = [];
    }
  }

  const promptPayload = buildBookFriendPrompt({
    mode: effectiveRag && retrievedChunks.length ? 'rag' : 'fallback',
    bookMeta,
    retrievedChunks,
    sessionMessages: session?.messages || [],
    userMessage: String(message),
    maxHistory,
  });

  const response = await generateAgentReply(promptPayload);
  await appendMessage({ sessionId, role: 'assistant', content: response });

  return res.json({ response });
};

export const endAgentSession = async (req, res) => {
  const { session_id: sessionId } = req.body || {};
  if (!sessionId) return res.status(400).json({ message: 'session_id is required.' });

  const deleted = await endSession(sessionId);
  if (!deleted) return res.status(404).json({ message: 'Session not found.' });

  return res.json({ message: 'Session deleted.' });
};
