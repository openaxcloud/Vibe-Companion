# Memory Bank – Active Context & Next Steps

## Current Focus
- Initial setup of project structure, core tooling, and baseline domain models.
- Define and document the first version of the data model for users, products, carts, and orders.
- Integrate Stripe in test mode for a minimal checkout path.

## Immediate Decisions to Lock In
- Choose backend framework (Express vs Nest/Fastify) and ORM.
- Define auth strategy (session vs JWT) and roles (user/admin model).
- Select routing/state strategy on frontend (e.g., React Router + React Query).

## Next Steps Checklist
- [ ] Scaffold repo structure (frontend, backend, shared types).
- [ ] Configure TypeScript, linting, formatting, and basic CI.
- [ ] Define DB schema: User, Product, ProductVariant (if needed), Cart, CartItem, Order, OrderItem.
- [ ] Implement minimal auth (sign up, login, protected routes).
- [ ] Build read-only product catalog list + detail views with search and filters.
- [ ] Implement cart API + client state (add/remove/update items).
- [ ] Implement Stripe payment intent flow with a simple checkout page.
- [ ] Add order creation and persistence on successful payment.
- [ ] Add basic admin order dashboard (list + detail view).
- [ ] Update Memory Bank as decisions and patterns solidify.
