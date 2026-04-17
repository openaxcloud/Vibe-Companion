# System Architecture - Memory Bank

## Architecture Overview
- **Frontend**: React SPA with TypeScript, real-time WebSocket client
- **Backend**: Node.js/Express API with Socket.io for WebSocket management
- **Database**: PostgreSQL for messages/users, Redis for real-time state
- **Storage**: AWS S3 for file uploads with CDN distribution

## Key Technical Decisions
- Socket.io for WebSocket abstraction and fallback support
- React Query for server state management and caching
- Zustand for client-side real-time state (typing, presence)
- JWT authentication with refresh token rotation
- Message pagination with virtual scrolling for performance

## Design Patterns
- **Event-driven architecture** for real-time features
- **Repository pattern** for data access abstraction
- **Observer pattern** for WebSocket event handling
- **Optimistic updates** for immediate UI feedback
- **Message queuing** for offline/failed message handling