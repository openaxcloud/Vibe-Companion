# Active Context & Next Steps Memory Bank

## Current Focus
- Establish foundational architecture and project structure before detailed features.
- Decide on and scaffold: front‑end framework setup, back‑end framework, DB, and Stripe integration approach.
- Lock in naming conventions and module boundaries early.

## Immediate Decisions to Finalize
- Choose front‑end environment: pure React SPA vs Next.js (affects routing, SSR, deployment).
- Choose API style: REST vs tRPC/GraphQL; once chosen, apply consistently.
- Choose ORM (Prisma preferred for TypeScript) and define initial schema.

## Next Steps Checklist
- [ ] Initialize monorepo or two aligned projects (`/frontend`, `/backend`).
- [ ] Set up TypeScript configs, linting, formatting, and CI basics.
- [ ] Provision PostgreSQL locally (Docker) and define base schema: users, sellers, products, carts, orders, order_items, payments.
- [ ] Implement minimal auth (signup/login/logout, roles) and protected routes.
- [ ] Integrate Stripe in test mode with a basic checkout + webhook handler stub.
- [ ] Implement basic product listing API + front‑end catalog page with search and filters.
- [ ] Implement cart API and UI with persistent server‑side cart.
- [ ] Implement basic order management dashboard views (buyer & seller).
- [ ] Update Memory Bank when any structural or lifecycle decision changes.
