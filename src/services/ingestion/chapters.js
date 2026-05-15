import { collapseWhitespace } from '../../utils/text.js';

const isChapterHeading = (line) => /^chapter\b/i.test(line.trim());

const parseChapterTitle = (headingLine) => headingLine.trim().replace(/\s+/g, ' ').slice(0, 120);

export const splitIntoChapters = (text) => {
  const lines = String(text || '').split('\n');
  const headings = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (isChapterHeading(lines[i])) headings.push({ line: i, title: parseChapterTitle(lines[i]) });
  }

  // If we can't find chapters, keep as a single chapter.
  if (headings.length < 2) {
    return [{ chapterIndex: 1, chapterTitle: 'Full Text', text: collapseWhitespace(text) }];
  }

  const chapters = [];
  for (let i = 0; i < headings.length; i += 1) {
    const startLine = headings[i].line;
    const endLine = i + 1 < headings.length ? headings[i + 1].line : lines.length;
    const chunk = lines.slice(startLine, endLine).join('\n');
    const body = collapseWhitespace(chunk);
    if (!body) continue;
    chapters.push({
      chapterIndex: i + 1,
      chapterTitle: headings[i].title || `Chapter ${i + 1}`,
      text: body,
    });
  }

  return chapters.length ? chapters : [{ chapterIndex: 1, chapterTitle: 'Full Text', text: collapseWhitespace(text) }];
};

