# Memory Bank – Tech Stack & Environment

## Tech Stack (Canonical for this Project)
- Language: TypeScript across frontend and backend.
- Frontend: React for SPA/MPA UI; client‑side routing; integration with Stripe JS.
- Backend: Node.js with a TypeScript web framework (Express/Nest/Fastify are acceptable unless explicitly constrained).
- Database: generic relational or document DB (exact choice can be decided later; key is to persist products, users, carts, orders, payments).

## Key Integrations
- Stripe: PaymentIntents API, Webhooks, Stripe JS/Elements or Checkout.
- Auth: JWT/session tokens; password‑based auth by default; optional OAuth providers later.

## Assumed Dependencies (conceptual)
- React + React Router.
- State management (React Query or similar for server state; local state for UI).
- Stripe SDKs: `@stripe/stripe-js` (client) and `stripe` (server).
- ORM/DB toolkit (Prisma/TypeORM/Drizzle – specific choice can be decided when implementing).

## Environment & Config (to remember as patterns)
- Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, DB connection string, JWT/SESSION secret, app base URL.
- Separate envs: development vs production, with Stripe test vs live keys.
