# Tech Stack - Memory Bank

## Frontend Stack
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **TailwindCSS** for utility-first styling
- **React Query** for server state and caching
- **Zustand** for client state management
- **Socket.io-client** for WebSocket connections
- **React Hook Form** for form handling

## Key Dependencies
```json
"socket.io-client": "^4.7.0",
"@tanstack/react-query": "^4.29.0",
"zustand": "^4.3.0",
"react-hook-form": "^7.45.0",
"date-fns": "^2.30.0"
```

## Environment Variables
```
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_UPLOAD_MAX_SIZE=10485760
```

## Development Setup
- Node.js 18+ required
- PostgreSQL 14+ for database
- Redis 6+ for real-time state