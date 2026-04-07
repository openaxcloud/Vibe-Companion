# Active Context – Current Focus & Next Steps

## Current Focus
- Establish Memory Bank for the marketplace: clarify flows, architecture, and tech constraints.
- Align on stack: React + TypeScript frontend, Node + TypeScript backend, Postgres DB, Stripe payments.
- Define initial entities: User, Product, Category, CartItem, Order, PaymentIntent/Charge.

## Immediate Next Steps (Checklist)
- [ ] Initialize monorepo or single repo with `frontend/` and `backend/`.
- [ ] Configure TypeScript, linting, and formatting for both client and server.
- [ ] Set up Postgres + migrations and define initial schema for users/products/orders.
- [ ] Implement basic auth (register/login, JWT cookies, role flags).
- [ ] Build minimal product listing API and React catalog page with search & filter UI.
- [ ] Implement cart API + client cart state (add/update/remove, persist for logged-in users).
- [ ] Integrate Stripe: create payment intent on backend, collect payment on frontend.
- [ ] Set up Stripe webhook endpoint and link payment status to orders.
- [ ] Create basic admin dashboard page for viewing and updating orders.
- [ ] Update Memory Bank as new decisions are made (e.g., search strategy, role expansion).
