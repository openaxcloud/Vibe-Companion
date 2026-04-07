# Active Context – Current Focus & Next Steps

## Current Focus
- Initial architecture and project setup for the marketplace Memory Bank.
- Lock in core patterns for auth, cart, checkout, and Stripe payment flow.
- Define minimal viable product scope for first build.

## Next Steps Checklist
- [ ] Decide on backend framework (Express vs Nest vs Fastify) and record rationale.
- [ ] Define initial data models: User, Product, Category, CartItem, Order, Payment.
- [ ] Design API surface: endpoints or GraphQL schema for catalog, cart, checkout, orders.
- [ ] Choose state management approach on front-end and document usage guidelines.
- [ ] Define Stripe integration flow (Checkout Session vs Payment Intent) and error handling.
- [ ] Specify auth strategy (JWT vs cookie-based sessions) and role model (user/admin).
- [ ] Set up base project structure (frontend, backend, shared types) and linters/formatters.
- [ ] Establish environment variable schema and example `.env.sample`.
- [ ] Create first end-to-end slice: browse products → add to cart → mock checkout.
