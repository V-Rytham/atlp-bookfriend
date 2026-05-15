export const normalizeNewlines = (text) => String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

export const stripGutenbergBoilerplate = (text) => {
  const raw = normalizeNewlines(text);
  const startMatch = raw.match(/\*\*\*\s*START OF (THIS|THE) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const endMatch = raw.match(/\*\*\*\s*END OF (THIS|THE) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);

  if (startMatch && endMatch && startMatch.index < endMatch.index) {
    const body = raw.slice(startMatch.index + startMatch[0].length, endMatch.index);
    return body.trim();
  }

  return raw.trim();
};

export const collapseWhitespace = (text) => normalizeNewlines(text)
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

