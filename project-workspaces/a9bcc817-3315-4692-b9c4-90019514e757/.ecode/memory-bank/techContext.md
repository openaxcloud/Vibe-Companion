# Tech Stack - Memory Bank Platform

## Frontend Stack
- **React 18** with TypeScript for type-safe component development
- **Vite** for fast development and optimized production builds
- **Socket.IO Client** for real-time WebSocket communication
- **React Query** for server state management and caching
- **Zustand** for client-side state management
- **Tailwind CSS** for responsive UI design
- **React Hook Form** for form handling and validation

## Backend Stack
- **Node.js** with Express and TypeScript
- **Socket.IO** for WebSocket server management
- **PostgreSQL** with Prisma ORM for data persistence
- **Redis** for session storage and pub/sub messaging
- **Multer + AWS S3** for file upload and storage
- **JWT** for authentication and authorization

## Environment Variables
```
DATABASE_URL, REDIS_URL, JWT_SECRET
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET
PUSH_NOTIFICATION_KEY, SOCKET_IO_CORS_ORIGIN
```

## Development Setup
- **Docker Compose** for local PostgreSQL and Redis
- **Prisma Studio** for database management
- **ESLint + Prettier** for code formatting