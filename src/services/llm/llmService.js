import { resolveLlmProvider, getGroqFallbackModel, getGroqModel } from '../../config/env.js';

const getGroqApiKey = () => process.env.GROQ_API_KEY || process.env.BOOKFRIEND_GROQ_API_KEY;

const buildUserPrompt = ({ bookMeta, retrievedChunks, history, userMessage, mode }) => {
  const formattedChunks = (retrievedChunks || [])
    .map((chunk, index) => {
      const chapterLabel = chunk.chapterIndex == null ? 'unknown' : String(chunk.chapterIndex);
      const title = chunk.chapterTitle ? ` — ${chunk.chapterTitle}` : '';
      return `(${index + 1}) [chapter ${chapterLabel}${title}] ${chunk.text}`;
    })
    .join('\n\n');

  const formattedHistory = (history || [])
    .map((item) => `${String(item.role || '').toUpperCase()}: ${item.content}`)
    .join('\n');

  const meta = JSON.stringify(bookMeta || {}, null, 2);

  if (mode === 'rag') {
    return `Book metadata:\n${meta}\n\nRetrieved excerpts:\n${formattedChunks || 'No excerpts available.'}\n\nRecent conversation:\n${formattedHistory || 'No prior messages.'}\n\nReader message:\n${userMessage}`;
  }

  return `Book metadata (may be incomplete):\n${meta}\n\nRecent conversation:\n${formattedHistory || 'No prior messages.'}\n\nReader message:\n${userMessage}`;
};

const buildMockResponse = ({ userMessage, bookMeta }) => {
  const trimmed = String(userMessage || '').trim();
  const seed = trimmed.toLowerCase();
  const title = bookMeta?.title || 'this book';

  if (seed.length <= 8) return `Interesting. In ${title}, what feeling does that moment leave you with right now?`;
  if (seed.includes('?')) return `Good question. What details from the passage stand out most to you there?`;
  return `That’s a thoughtful take. What do you think that moment suggests about the character’s deeper motivation?`;
};

const groqChat = async ({ apiKey, model, systemPrompt, userPrompt, temperature }) => {
  const response = await fetch(process.env.BOOKFRIEND_GROQ_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Groq request failed: ${response.status} ${text}`);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
};

export const generateAgentReply = async ({ systemPrompt, mode, bookMeta, retrievedChunks, history, userMessage }) => {
  const { provider } = resolveLlmProvider();
  const userPrompt = buildUserPrompt({ bookMeta, retrievedChunks, history, userMessage, mode });

  if (provider === 'groq') {
    const apiKey = getGroqApiKey();
    if (!apiKey) throw new Error('GROQ_API_KEY is missing for BOOKFRIEND_LLM_PROVIDER=groq.');

    const temperature = 0.75;
    const primary = getGroqModel();
    const fallback = getGroqFallbackModel();

    try {
      const content = await groqChat({ apiKey, model: primary, systemPrompt, userPrompt, temperature });
      return content || buildMockResponse({ userMessage, bookMeta });
    } catch (error) {
      const status = Number(error?.statusCode || 0);
      const shouldFallback = status === 400 || status === 413 || status === 429 || status >= 500;
      if (!shouldFallback || !fallback || fallback === primary) throw error;

      const content = await groqChat({ apiKey, model: fallback, systemPrompt, userPrompt, temperature });
      return content || buildMockResponse({ userMessage, bookMeta });
    }
  }

  if (provider === 'mock') return buildMockResponse({ userMessage, bookMeta });

  throw new Error(`Unsupported BOOKFRIEND_LLM_PROVIDER="${provider}". Use one of: mock, groq.`);
};

