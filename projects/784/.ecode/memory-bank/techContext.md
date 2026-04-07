# Memory Bank – Tech Context

## Core stack
- **Frontend**: React + TypeScript, typical tooling (Vite or CRA-like bundler), React Router, state management & data fetching (React Query or equivalent).
- **Backend**: Node.js + TypeScript with a web framework (Express or NestJS), REST API.
- **Database**: Likely Postgres (or similar) accessed via Prisma/TypeORM/Knex.
- **Payments**: Stripe (Checkout Session or Payment Intents API + webhooks).
- **Auth**: JWT or session-based auth; possibly a provider like Auth0/Supabase/Cognito.

## Key dependencies to track
- React ecosystem (router, query, form library like React Hook Form/Zod for validation).
- Stripe official SDKs:
  - `stripe` for server-side Node.
  - `@stripe/stripe-js` for client.
- ORM and migration tool (e.g., Prisma + `prisma migrate`).

## Environments & config to remember
- `NODE_ENV` (development, staging, production).
- Database connection string: `DATABASE_URL`.
- Stripe keys: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- Auth secrets: `JWT_SECRET` or provider client/secret IDs.
- App base URLs for redirects and webhooks: `APP_URL`, `API_URL`, `STRIPE_WEBHOOK_URL`.

## Dev setup assumptions
- Local dev with seeded products and test users.
- Stripe test mode with test cards.
- Hot reload on frontend and backend.
