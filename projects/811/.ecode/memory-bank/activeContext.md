# Active Context – Memory Bank

## Current Focus
- Initial system design and baseline documentation for the e‑commerce marketplace.
- Establishing stable concepts for products, cart, checkout, auth, and orders.
- Locking in high‑level architecture, stack, and Stripe‑based payment flow.

## Working Assumptions
- Stack: TypeScript + React frontend; TypeScript Node backend; relational DB; Stripe for payments.
- Marketplace supports single‑vendor or centralized inventory for now.
- Admin dashboard is read‑heavy initially (view orders, basic status updates).

## Next Steps Checklist
- [ ] Finalize backend framework choice and folder structure.
- [ ] Define initial DB schema (users, products, carts, orders, payments).
- [ ] Design and document REST API endpoints and response shapes.
- [ ] Implement auth (registration, login, sessions/JWT, protected routes).
- [ ] Implement product listing with search, filters, and pagination.
- [ ] Implement cart state (client + server) and basic checkout API.
- [ ] Integrate Stripe (PaymentIntent creation, webhook handler, order state sync).
- [ ] Implement minimal order management dashboard (customer + admin views).
- [ ] Set up environment configs and deployment pipeline for dev/prod.