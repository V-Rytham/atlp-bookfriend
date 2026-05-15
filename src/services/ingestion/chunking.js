import { estimateTokenCount } from '../../utils/tokenCount.js';

const splitParagraphs = (text) => String(text || '')
  .split(/\n{2,}/)
  .map((p) => p.trim())
  .filter(Boolean);

export const chunkChapterText = ({
  chapterText,
  targetTokens = 800,
  minTokens = 600,
  maxTokens = 900,
  overlapTokens = 120,
}) => {
  const paragraphs = splitParagraphs(chapterText);
  const chunks = [];

  let current = [];
  let currentTokens = 0;
  let offset = 0;

  const flush = () => {
    const text = current.join('\n\n').trim();
    if (!text) return;
    const tokenCount = estimateTokenCount(text);
    chunks.push({ text, tokenCount });
  };

  for (const para of paragraphs) {
    const paraTokens = estimateTokenCount(para);

    if (currentTokens + paraTokens > maxTokens && currentTokens >= minTokens) {
      flush();

      // Start next chunk with overlap. We rebuild overlap by walking back paragraphs.
      const overlap = [];
      let overlapCount = 0;
      for (let i = current.length - 1; i >= 0; i -= 1) {
        const t = estimateTokenCount(current[i]);
        if (overlapCount + t > overlapTokens) break;
        overlap.unshift(current[i]);
        overlapCount += t;
      }

      current = [...overlap];
      currentTokens = overlapCount;
    }

    current.push(para);
    currentTokens += paraTokens;
    offset += para.length + 2;

    // If a single paragraph is huge, force split by hard cut.
    if (currentTokens >= targetTokens && currentTokens >= minTokens) {
      flush();
      current = [];
      currentTokens = 0;
    }
  }

  if (current.length) flush();
  return chunks;
};

