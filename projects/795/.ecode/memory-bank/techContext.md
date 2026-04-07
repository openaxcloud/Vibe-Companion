# Tech Context – Stack & Environment Memory

## Core Stack
- **Language**: TypeScript end-to-end.
- **Frontend**: React, React Router, React Query (or similar), component library (TBD), Stripe Elements/SDK.
- **Backend**: Node.js + TypeScript with Express/Nest/Fastify; ORM (Prisma/TypeORM) for Postgres (or similar RDBMS).
- **Payments**: Stripe (PaymentIntents API, Webhooks, possibly Connect for marketplace payouts).

## Key Dependencies to Track
- Auth: library for password hashing + token/session management; possibly OAuth later.
- Validation: Zod/Yup for request/response schemas.
- Testing: Jest/Vitest for unit tests, Playwright/Cypress for E2E (especially checkout and payments).

## Environment & Configuration
- Required env vars (conceptual, not actual secrets):
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
  - `DATABASE_URL` (Postgres).
  - `JWT_SECRET` or session keys.
  - `FRONTEND_URL`, `BACKEND_URL` for CORS and redirect URLs.
- Clear separation of **test** vs **live** Stripe keys; Memory Bank should record how we switch.

## Dev Setup Considerations
- Local dev with Dockerized DB; Stripe CLI for webhook forwarding.
- Shared `.env.example` maintained as canonical reference.
- Consistent scripts: `dev`, `test`, `lint`, `format`, `build`, `migrate`.

## What to Remember Long-Term
- Any Stripe configuration quirks (e.g., Connect accounts, test cards, webhook signing issues).
- DB migration strategy and naming rules.
- Decisions on monorepo vs two repos, and shared code location.
- Browser support & tooling constraints that influenced tech choices.