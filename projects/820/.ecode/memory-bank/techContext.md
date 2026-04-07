# Technical Context & Setup

## Frontend Stack
- **Language**: TypeScript
- **Framework**: React (with hooks and functional components)
- **State Management**: React Query (server state) + minimal context or Zustand/Redux for app-level UI state.
- **Styling**: CSS-in-JS or utility framework (e.g., Tailwind CSS) for rapid layout of chat UI.
- **WebSocket Client**: Custom hook or small abstraction over native `WebSocket` with reconnect logic.

## Backend & Infrastructure (Assumed Baseline)
- **API**: Node.js + TypeScript (e.g., Express/Fastify/NestJS) providing REST/GraphQL for CRUD operations.
- **WebSocket**: ws/Socket.IO/NestJS Gateway for bi-directional events.
- **Database**: Postgres (via Prisma/TypeORM) for persistent entities.
- **File Storage**: S3-compatible bucket with signed URLs for uploads/downloads.

## Key Dependencies (Frontend)
- React, React DOM
- React Router (routing between main views if needed)
- React Query (data fetching/cache)
- WebSocket abstraction library (optional) or native WebSocket wrapper
- UI library (optional): e.g., Radix UI/Headless UI for accessible primitives

## Key Dependencies (Backend)
- Express/Fastify/NestJS
- ws/Socket.IO (WebSocket support)
- Prisma/TypeORM (ORM)
- jsonwebtoken or equivalent
- Multer/busboy or direct-upload flow for file handling

## Environment Variables (Examples)
- `NODE_ENV`: environment (development/production)
- `PORT`: backend HTTP port
- `DATABASE_URL`: connection string for Postgres
- `JWT_SECRET`: secret key for signing tokens
- `WS_ORIGIN`: allowed WebSocket origins
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- `CLIENT_URL`: URL of React frontend for CORS

## Dev Setup
- Run DB via Docker compose (Postgres + optional Redis for presence/pub-sub).
- One command each for `frontend dev` and `backend dev` with hot reload.
- Seed script to create demo users, channels, and messages for quick testing.