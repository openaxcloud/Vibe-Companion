# Tech Stack & Environment Memory Bank

## Front‑End
- React + TypeScript; state management via React Query + local state (and minimal global store for auth/cart if needed).
- Routing: React Router or Next.js (if SSR is chosen; decide up front and do not mix models).
- UI layer: component library (e.g., MUI/Tailwind + custom components) for consistency.

## Back‑End
- Node.js + TypeScript (e.g., Express/Fastify/Nest; choose one and keep it standard).
- PostgreSQL via Prisma or TypeORM; migrations tracked in repo.
- Stripe Node SDK for payments and webhooks.

## Key Dependencies to Remember
- Auth: bcrypt/argon2 for password hashing, JWT or cookie‑session library.
- Validation: Zod or Yup for shared schemas between client/server if possible.
- File/image hosting: initially local or simple cloud bucket (S3‑compatible) for product images.

## Environment Variables (Canonical Names)
- `NODE_ENV`, `PORT`.
- `DATABASE_URL` (Postgres connection string).
- `JWT_SECRET` or session secret.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`.
- Optional: `FRONTEND_URL`, `BACKEND_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.

## Dev Setup Invariants
- Single `docker-compose` for DB (and optionally local Stripe CLI).
- Seed script for demo users, sellers, products, and orders.
- Shared TypeScript config for front‑end and back‑end to avoid drift.
