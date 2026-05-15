import { ingestBook } from '../services/ingestion/ingestBook.js';

const gutenbergId = Number(process.argv[2]);
if (!Number.isFinite(gutenbergId) || gutenbergId <= 0) {
  // eslint-disable-next-line no-console
  console.error('Usage: node src/scripts/ingestBook.js <gutenbergId>');
  process.exit(1);
}

await ingestBook(gutenbergId);

