# Tech Context – Stack & Setup

## Core Stack
- **Language**: TypeScript (strict mode).
- **Frontend**: React 18+, Vite or Next.js (app router if chosen).
- **Backend**: Node.js 20+, TypeScript; Next.js API routes or Express/Fastify.
- **UI**: Tailwind CSS or CSS-in-JS; component library (e.g., Radix UI/Headless UI).
- **Data Layer**:
  - DB: Postgres + Prisma ORM (or SQLite in dev).
  - Vector Store: pgvector extension, or external (Pinecone/Qdrant).

## Key Dependencies
- `openai` – official OpenAI client for GPT-5 + embeddings.
- `react`, `react-dom`, `@tanstack/react-query` (or SWR) for data fetching.
- `zod` or `yup` for runtime validation.
- `prisma` + `@prisma/client` for data access.
- Vector client (e.g., `@pinecone-database/pinecone` or `pg` for pgvector).
- File upload: `react-dropzone` (client), `multer`/`busboy`/Next.js upload route (server).

## Development Setup
- Node 20+, PNPM/Yarn/NPM; `.nvmrc` to pin version.
- Local Postgres (Docker compose) with pgvector if chosen.
- `.env` file loaded via `dotenv` / framework config.
- Scripts: `dev`, `build`, `lint`, `test`, `db:migrate`, `db:reset`.

## Environment Variables
- `OPENAI_API_KEY` – GPT-5/embeddings access.
- `OPENAI_API_BASE` – optional, for custom base URL.
- `DATABASE_URL` – Postgres/SQLite connection string.
- `VECTOR_DB_URL` / `VECTOR_DB_API_KEY` – for external vector store.
- `APP_BASE_URL` – public frontend URL.
- `NODE_ENV`, `LOG_LEVEL` – environment & logging control.
