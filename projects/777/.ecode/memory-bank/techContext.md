## Tech Stack
- **TypeScript 5.3** strict mode
- **React 18** (Vite) + React Router v6 + TanStack Query
- **Node 20** + Express + Socket.IO
- **PostgreSQL 15** (uuid PKs, row-level security)
- **Redis 7** (pub/sub, presence, rate limits)
- **S3** + CloudFront for assets
- **Docker & docker-compose** for local dev
- **GitHub Actions** → Render deploy previews

### Key Deps
- `socket.io`, `prisma`, `zod`, `react-hook-form`, `tailwindcss`, `lucide-react`, `@tanstack/react-query`

### Dev Setup
```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm dev
```

### Env Vars
DATABASE_URL, REDIS_URL, S3_BUCKET, FCM_SERVER_KEY, VAPID_KEYS