# Active Context & Next Steps (Initial Setup)

## Current Focus
- Define initial architecture and bootstrap a working skeleton for both frontend and backend.
- Establish type-safe contracts between client and server for auth, channels, and messages.
- Implement basic WebSocket connectivity and a minimal chat UI to verify real-time flow.

## Immediate Next Steps (Checklist)
- [ ] Initialize monorepo or multi-project structure (e.g., `frontend/`, `backend/`).
- [ ] Set up TypeScript configs, linting, and formatting (ESLint, Prettier) for both sides.
- [ ] Provision Postgres (and optional Redis) via Docker; define basic schema: users, workspaces, channels, memberships, messages, attachments.
- [ ] Implement backend auth (sign up, login, JWT issuance) and secure WebSocket handshake.
- [ ] Create initial REST endpoints: `GET /me`, `GET /channels`, `GET /channels/:id/messages`.
- [ ] Implement WebSocket gateway: connect, join channel rooms, broadcast new messages and typing events.
- [ ] Bootstrap React app with routing, basic layout (sidebar + message pane + composer), and auth flow.
- [ ] Implement message list + composer hooked to REST (history) and WebSocket (new messages, typing).
- [ ] Add minimal file upload flow (single file per message, upload to backend, then to S3-like storage).
- [ ] Instrument basic logging and error handling on both client and server to support early debugging.