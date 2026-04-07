# Active Context – Initial Setup

## Current Focus
- Establish baseline architecture and project structure for the TypeScript React marketplace.
- Lock in critical technical choices: React build system, backend framework, ORM, and auth approach.
- Implement skeleton flows end-to-end without full UI polish: list products → add to cart → dummy checkout → order record.

## Immediate Decisions to Record
- Choose between Vite+React vs. Next.js for the frontend.
- Choose backend framework (Express vs. NestJS vs. Fastify) and ORM/migrations (Prisma vs. TypeORM).
- Decide on auth strategy (JWT with httpOnly cookies vs. session store).
- Confirm database schema baseline for `users`, `products`, `carts`, `orders`, `payments`.

## Next Steps Checklist
- [ ] Create repo structure (`/frontend`, `/backend`, `/shared` types) and basic tooling config (TS, ESLint, Prettier).
- [ ] Implement minimal healthcheck endpoint and deployable backend skeleton.
- [ ] Implement basic React shell (routing, layout, dummy pages for catalog, cart, checkout, account, admin).
- [ ] Configure PostgreSQL locally (Docker) and set up migrations with initial schema.
- [ ] Wire simple product listing API and display it in frontend.
- [ ] Integrate Stripe test keys and create a sandbox PaymentIntent from backend.
- [ ] Set up Stripe webhook handler and verify signature with `STRIPE_WEBHOOK_SECRET`.
- [ ] Implement minimal auth (signup/login/logout) and protect checkout + order history.
- [ ] Document all locked-in decisions above in this Memory Bank as they are made.