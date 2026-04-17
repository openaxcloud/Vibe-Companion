# System Architecture Patterns

## Architecture Overview
- **Client-Server WebSocket Architecture** with React frontend and Node.js backend
- **Event-driven messaging** using WebSocket events for real-time updates
- **Channel-based pub/sub** pattern for message distribution
- **Optimistic UI updates** with rollback on failure

## Key Technical Decisions
- **WebSocket over Socket.io** for real-time bidirectional communication
- **Redux Toolkit** for complex state management (messages, channels, users)
- **React Query** for server state synchronization and caching
- **Zustand** for local UI state (typing indicators, modals)

## Design Patterns
- **Observer Pattern**: WebSocket event listeners for real-time updates
- **Command Pattern**: Message actions (send, edit, delete, react)
- **Repository Pattern**: Data access layer for messages and channels
- **Pub/Sub Pattern**: Channel subscriptions and message broadcasting
- **Optimistic Updates**: Immediate UI feedback with server confirmation