# Tech Context – Memory Bank

## Stack Overview
- Language: TypeScript end-to-end.
- Frontend: React (SPA), likely Vite or CRA for tooling.
- Backend: Node.js with a TypeScript framework (e.g., Express/Nest – final choice to be recorded here).
- Database: (To be finalized – e.g., PostgreSQL); ORM (e.g., Prisma) for typed access.
- Payments: Stripe (Stripe.js on client, Stripe Node SDK on server).

## Development Setup
- Single repo (monorepo or polyrepo clarified here) containing frontend and backend.
- Shared TypeScript types package for domain models (optional but recommended).
- Local dev uses Stripe test mode and seeded test products.

## Key Dependencies (to track explicitly)
- React, React Router (or equivalent) for routing.
- State/query: React Query/RTK Query or similar.
- Backend: Express/Nest (HTTP routing, middleware), Stripe SDK, auth library (e.g., Passport, custom JWT).
- ORM: Prisma/TypeORM (migrations, schema management).
- Testing: Jest/Vitest + React Testing Library for unit/integration tests.

## Configuration & Env Vars (to be maintained here)
- FRONTEND:
  - VITE_API_BASE_URL / REACT_APP_API_BASE_URL.
  - VITE_STRIPE_PUBLISHABLE_KEY.
- BACKEND:
  - DATABASE_URL.
  - STRIPE_SECRET_KEY.
  - STRIPE_WEBHOOK_SECRET.
  - JWT_SECRET / SESSION_SECRET.
  - APP_BASE_URL (for callback/redirect URLs).

## Operational Notes
- Use Stripe CLI or dashboard for webhook testing & event replay.
- Versioned DB migrations; schema changes documented in Memory Bank before implementation.
- Document CORS, deployment targets, and any CDN usage once chosen.
