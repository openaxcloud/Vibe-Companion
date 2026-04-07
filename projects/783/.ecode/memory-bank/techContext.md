# Tech Stack & Development Context

## Frontend
- Language: TypeScript
- Framework: React (with hooks)
- State/Data: React Query or SWR + lightweight state (Zustand/Context) for UI and WebSocket connection state.
- UI: Tailwind CSS or CSS-in-JS, component library (e.g., Headless UI) for modals, menus.
- WebSocket client: native WebSocket wrapped in a service or a library (e.g., socket.io-client if using Socket.IO server).

## Backend (assumed)
- Runtime: Node.js (TypeScript)
- Web framework: Express / Fastify or Socket.IO server for WebSockets.
- DB: Postgres (via Prisma or TypeORM) for users, channels, messages, memory records.
- Storage: S3-compatible bucket for file uploads; signed URLs for secure access.

## Key Dependencies
- `react`, `react-dom`, `typescript`, `vite` or `webpack` for bundling.
- `react-query` or `swr` for server state.
- `socket.io-client` (or custom WS client) for realtime.
- `axios` or `fetch` for REST.

## Env Vars (examples)
- `VITE_API_BASE_URL` – HTTP API base.
- `VITE_WS_URL` – WebSocket endpoint.
- `API_AUTH_SECRET` – JWT/Session secret (server).
- `DB_URL` – Postgres connection string.
- `FILE_STORAGE_BUCKET`, `FILE_STORAGE_REGION`, `FILE_STORAGE_KEY/SECRET`.
