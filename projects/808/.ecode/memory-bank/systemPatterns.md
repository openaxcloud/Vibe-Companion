# System Architecture & Patterns

## High-Level Architecture
- Client: React + TypeScript SPA.
- Real-time transport: WebSocket-based event layer (e.g., custom WS server or service).
- API: REST/GraphQL backend (not detailed here) for auth, persistence, and metadata.
- Storage (conceptual): relational DB for users/channels/messages; object store for files.

## Core Concepts (Memory Bank View)
- **User Memory**: identity, profile, presence state, device connections.
- **Channel Memory**: metadata (name, privacy), membership, last-read pointers.
- **Conversation Memory**: ordered messages, reactions, typing state.
- **File Memory**: upload metadata, access control, storage location.

## Key Patterns
- **Event-Driven Updates**: server pushes message/typing/presence events to subscribed clients.
- **Pub/Sub Channels**: per-channel and per-DM topics; clients subscribe on join.
- **CQRS Lite**: REST for writes/queries of canonical data; WebSockets for live updates.
- **Optimistic UI**: render sent message immediately, reconcile with server ack.
- **State Normalization**: store users, channels, messages in normalized client state.

## Cross-Cutting Concerns
- Auth tokens attached to WebSocket connection handshake.
- Authorization guards for channel/private DM subscriptions.
- Rate limiting for message send and typing events.
- Graceful reconnection with missed-event recovery (e.g., fetch since last message ID).
