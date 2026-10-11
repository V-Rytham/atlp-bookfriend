# BookFriend

An AI reading companion for **After the Last Page**, my book platform. Readers can discuss characters, themes and passages, with replies grounded in retrieved book excerpts when available.

**Stack:** Node.js · Express · MongoDB Atlas Vector Search · Transformers.js · Groq

## How it works

- Imports Project Gutenberg books, splits them into chapters and chunks, and generates 384-dimensional BGE embeddings.
- Retrieves relevant excerpts for each message. When `chapter_progress` is supplied, retrieval excludes later chapters and prioritizes excerpts closer to the reader's progress.
- Combines excerpts, book metadata and recent conversation history to generate a reply through Groq.
- Falls back to metadata-based discussion when a book is unindexed or retrieval is unavailable.
- Stores conversations in MongoDB with capped history and TTL cleanup.

Chapter filtering and prompts help reduce spoilers; they do not guarantee spoiler-free replies.

## Run locally

```bash
git clone https://github.com/V-Rytham/atlp-bookfriend.git
cd atlp-bookfriend
npm ci
cp .env.example .env
```

Set `MONGODB_URI` in `.env`. For generated replies, set `BOOKFRIEND_LLM_PROVIDER=groq` and add your `GROQ_API_KEY`. The example defaults to `mock`, which returns canned responses for development.

```bash
npm start
curl http://localhost:5050/health
```

MongoDB is required for chat sessions. The example uses port `5050`; without a configured port, the server uses `10000`.

### Enable book retrieval

```bash
npm run ingest:book -- 1342
```

Ingestion downloads the embedding model on first use. In Atlas, create a Vector Search index named `book_chunks_embedding` on the `book_chunks` collection: a 384-dimensional vector field at `embedding`, plus filter fields `gutenbergId` and `chapterIndex`.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/agent/start` | Create a session with `user_id`, `book_id` and optional `book_title` / `book_author` |
| POST | `/agent/message` | Send `session_id`, `message` and optional `chapter_progress` |
| POST | `/agent/end` | Delete a session using `session_id` |
| GET | `/agent/book/:gutenbergId/status` | Check whether a book is indexed |
| GET | `/health` | Check database connectivity and the selected LLM provider |

## Structure

`src/controllers` coordinates chat; `src/services` handles ingestion, retrieval, prompts, LLM calls and sessions; `src/models` defines MongoDB records.

This is a backend service for the main platform. Its routes do not implement authentication.
