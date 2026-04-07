# Active Context & Next Steps – Memory Bank

## Current Focus
- Initial setup of project structure, core dependencies, and minimal vertical slice.
- Establish shared conventions before heavy feature work.

## Immediate Priorities
- Decide and fix the backend framework choice (Express/Fastify/Nest) and ORM.
- Scaffold frontend and backend folders with TypeScript configs.
- Implement health‑check endpoint to validate stack wiring.

## Next Steps Checklist
- [ ] Initialize monorepo or two packages (`frontend`, `backend`) with TypeScript.
- [ ] Configure linting/formatting (ESLint + Prettier) and basic CI checks.
- [ ] Set up Postgres locally and configure `DATABASE_URL`.
- [ ] Define core DB schema (users, products, categories, carts, orders, payments).
- [ ] Implement basic auth (signup/login, secure session/JWT flow).
- [ ] Build product listing API + React page (server data + filters UI skeleton).
- [ ] Implement cart API + React cart state connected to backend.
- [ ] Integrate Stripe Checkout/PaymentIntents end‑to‑end on sandbox keys.
- [ ] Add order creation and status update from Stripe webhooks.
- [ ] Create minimal admin dashboard page with order list + detail view.

## Memory Notes
- Keep each vertical slice (e.g., “browse → add to cart → checkout”) working end‑to‑end early.
- Document any new decisions here as they are made (auth method, framework picks, DB schema changes).
