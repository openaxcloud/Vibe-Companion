# Active Context – Initial Focus & Next Steps

## Current Focus
- Establish foundational architecture for the e-commerce marketplace and its Memory Bank.
- Decide and record core tech choices (backend framework, ORM, state management).
- Set up minimal vertical slice: product listing → cart → mock checkout (before full Stripe wiring).

## Key Decisions Already Implied
- TypeScript + React for UI; Node-based API backend.
- Stripe selected as sole payments provider.
- Marketplace is single-tenant (one store) for now; multi-vendor not yet in scope.

## Immediate Next Steps (Checklist)
- [ ] Choose backend framework (Express vs Nest) and document rationale here.
- [ ] Choose database and ORM (e.g., PostgreSQL + Prisma) and record schema high-level.
- [ ] Define initial domain models: User, Product, Cart, CartItem, Order, Payment.
- [ ] Set up repo structure (frontend, backend, shared types) and baseline tooling.
- [ ] Implement auth baseline (signup/login, protected routes) and document token/session strategy.
- [ ] Implement product catalog API + simple React listing with search/filter stubs.
- [ ] Implement in-memory cart on frontend, then wire backend persistence.
- [ ] Integrate Stripe in test mode: create Checkout Session/PaymentIntent from backend.
- [ ] Define and document order & payment state machine and mapping from Stripe events.
- [ ] Create an initial admin dashboard skeleton (view products, view orders).
