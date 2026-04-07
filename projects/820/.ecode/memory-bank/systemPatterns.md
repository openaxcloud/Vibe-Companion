# System Architecture & Patterns

## High-Level Architecture
- **Client**: React + TypeScript SPA communicating with backend via REST/GraphQL for CRUD and WebSocket for real-time events.
- **Backend**: API server + WebSocket gateway (could be a single service initially) responsible for auth, messaging, channels, and file metadata.
- **Storage**: Relational DB (e.g., Postgres) for users, channels, memberships, messages, and attachments; object storage (e.g., S3-compatible) for file blobs.
- **Real-Time Transport**: WebSocket channel per authenticated user; pub/sub pattern on server for channel/DM fan-out.

## Key Patterns
- **CQRS-lite**: Separate read-optimized queries (e.g., channel history) from write endpoints (send message, update profile) in API design.
- **Observer / Pub-Sub**: Backend publishes events like `message.created`, `typing.started`, `typing.stopped` to channel topics; WebSocket sessions subscribed by membership.
- **Gateway Pattern**: Single WebSocket gateway abstracts connection management, authentication, and event fan-out.
- **DTO & Validation**: Strict TypeScript interfaces and runtime validation (e.g., Zod) for all request/response payloads.
- **Pagination & Time Ordering**: Messages ordered by server timestamp; use cursor-based pagination for history.

## Real-Time Flows
- **Messaging**:
  - Client sends `send_message` over REST or WebSocket.
  - Server persists message, then emits `message.created` event to all relevant participants.
- **Typing Indicators**:
  - Client emits transient `typing` events with throttling/debouncing.
  - Server forwards as ephemeral events (not stored) to channel/DM participants.
- **Presence**:
  - On WebSocket connect/disconnect, server updates presence in memory or fast store (e.g., Redis) and broadcasts `presence.updated` events.

## Security & Multi-Tenancy
- JWT-based auth, with WebSocket authentication via token on connection (and periodic refresh).
- Access control checks for every channel/DM event (ensure membership for private channels and DMs).
- Basic workspace abstraction: messages and channels are scoped to one workspace (MVP can support a single workspace but design for many).

## Scalability Considerations
- Start with a monolith (API + WebSocket) but structure code into modules (auth, channels, messages, files) to enable future extraction.
- Use Redis or equivalent for pub/sub when horizontally scaling WebSocket nodes.
- Design message schemas and indices for fast queries on `channelId`, `createdAt`.