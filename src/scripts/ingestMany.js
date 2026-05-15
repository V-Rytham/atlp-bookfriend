import { ingestBook } from '../services/ingestion/ingestBook.js';

// Usage:
//   node src/scripts/ingestMany.js 1342 1661 84
const ids = process.argv.slice(2).map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0);
if (!ids.length) {
  // eslint-disable-next-line no-console
  console.error('Usage: node src/scripts/ingestMany.js <id1> <id2> ...');
  process.exit(1);
}

for (const id of ids) {
  // eslint-disable-next-line no-console
  console.log(`[BOOKFRIEND][INGEST] Ingesting ${id}...`);
  await ingestBook(id);
}

