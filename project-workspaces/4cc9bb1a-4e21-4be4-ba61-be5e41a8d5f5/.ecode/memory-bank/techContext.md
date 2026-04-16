# Technical Context

## Tech Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, React Query, Zustand
- **Real-time**: Socket.io client/server
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for sessions and presence
- **File Storage**: AWS S3 with CloudFront CDN
- **Authentication**: JWT with refresh tokens
- **Push Notifications**: Web Push API

## Key Dependencies
```json
"socket.io": "^4.7.0",
"@prisma/client": "^5.0.0",
"react-query": "^3.39.0",
"zustand": "^4.4.0",
"aws-sdk": "^2.1400.0"
```

## Environment Variables
- `DATABASE_URL`, `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`