# Tech Context & Setup (Memory Bank)

## Frontend Stack
- Language: TypeScript.
- Framework: React (with React Router for navigation).
- State: React Query or SWR for server state; lightweight local state via Context/Zustand if needed.
- Real‑time: WebSocket client (native or Socket.IO client) wrapped in custom hooks.
- UI: Tailwind CSS or component library (e.g., MUI/Chakra) for rapid layout.

## Backend & Services (Assumed)
- Node.js with TypeScript (Express/Fastify or NestJS) for HTTP API.
- WebSocket server (native ws, Socket.IO, or NestJS gateway module).
- Database: Postgres (Prisma/TypeORM as ORM).
- File storage: S3‑compatible service; signed URLs for secure access.

## Dev Setup
- Node LTS, pnpm/yarn for dependency management.
- Monorepo (optional) managing shared types between client and server.
- Local env via docker‑compose (db, object storage mock like MinIO, optional Redis).

## Key Dependencies (client)
- react, react-dom, react-router-dom.
- axios or fetch wrapper for HTTP.
- react-query/SWR for data fetching + cache.
- ws/Socket.IO client for WebSockets.
- Tailwind/MUI/Chakra for UI.

## Environment Variables (examples)
- FRONTEND: VITE_API_BASE_URL, VITE_WS_URL, VITE_FILE_UPLOAD_MAX_SIZE.
- BACKEND: PORT, DATABASE_URL, JWT_SECRET, S3_ENDPOINT, S3_BUCKET, REDIS_URL.

## Memory Bank Angle
- Capture these tech defaults so future tasks assume this stack and naming for env vars and shared libs.
