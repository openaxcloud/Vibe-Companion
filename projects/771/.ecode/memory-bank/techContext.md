# Tech Context & Development Setup – Memory Bank

## Tech Stack
- **Frontend**: React + TypeScript, Vite or Next.js (SPA mode), React Query/RTK Query for data.
- **State Management**: React Query for server state; lightweight local state (Context/Zustand) for UI.
- **Backend**: Node.js + TypeScript (NestJS or Express with modular architecture).
- **Database**: PostgreSQL via Prisma or TypeORM.
- **Cache & Realtime**: Redis for presence, WebSocket pub/sub, ephemeral data.
- **File Storage**: S3-compatible bucket (AWS S3/MinIO) with signed URL upload/download.

## Key Dependencies
- WebSocket library: Socket.IO or ws (plus adapter for Redis pub/sub in multi-node setups).
- Auth: jsonwebtoken, bcrypt/argon2 for password hashing.
- HTTP stack: axios/fetch on client; Express/Nest HTTP server and middleware.
- File handling: multer/busboy (server), image preview via browser APIs.
- UI: component library (e.g., MUI/Chakra/Tailwind) + icon set.

## Dev Setup
- Node >= 20, pnpm/yarn/npm as package manager.
- .env files for local, staging, prod with typed config loader.
- Docker compose for local Postgres, Redis, and MinIO/S3 emulator.
- ESLint + Prettier + TypeScript strict mode, Jest/Vitest + React Testing Library.

## Environment Variables (examples)
- `DATABASE_URL` – Postgres connection string.
- `REDIS_URL` – Redis instance for cache/pub-sub.
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` – file storage.
- `JWT_SECRET`, `JWT_REFRESH_SECRET` – auth secrets.
- `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` – push notifications.
- `APP_BASE_URL`, `WS_BASE_URL` – frontend/backend endpoints.
