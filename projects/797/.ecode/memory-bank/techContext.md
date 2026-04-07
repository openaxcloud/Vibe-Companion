# Technology & Environment – Memory Bank

## Core Tech Stack (Committed)
- Language: TypeScript end‑to‑end.
- Frontend: React + TS, bundler/build tool (e.g., Vite or Next.js if SSR/SEO is prioritized).
- Backend: Node.js with a TS framework (Express or NestJS; final choice to be recorded here once made).
- Database: PostgreSQL (preferred) or another SQL DB; ORM like Prisma or TypeORM.
- Payments: Stripe (Checkout or Payment Intents + Elements) with webhooks.

## Key Dependencies to Track
- React ecosystem: router library, state management (React Query/Redux), UI component library (e.g., MUI/Chakra/Tailwind CSS).
- Backend ecosystem: HTTP framework, ORM, validation library (e.g., Zod/Yup/class‑validator), auth library (e.g., Passport/NextAuth/custom JWT).
- Tooling: ESLint, Prettier, Jest/Vitest for tests, possibly Cypress/Playwright for E2E.

## Environment & Configuration Memories
- ENV separation: `development`, `staging`, `production` with different Stripe keys and DBs.
- Critical env vars (names may evolve but concepts should not):
  - `DATABASE_URL` – main DB connection.
  - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`.
  - `STRIPE_WEBHOOK_SECRET`.
  - `JWT_SECRET` or equivalent for auth.
  - `APP_BASE_URL`, `FRONTEND_URL`, `BACKEND_URL` if split.
- Do not store secrets in code; use env files and a secret manager in production.
