# System Architecture

## Architecture Overview
```
React Client ↔ WebSocket Gateway ↔ Message Service ↔ Database
     ↓              ↓                    ↓
Push Service   Presence Service    File Storage
```

## Key Technical Decisions
- **WebSocket-first**: Real-time bidirectional communication
- **Event-driven architecture**: Message events, presence updates, typing indicators
- **Optimistic UI updates**: Instant local updates with server reconciliation
- **Message persistence**: Full message history with efficient pagination

## Design Patterns
- **Publisher/Subscriber**: Channel-based message distribution
- **Command/Query Separation**: Write operations vs read queries
- **State synchronization**: Client-server state consistency
- **Connection resilience**: Auto-reconnection and message queuing

## Data Flow
1. User action triggers optimistic UI update
2. WebSocket sends command to server
3. Server validates, persists, and broadcasts event
4. All connected clients receive and apply updates