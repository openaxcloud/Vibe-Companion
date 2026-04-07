# System Architecture & Design Patterns

## High-Level Architecture
- Client: React + TypeScript SPA communicating with REST (HTTP) and WebSocket APIs.
- Backend: Node.js/TypeScript service handling auth, message routing, and memory capture.
- Data: Relational DB (e.g., Postgres) for users, channels, messages, and memory artifacts; object storage for files.
- Realtime: WebSocket gateway for bidirectional events (messages, typing, presence).

## Memory Bank Concept
- Message-level storage in DB with metadata (author, channel, thread, timestamps).
- Derived memory entities: channel summaries, decision markers, pinned knowledge snippets.
- Background workers to generate/update summaries and derived memory indices.

## Key Design Patterns
- **CQRS-lite**: REST endpoints for queries (history, search) and WebSocket for commands/events (sendMessage, typingStart).
- **Pub/Sub**: Internal message bus for fan-out to connected WebSocket clients and async memory processors.
- **Repository pattern**: Encapsulate DB access for messages, channels, and memory records.
- **Event sourcing (partial)**: Persist message events; derive read models like summaries and search indices.
- **State synchronization**: Client-side stores (e.g., React Query/Zustand) subscribing to server events for real-time updates.

## Realtime Features
- Channels and DMs subscribe to specific topics via WebSocket.
- Typing indicators throttled/debounced and broadcast to channel members.
- Ordered message stream with server-assigned timestamps and IDs.
