# System Architecture & Patterns – Memory Bank

## High-Level Architecture
- Client–server model with React (TS) SPA and a Node.js/TypeScript backend (e.g., NestJS/Express).
- Real-time transport via WebSockets (e.g., Socket.IO or ws) plus REST/GraphQL for CRUD and auth.
- Data persistence: relational DB (PostgreSQL) for users, channels, messages, reactions, threads.
- Object storage (e.g., S3-compatible) for files/images with signed URLs.

## Key Technical Decisions
- **WebSockets** for pub/sub-style channel events: messages, typing, presence, receipts.
- **Event-driven design**: internal message bus for fan-out to WebSocket gateways and async jobs.
- **Message schema**: normalized entities (Message, Thread, Reaction) to support querying and history.
- **Presence model**: in-memory + cache (Redis) with periodic heartbeats and status updates.
- **Push notifications** via web push (Service Worker) and/or platform-specific push in later phases.

## Core Patterns
- **CQRS-lite**: REST for commands/queries; WebSockets for event subscriptions and UI updates.
- **Repository pattern** in backend for DB access, isolating ORM/SQL.
- **Gateway pattern** for WebSocket connection handling and multi-node scalability.
- **Observer/pub-sub** for notifying subscribed clients about channel/DM events.
- **Saga/Job pattern** for file processing (virus scan, thumbnails) and notification fan-out.

## Security & Reliability
- JWT auth with refresh tokens; HTTP-only secure cookies where applicable.
- RBAC at workspace and channel levels; ACL checks in both REST and WS handlers.
- Rate limiting on message creation and file uploads.
- Graceful reconnection with missed-event replay using last-seen timestamps or cursors.
