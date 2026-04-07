# Active Context – Current Focus & Next Steps

## Current Focus
- **Initial setup** for the full-stack TypeScript + React marketplace with Stripe.
- Establish baseline architecture, core folders, and tooling that will not change frequently.
- Define first pass of domain models: User, Product, Cart, CartItem, Order, Payment.

## Memory Items to Capture Now
- Chosen frameworks: which Node framework, which ORM, which state management library.
- Initial folder structure for frontend and backend, including shared types.
- Conventions for API versioning and URL patterns (`/api/v1/...`).
- First Stripe flow design: when PaymentIntent is created/confirmed, how webhooks update orders.

## Next Steps Checklist
- [ ] Decide on backend framework (Express vs Nest vs Fastify) and record rationale.
- [ ] Finalize DB choice (likely Postgres) and define initial schema for core entities.
- [ ] Set up repo structure (mono vs multi) and document shared types pattern.
- [ ] Integrate Stripe SDK on backend; implement a simple test PaymentIntent endpoint.
- [ ] Integrate Stripe Elements/Checkout on frontend against a dummy product.
- [ ] Implement minimal auth (sign up, login, protected route) and record token/session strategy.
- [ ] Define standard API error format and add to Memory Bank.
- [ ] Create `.env.example` and document required env vars with descriptions.
- [ ] Add first architecture diagram and link/reference in this Memory Bank.
- [ ] Start a "Decisions Log" section to track key architectural and product decisions.