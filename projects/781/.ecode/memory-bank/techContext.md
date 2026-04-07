# Tech Context – Memory Bank

## Stack Constraints to Remember
- Language: TypeScript for both frontend and backend.
- Frontend: React (bundler/framework to be chosen and then recorded, e.g., Vite, Next.js). 
- Backend: Node.js with a TypeScript framework (e.g., Express/Nest/Fastify – to be decided and stored).
- Payments: Stripe JS on frontend, Stripe SDK + webhooks on backend.

## Likely Dependencies (to confirm & persist once chosen)
- React + React Router for SPA navigation.
- State management: React Query/Redux/Zustand for server/cache and cart state.
- Form handling: e.g., React Hook Form + Zod/Yup for validation.
- Backend: Express/NestJS, ORM (Prisma/TypeORM) for DB access.
- Stripe: `@stripe/stripe-js` (frontend) and `stripe` (backend SDK).

## Environment Variables to Track
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or equivalent public key.
- DB connection string (e.g., `DATABASE_URL`).
- Auth secrets (JWT secret, cookie keys) and app base URLs.

## Dev Setup Considerations
- Single mono-repo for frontend + backend recommended; store structure decision here.
- Shared TypeScript types package for API contracts if adopted.
- Use `.env` + `.env.local` patterns and never hard-code secrets.

## Memory Bank Use
- Once specific libraries/tools are picked, record versions and rationale.
- Keep a stable reference of env vars required for local and production setups.