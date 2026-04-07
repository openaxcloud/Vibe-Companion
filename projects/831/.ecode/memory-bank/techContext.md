# Tech Context – Stack & Setup

## Tech Stack
- **Frontend**: React 18+, TypeScript, Vite or Next.js (SPA w/ streaming-capable API routes).
- **Backend**: Node.js (>=18), TypeScript, Express or NestJS.
- **Vector Store**: PostgreSQL + pgvector, or external (Pinecone/Weaviate/Qdrant) via repository interface.
- **Auth**: Simple JWT/session-based auth; pluggable for future OAuth.
- **Styling/UI**: Tailwind CSS or CSS-in-JS, basic component library (e.g., Radix UI) if desired.

## Key Dependencies
- `openai` – GPT-5 and embeddings.
- `langchain` or light custom utilities – for document loaders, chunking, and RAG pipelines (optional).
- `multer` or similar – file upload handling.
- `pdf-parse` / `unpdf` or equivalent – PDF text extraction.
- `pg`, `pgvector` (or vendor SDK) – vector store access.
- `zod` or `yup` – runtime validation.
- `socket.io` or `express-sse` – streaming transport.

## Environment Variables
- `OPENAI_API_KEY` – GPT-5 + embeddings access.
- `OPENAI_API_BASE` (optional) – override endpoint if using gateway.
- `DB_URL` – Postgres / database connection string.
- `VECTOR_DB_URL` / `VECTOR_DB_API_KEY` – if using external vector DB.
- `JWT_SECRET` – auth token signing.
- `FILE_STORAGE_BUCKET` / `FILE_STORAGE_PATH` – for raw document storage.
- `NODE_ENV`, `PORT`, `APP_BASE_URL` – runtime config.

## Dev Setup
- Node 18+ and pnpm/yarn/npm installed.
- Run `pnpm install` (or equivalent) in root.
- Provide `.env.local` with required env vars.
- Start dev: `pnpm dev` (concurrently run frontend + backend or monorepo tooling).
- Optional: Docker compose for DB + pgvector in local development.