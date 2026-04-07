# Tech Stack & Setup – Memory Bank

## Frontend
- **Language:** TypeScript
- **Framework:** React (SPA/CSR)
- **Routing:** React Router (for auth, catalog, cart, checkout, dashboard paths).
- **Data fetching:** React Query (or similar) with typed API clients.
- **Styling:** TailwindCSS or CSS-in-JS (decision to be finalized early).
- **Forms:** React Hook Form + Zod (for validation and type safety).

## Backend
- **Runtime:** Node.js (LTS)
- **Language:** TypeScript
- **Framework:** Express (or similar minimal framework) with modular routers.
- **ORM:** Prisma or TypeORM (backed by Postgres).
- **Auth:** JWT or cookie-based sessions + bcrypt for passwords.
- **Stripe:** `stripe` Node SDK for PaymentIntents and webhooks.

## Development Setup
- Monorepo or two repos (frontend/backend); shared types via a shared package.
- Local `.env` files for secrets; never committed.
- Docker-based Postgres for local dev.
- NPM/Yarn/PNPM for dependency management.

## Key Dependencies (indicative)
- Frontend: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `react-hook-form`, `zod`, `axios`.
- Backend: `express`, `cors`, `helmet`, `jsonwebtoken`, `bcrypt`, `stripe`, ORM of choice, `zod`/`joi` for validation.

## Environment Variables (examples)
- `NODE_ENV`, `PORT`
- `DATABASE_URL`
- `JWT_SECRET` or session keys
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- `FRONTEND_BASE_URL`, `BACKEND_BASE_URL`
