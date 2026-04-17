# System Architecture - Memory Bank

## Architecture Overview
**Event-driven microservices** with WebSocket-first communication, supporting horizontal scaling and real-time state synchronization across clients.

## Core Patterns
- **WebSocket Gateway**: Centralized connection management with Redis pub/sub for scaling
- **Event Sourcing**: Message history as immutable event stream
- **CQRS**: Separate read/write models for optimal query performance
- **Channel State Management**: Real-time synchronization using operational transforms
- **File Storage**: CDN-backed object storage with progressive upload

## Key Technical Decisions
- **Socket.IO** for WebSocket management with fallback support
- **Redis Streams** for message queuing and real-time pub/sub
- **PostgreSQL** for persistent storage with read replicas
- **React Query** for optimistic updates and cache management
- **Zustand** for client-side state management
- **Service Workers** for offline support and push notifications

## Scalability Strategy
Horizontal scaling via load-balanced WebSocket servers, database sharding by workspace, and CDN for static assets.