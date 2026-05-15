import { collapseWhitespace, stripGutenbergBoilerplate } from '../../utils/text.js';

export const fetchGutenbergText = async (gutenbergId) => {
  const id = Number(gutenbergId);
  if (!Number.isFinite(id) || id <= 0) throw new Error('Invalid gutenbergId.');

  // Prefer the "UTF-8" plain text endpoint.
  const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch Gutenberg text (${response.status}). ${text.slice(0, 200)}`);
  }
  const raw = await response.text();
  const cleaned = collapseWhitespace(stripGutenbergBoilerplate(raw));
  return cleaned;
};

