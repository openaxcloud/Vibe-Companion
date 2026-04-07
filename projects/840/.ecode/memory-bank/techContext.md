# Memory Bank – Tech Context

## Core Stack (to stay consistent)
- **Language**: TypeScript across frontend and backend.
- **Frontend**: React, likely with React Router, build tool (Vite/CRA), and minimal UI framework or design system.
- **Backend**: Node.js with Express/Fastify/Nest in TypeScript; DB access via Prisma/TypeORM/knex.
- **Payments**: Stripe SDK (server + client), Stripe Dashboard for config.

## Dev Setup (baseline assumptions)
- Node 20+ and npm/yarn/pnpm.
- Two main apps: `/client` (React) and `/server` (API) or a monorepo structure.
- Shared TypeScript config and possibly shared types package.

## Key Dependencies to Remember
- Frontend: `react`, `react-dom`, `react-router-dom`, HTTP client (fetch/axios), state mgmt (context/zustand), Stripe React components.
- Backend: `express` (or chosen framework), `stripe`, database client/ORM, auth library (JWT or session), validation lib.

## Environment Variables (examples)
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`.
- `STRIPE_WEBHOOK_SECRET`.
- `DATABASE_URL`.
- `SESSION_SECRET` or JWT secret.
- `APP_BASE_URL`, `FRONTEND_URL`, `STRIPE_WEBHOOK_ENDPOINT`.

## Tooling & Quality
- Type checking with `tsc`; linting with ESLint; formatting with Prettier.
- Testing: Jest/Vitest for unit tests; minimal e2e for checkout flow.
