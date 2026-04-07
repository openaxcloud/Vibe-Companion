# System Architecture & Patterns – Memory Bank

## High-level Architecture
- Frontend: React (TypeScript) SPA consuming REST/GraphQL APIs and WebSocket endpoints.
- Backend (conceptual in this Memory Bank): Node.js/TypeScript service handling auth, channels, messages, file metadata, and WebSocket events.
- Real-time: WebSocket server for message delivery, typing indicators, presence updates.
- Storage (conceptual): relational DB (e.g., PostgreSQL) for core entities; object storage for files.

## Key Technical Decisions
- Use WebSockets (or WebSocket abstraction like Socket.IO) for reliable real-time communication.
- Event-driven messaging model: publish-subscribe by channel/DM room.
- Normalized data model: workspaces, users, channels, memberships, messages, attachments.
- Client state management using React Query + local state, or Redux Toolkit if state grows complex.
- Optimistic UI for message sending with rollback on failure.

## Design Patterns
- Layered architecture: API layer, services/use-cases, data access (repositories).
- Domain-driven boundaries: Auth, User Directory, Workspaces/Channels, Messaging, Files.
- Observer pattern for message streams and typing events over WebSockets.
- Command Query Responsibility Segregation (lightweight): write via commands, read via query endpoints optimized for channel histories.
- Circuit-breaker / reconnect strategy for WebSocket reliability in the client.

## Memory Bank Focus
- Record ADRs for protocol choices (pure WebSocket vs. Socket.IO), message schema, and presence model.
- Track performance decisions (e.g., pagination strategy, message caching) for future optimization.