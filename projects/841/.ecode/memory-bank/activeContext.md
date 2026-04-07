# Active Context – Current Focus & Next Steps

## Current Focus
- Define and stabilize the initial architecture and schema for the marketplace.
- Set up TypeScript React frontend and Node/TypeScript backend skeleton with Postgres and Stripe connectivity.
- Establish auth foundation and core domain models (User, Product, Cart, Order).

## Immediate Decisions to Lock
- Choose backend framework (Express vs Nest vs Next API routes) and routing strategy.
- Confirm state management approach on frontend (React Query + context vs Redux Toolkit).
- Confirm auth strategy: JWT + HTTP-only cookies vs opaque session IDs.

## Next Steps Checklist
- [ ] Initialize monorepo or single-repo structure with shared TypeScript config.
- [ ] Configure linting, formatting, and basic CI (lint + test).
- [ ] Set up Postgres + ORM (Prisma), define initial schema and run first migration.
- [ ] Implement minimal auth (signup, login, protected route middleware).
- [ ] Implement product listing API and basic React product list page.
- [ ] Add cart API + frontend cart context with add/update/remove operations.
- [ ] Integrate Stripe (test mode): create PaymentIntent/Checkout Session endpoints.
- [ ] Implement webhook handler to update order status on successful payment.
- [ ] Build admin order dashboard: list orders, filter by status, update status.
- [ ] Document these decisions in this Memory Bank as they evolve and are refined.
