# System Architecture & Patterns (Memory Bank)

## High‑Level Architecture
- Client: React + TypeScript SPA, using WebSocket client for real‑time events and REST/GraphQL for CRUD.
- API Service: HTTP API for auth, channels, messages, file metadata; issues short‑lived auth tokens.
- Real‑Time Gateway: WebSocket server handling connections, rooms (channels/DMs), and event fan‑out.
- Storage: Relational DB (e.g., Postgres) for users, channels, messages, memberships; object storage for files.

## Key Technical Decisions
- Event model: channel_id/DM_id as subscription rooms; events: MESSAGE_SENT, MESSAGE_EDITED, TYPING_STARTED, etc.
- WebSocket auth via JWT handshake and periodic refresh.
- Outbox or event log pattern to ensure consistency between HTTP writes and WebSocket broadcasts.

## Design Patterns
- Clean architecture layering: UI → application hooks/services → API/WS adapters.
- React: container/presenter split, hooks for data/real‑time (e.g., useChannelMessages, useTypingIndicator).
- Server: CQRS‑lite separation between read (message history) and write (send/update message) paths.
- Authorization pattern: role + membership checks per channel/DM at API and gateway.

## Scalability & Reliability
- Horizontal scaling of WebSocket gateway with sticky sessions or shared pub/sub (Redis) for fan‑out.
- Rate limiting on message sends and typing events to prevent abuse.

## Memory Bank Focus
- Persist the chosen patterns (rooms per channel, JWT WS auth, hooks‑based client) as defaults for future extensions.
