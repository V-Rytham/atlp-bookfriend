# BookFriend Agent Service — SERVICE_TESTING_GUIDE

## A. Service Overview

**Purpose**
- Provides “BookFriend” conversational agent sessions.
- Supports optional RAG retrieval from MongoDB-stored book chunks when a book is indexed.
- Intended to be called by the core API’s `/api/agent/*` endpoints (or directly for development).

**Main responsibilities**
- Session lifecycle: start → message → end
- Retrieve relevant book chunks for a query (when indexed)
- Generate an agent reply using an LLM provider (mock or Groq)

**Port**
- Example `.env.example` uses `5050`
- `server.js` defaults to `10000` if `PORT` is not set

**Environment variables**
See `D:\After The Last Page\atlp-services\bookfriend-service\bookfriend-server\.env.example`.

Key variables:
- `PORT`
- `MONGODB_URI` (or `MONGO_URI`)
- `CLIENT_URL` (optional; influences allowed CORS origins)
- LLM provider:
  - `BOOKFRIEND_LLM_PROVIDER` (`mock` or `groq`)
  - `GROQ_API_KEY` (when provider is `groq`)
  - `BOOKFRIEND_GROQ_MODEL`, `BOOKFRIEND_GROQ_FALLBACK_MODEL`
- RAG/session tuning:
  - `BOOKFRIEND_MAX_HISTORY`
  - `BOOKFRIEND_RETRIEVAL_TOPK`
  - `BOOKFRIEND_MAX_MESSAGES_PER_SESSION`
  - `BOOKFRIEND_SESSION_TTL_MS`
  - `BOOKFRIEND_ATLAS_VECTOR_INDEX`

**Dependencies**
- MongoDB (recommended; service can start in degraded mode without DB)
- Optional Groq API (if LLM provider is configured to `groq`)

## B. Startup Instructions

### Installation
From `D:\After The Last Page\atlp-services\bookfriend-service\bookfriend-server`:
- `npm install`

### Configure env
- Copy `.env.example` → `.env`
- For local dev with mock LLM:
```env
PORT=5050
MONGODB_URI=mongodb://localhost:27017/after_the_last_page
BOOKFRIEND_LLM_PROVIDER=mock
```

### Run
- Start: `npm run start`

### Seed/setup (optional ingestion)
This service includes ingestion scripts:
- `npm run ingest:book`
- `npm run ingest:many`

These scripts populate book chunk embeddings for retrieval/RAG.

## C. API Endpoint Documentation

**Base URL (local default)**: `http://localhost:5050`

### Common headers
- `Content-Type: application/json`

### `GET /health`

| Item | Details |
|---|---|
| Purpose | Liveness + degraded-mode check |
| Auth | None |
| Success | `200` when DB connected; `503` when DB disconnected (degraded) |

Sample request
```bash
curl -s http://localhost:5050/health
```

Sample response (shape)
```json
{
  "status": "ok",
  "service": "bookfriend-agent-server",
  "llm_provider": "mock",
  "database": { "connected": true, "error": null }
}
```

### `POST /agent/start`

| Item | Details |
|---|---|
| Purpose | Create a new agent session |
| Auth | None (expected internal) |
| Body schema | `{ "user_id": string, "book_id": string|number }` |
| Success | `201` with `{ "session_id": string }` |
| Failures | `400` missing fields, invalid book id |

Validation rules (implemented)
- `user_id` and `book_id` are required.
- `book_id` must be a Gutenberg id (supports formats: `1342`, `g1342`, `gutenberg:1342`).

Sample request
```bash
curl -s -X POST http://localhost:5050/agent/start \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"u123\",\"book_id\":\"gutenberg:1342\"}"
```

### `POST /agent/message`

| Item | Details |
|---|---|
| Purpose | Send a message to an existing session and get an agent response |
| Body schema | `{ \"session_id\": string, \"message\": string, \"chapter_progress\"?: number }` |
| Success | `200` with `{ \"response\": string }` |
| Failures | `400` missing fields, `404` session missing/expired |

Validation rules (implemented)
- `session_id` and `message` are required.

Sample request
```bash
curl -s -X POST http://localhost:5050/agent/message \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"<session>\",\"message\":\"Summarize chapter 1\"}"
```

### `POST /agent/end`

| Item | Details |
|---|---|
| Purpose | Delete/close a session |
| Body schema | `{ \"session_id\": string }` |
| Success | `200` with `{ message: \"Session deleted.\" }` |
| Failures | `400` missing session_id, `404` session not found |

### `GET /agent/book/:gutenbergId/status`

| Item | Details |
|---|---|
| Purpose | Check if a Gutenberg book is indexed for RAG |
| Path param | `gutenbergId` (supports `1342`, `g1342`, `gutenberg:1342`) |
| Success | `200` with `{ indexed:boolean, ragEnabled:boolean }` |
| Failures | `400` invalid id |

## D. Testing Instructions

### End-to-end session test (curl)
1. Start session:
   - `POST /agent/start` → capture `session_id`
2. Send message:
   - `POST /agent/message`
3. End session:
   - `POST /agent/end`

### Expected success results
- Start: `201` + session id
- Message: `200` + response string
- End: `200` + confirmation

### Expected failure results
- Missing `user_id` or `book_id`: `400`
- Missing `session_id`: `400`
- Session expired: `404` (“Session not found or expired.”)

### Edge cases
- Very large `message` payload (request body limit is `200kb`)
- High request rate (in-memory rate limiter returns `429`)
- DB down: `/health` returns `503` and the service may run in degraded mode

## E. Validation Analysis

What exists
- Required fields validation for session lifecycle endpoints.
- `gutenbergId` parsing is relatively strict.

Missing/weak validation
- No max-length cap for `message` (beyond global body-size limit).
- `user_id` is accepted as any truthy value; consider enforcing shape/length.

Security concerns
- No authentication. If exposed publicly, this becomes an abuse target.
- CORS allows `.onrender.com` and localhost; validate this is intended.

## F. Error Handling Analysis

What exists
- Centralized error middleware:
  - Handles malformed JSON (`400` “Malformed JSON payload.”)
  - Converts arbitrary errors to safe JSON (`message`, optionally `error` in dev/expose mode)

Potential issues
- Some controller methods do not wrap all operations in try/catch; thrown errors should be caught by error middleware but ensure async errors are propagated correctly.
- Optional `BOOKFRIEND_EXPOSE_ERRORS=1` can leak internal error messages.

## G. Architecture Notes

Folder structure
- `server.js` — boot: env load, DB connect (optional), start server
- `src/app.js` — Express app + CORS + rate limiting + routes + centralized error handler
- `src/routes/agentRoutes.js` — agent endpoints
- `src/controllers/agentController.js` — session lifecycle + retrieval + LLM reply
- `src/services/` — sessions, retrieval, prompt building, LLM provider logic
- `src/models/` — Mongo models (`Book`, session storage, chunks, etc.)

Request lifecycle
`/agent/message` → loads session → appends message → optional retrieval → builds prompt → LLM reply → appends assistant message → response

