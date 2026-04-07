# Tech Context & Setup – Memory Bank

## Tech Stack
- Language: TypeScript (frontend and backend).
- Frontend: React, Vite or Create React App, React Router, React Query/Redux Toolkit, TailwindCSS or CSS-in-JS.
- Backend (conceptual for this doc): Node.js, Express/Fastify, WebSocket (ws/Socket.IO), PostgreSQL via Prisma/TypeORM.
- Realtime: WebSocket server for channels & DMs, possibly namespaced/room-based.
- File storage: S3-compatible service for attachments with signed URLs.

## Development Setup
- Node.js >= 18, pnpm/yarn/npm as package manager.
- Linting/formatting: ESLint, Prettier, TypeScript strict mode.
- Testing: Jest/Vitest, React Testing Library (frontend), supertest for backend APIs.
- Local services: Dockerized Postgres and local S3 emulator (e.g., MinIO) as needed.

## Key Dependencies (indicative)
- Frontend: react, react-dom, @tanstack/react-query or @reduxjs/toolkit, react-router-dom, websocket/socket.io-client, UI library (MUI/Chakra or custom).
- Backend: express/fastify, ws/socket.io, jsonwebtoken, bcrypt, prisma/typeorm, multer/busboy for uploads.

## Environment Variables (examples)
- FRONTEND: VITE_API_BASE_URL, VITE_WS_URL.
- BACKEND: PORT, DATABASE_URL, JWT_SECRET, FILE_STORAGE_BUCKET, FILE_STORAGE_ENDPOINT, FILE_MAX_SIZE_MB.

## Memory Bank Items
- Capture chosen libraries, versions, and reasons for selection.
- Document environment conventions (.env patterns) and deployment targets (Dev/Stage/Prod).