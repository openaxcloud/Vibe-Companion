# System Architecture Patterns

## Architecture Overview
- **Frontend**: React SPA with TypeScript, Socket.io client
- **Backend**: Node.js/Express with Socket.io server
- **Database**: PostgreSQL for persistent data, Redis for sessions/presence
- **File Storage**: AWS S3 or similar cloud storage
- **Real-time**: WebSocket connections with Socket.io rooms

## Key Technical Decisions
- **Message Threading**: Nested comment structure with parent-child relationships
- **Presence Management**: Redis-based user status with heartbeat mechanism
- **File Handling**: Direct S3 upload with signed URLs, thumbnail generation
- **Notification System**: Web Push API + email fallback
- **State Management**: React Query for server state, Zustand for client state

## Design Patterns
- **Repository Pattern**: Data access abstraction layer
- **Observer Pattern**: Real-time event broadcasting
- **Command Pattern**: Message actions (send, edit, delete, react)
- **Strategy Pattern**: Different notification delivery methods