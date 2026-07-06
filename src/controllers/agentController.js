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
  // Go through the books collection and find document based on indx and return just the value fo the field 'indexed' in simple JS object form
  const book = await Book.findOne({ gutenbergId }).select('indexed').lean();
  const indexed = Boolean(book?.indexed);

  res.json({ indexed, ragEnabled: indexed });
};

export const startAgentSession = async (req, res) => {
  const { user_id: userId, book_id: bookId, book_title: bookTitle, book_author: bookAuthor } = req.body || {};
  if (!userId || !bookId) return res.status(400).json({ message: 'user_id and book_id are required.' });

  let gutenbergId = parseGutenbergId(bookId);
  if (!gutenbergId && mongoose.Types.ObjectId.isValid(String(bookId))) {
    const bookById = await Book.findById(String(bookId)).select('gutenbergId indexed').lean();
    gutenbergId = bookById?.gutenbergId || null;
  }

  let ragEnabled = false;
  let title = String(bookTitle || '').trim();
  let author = String(bookAuthor || '').trim();

  if (gutenbergId) {
    // Gutenberg book: enable RAG when indexed, and backfill title/author from
    // the ingested Book record if the caller did not provide them.
    const book = await Book.findOne({ gutenbergId }).select('indexed title author').lean();
    ragEnabled = Boolean(book?.indexed);
    if (!title) title = String(book?.title || '').trim();
    if (!author) author = String(book?.author || '').trim();
  }

  // Non-Gutenberg (or unindexed) books are supported: the agent runs in
  // fallback / metadata-only mode using the title & author supplied at start.
  const sessionId = await createSession({
    userId,
    gutenbergId: gutenbergId || null,
    ragEnabled,
    bookId: String(bookId),
    title,
    author,
  });
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

  // Non-Gutenberg book (or a Gutenberg id with no ingested Book record): fall
  // back to the title/author captured on the session so the model still knows
  // which book it is discussing.
  if (!bookMeta) {
    bookMeta = {
      title: session?.title || 'Unknown title',
      author: session?.author || 'Unknown author',
      gutenbergId: null,
      indexed: false,
    };
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
