# Memory Bank – Active Context & Next Steps

## Current Focus
- Initial setup of the full-stack TypeScript/React e-commerce marketplace.
- Establishing baseline architecture, tooling, and Stripe integration skeleton.

## Immediate Decisions to Capture
- Monorepo vs separate front/back repos.
- Selected backend framework (Express/Fastify/Nest) and ORM.
- Choice of state management and data-fetching strategy for React (e.g., React Query).
- Stripe integration path: Stripe Checkout vs custom Payment Intent flow for MVP.

## Next Steps Checklist
- [ ] Initialize repo structure (front-end + back-end + shared types if any).
- [ ] Set up TypeScript configs, linting, formatting, and basic CI (lint + test).
- [ ] Implement basic auth (signup/login/logout, protected routes).
- [ ] Design core DB schema: users, products, inventory, carts, orders, payments.
- [ ] Implement minimal product catalog API and React views with search & filters stub.
- [ ] Wire up Stripe keys, test mode, and a minimal test payment flow.
- [ ] Create basic order management admin view with filtered order list.
- [ ] Update Memory Bank with final tech stack choices and any deviations from this plan.
