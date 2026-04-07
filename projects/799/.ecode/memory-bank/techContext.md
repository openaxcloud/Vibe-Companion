# Tech & Environment Context – Memory Bank

1. **Language & Frameworks:**
   - Frontend: TypeScript, React, React Router
   - Backend: TypeScript (Node/Express or similar HTTP framework)
   - ORM/DB: Prisma + Postgres (or equivalent SQL DB)
2. **Key Dependencies (planned):**
   - Stripe SDK (server + client)
   - Auth library (e.g., custom JWT or NextAuth-equivalent if framework supports)
   - Validation: Zod or class-validator
   - Build tooling: Vite or similar for React; ts-node / build step for backend
3. **Environment Variables to Track:**
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PUBLISHABLE_KEY`
   - `DATABASE_URL`
   - `SESSION_SECRET` / JWT secret
   - `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`
4. **Dev Setup Conventions:**
   - Single repo with `frontend/` and `backend/` (or monorepo with packages)
   - `.env` for local, `.env.example` committed
   - Seed script for sample users, products, and orders
5. **Testing & Quality (planned):**
   - Unit tests for services and utilities
   - Minimal integration tests for core flows (auth, checkout)
   - Prettier + ESLint with TypeScript rules.
