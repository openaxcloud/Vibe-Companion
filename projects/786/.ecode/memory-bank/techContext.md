# Tech Context & Development Setup

## Core Stack
- **Frontend**: React 18+, TypeScript, Vite or Next.js (SPA/SSR as chosen), Tailwind or CSS-in-JS.
- **Backend**: Node.js 20+, TypeScript, Express or Fastify.
- **Database**: PostgreSQL 15+ with pgvector extension for embeddings (or dedicated vector DB).
- **AI**: OpenAI GPT-5 (chat/completions, embeddings) via official Node SDK.
- **File Storage**: S3-compatible bucket (AWS S3 / MinIO) for uploads.

## Key Dependencies (indicative)
- `openai` (official SDK), `zod` for schema validation.
- `pg`, `typeorm`/`prisma` for DB access.
- `multer`/`busboy` for file upload handling.
- `langchain` or custom RAG utilities (optional but helpful).
- `react-query` / `tanstack-query` for client data fetching.

## Dev Setup
- Node 20, pnpm/yarn for package management.
- Local Postgres with pgvector; local S3 emulator (e.g., MinIO) optional.
- `.env` for secrets; never commit to VCS.
- Run frontend and backend separately with hot reload.

## Environment Variables
- `OPENAI_API_KEY` – GPT-5 access.
- `OPENAI_MODEL_CHAT` – default chat model ID.
- `OPENAI_MODEL_EMBEDDING` – embedding model ID.
- `DATABASE_URL` – Postgres connection string.
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` – file storage.
- `JWT_SECRET` or auth provider keys for user authentication.
- `APP_BASE_URL`, `FRONTEND_URL`, `NODE_ENV`.
