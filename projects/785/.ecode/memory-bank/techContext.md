# Tech Context – Stack & Setup

## Frontend (TypeScript + React)
- **Framework**: React 18 with functional components + hooks.
- **State management**: React Query (server state), local component state for UI; optional Zustand/Redux for global session.
- **UI**: Tailwind CSS or CSS-in-JS (e.g., Emotion) + headless components.
- **Streaming**: native EventSource (SSE) or WebSocket client.

## Backend (TypeScript/Node)
- **Runtime**: Node.js (LTS), Express/Fastify/NestJS (choose one; start simple with Express or Fastify).
- **OpenAI client**: official OpenAI Node SDK for GPT-5 chat completions with streaming.
- **Persistence**: PostgreSQL for users, conversations, memories, documents metadata.
- **Vector DB**: Pinecone / pgvector / Qdrant via dedicated SDK.
- **Storage**: Local filesystem in dev; S3-compatible object store in prod.

## Key Dependencies (indicative)
- `react`, `react-dom`, `@tanstack/react-query`, `axios`/`fetch` wrapper.
- `express` or `fastify`, `zod` for validation, `dotenv` for env handling.
- `openai` official SDK, vector DB client (e.g., `@pinecone-database/pinecone`).
- PDF/text parsers: `pdf-parse`, `mammoth` for DOCX, `remark` for MD.

## Environment Variables
- `OPENAI_API_KEY` – GPT-5 API.
- `VECTOR_DB_API_KEY` / `VECTOR_DB_URL` – vector store.
- `DATABASE_URL` – Postgres connection.
- `STORAGE_BUCKET` / `STORAGE_ENDPOINT` – document storage.
- `APP_BASE_URL` – external URL for CORS and callbacks.
- `NODE_ENV` – environment control.

## Development Setup
- Run Postgres + vector DB via Docker Compose.
- Separate `frontend` and `backend` packages; shared types in a common folder.
- Use ESLint + Prettier + TypeScript strict mode.
