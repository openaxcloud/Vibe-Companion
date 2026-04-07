# Tech Context – Memory Bank

## Stack & Tooling
- Language: TypeScript across frontend and backend.
- Frontend: React, React Router, state manager (context or Redux/RTK), CSS-in-JS or utility CSS.
- Backend: Node.js with Express or NestJS; TypeORM/Prisma for DB access.
- DB: Postgres (preferred), running locally via Docker.
- Payments: Stripe Node SDK on backend, Stripe JS on frontend.

## Dev Setup
- Node LTS + pnpm/yarn for dependency management.
- Separate `client` and `server` packages (monorepo optional).
- Shared TypeScript types between client/server for models and API contracts.

## Key Dependencies (to confirm)
- Frontend: `react`, `react-dom`, `react-router-dom`, state manager, `axios`/`fetch` wrapper, Stripe JS.
- Backend: `express`/`@nestjs/core`, `typeorm`/`@prisma/client`, `jsonwebtoken`, `zod`/`yup` for validation, Stripe SDK.

## Env Vars (initial)
- `DATABASE_URL` – Postgres connection string.
- `STRIPE_SECRET_KEY` – server-side secret.
- `STRIPE_WEBHOOK_SECRET` – for verifying webhooks.
- `STRIPE_PUBLISHABLE_KEY` – frontend public key.
- `JWT_SECRET` – signing key for auth tokens.
- `APP_BASE_URL`, `FRONTEND_URL` – URLs for CORS and redirects.
