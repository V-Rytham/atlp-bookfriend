import { BOOKFRIEND_FALLBACK_SYSTEM_PROMPT } from '../../prompts/fallbackSystemPrompt.js';
import { BOOKFRIEND_RAG_SYSTEM_PROMPT } from '../../prompts/ragSystemPrompt.js';

const buildRecentHistory = (messages, maxHistory) => {
  const safeMessages = Array.isArray(messages) ? messages : [];
  return safeMessages.slice(-maxHistory);
};

export const buildBookFriendPrompt = ({
  mode,
  bookMeta,
  retrievedChunks,
  sessionMessages,
  userMessage,
  maxHistory,
}) => {
  const meta = bookMeta ? {
    title: bookMeta?.title || 'Unknown title',
    author: bookMeta?.author || 'Unknown author',
    tags: bookMeta?.tags || [],
    synopsis: bookMeta?.synopsis || '',
    gutenbergId: bookMeta?.gutenbergId || null,
    chapterCount: bookMeta?.chapterCount || 0,
  } : {
    title: 'Unknown title',
    author: 'Unknown author',
    tags: [],
    synopsis: '',
    gutenbergId: null,
    chapterCount: 0,
  };

  return {
    systemPrompt: mode === 'rag' ? BOOKFRIEND_RAG_SYSTEM_PROMPT : BOOKFRIEND_FALLBACK_SYSTEM_PROMPT,
    mode,
    bookMeta: meta,
    retrievedChunks: Array.isArray(retrievedChunks) ? retrievedChunks : [],
    history: buildRecentHistory(sessionMessages, maxHistory),
    userMessage: String(userMessage || ''),
  };
};

