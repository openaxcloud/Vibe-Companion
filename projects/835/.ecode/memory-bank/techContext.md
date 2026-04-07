# Tech Context – Stack & Setup

## Stack
- **Frontend**: React + TypeScript
  - Bundler: Vite or CRA (prefer Vite for performance).
  - UI: TailwindCSS or component library (e.g., MUI/Chakra) + custom chat components.
  - State: React Query (server state) + lightweight store (Zustand/Redux Toolkit).
- **Backend** (reference stack; adjust as needed)
  - Node.js + TypeScript, Fastify or NestJS.
  - REST or GraphQL API, plus SSE/WebSocket endpoint for streaming.
  - Background jobs (BullMQ / simple queue) for heavy ingestion tasks.
- **Data & Infra**
  - Postgres for relational data.
  - Vector DB: Pinecone, Weaviate, Qdrant, or pgvector.
  - Object storage (S3-compatible) for raw uploaded files.

## Key Dependencies (indicative)
- openai (GPT-5 client when available) or @ai-sdk/openai wrapper.
- LangChain / custom minimal RAG utilities for chunking & retrieval.
- File handling: react-dropzone / native input, backend multer/busboy.
- Auth: NextAuth/Auth0 or custom JWT-based auth.

## Environment Variables (examples)
- `OPENAI_API_KEY` – GPT-5 access.
- `MODEL_NAME` – e.g., `gpt-5-chat` (configurable).
- `DATABASE_URL` – Postgres connection.
- `VECTOR_DB_URL` / `VECTOR_DB_API_KEY` – vector store.
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` – file storage.
- `JWT_SECRET` / `AUTH_SECRET` – auth signing.
- `APP_BASE_URL` – public URL for redirects and callbacks.

## Dev Setup (high-level)
- Node 20+, pnpm/yarn for package management.
- Mono-repo or two separate projects: `/frontend` (React) and `/backend` (API).
- Local Docker compose for Postgres + vector DB.
