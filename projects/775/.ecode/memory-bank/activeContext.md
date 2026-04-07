# Active Context: Current Focus & Next Steps (Memory Bank)

1. **Current Phase:** Initial architecture and environment setup for the full-stack marketplace.
2. **Immediate Goals:**
   - Establish project structure (frontend + backend packages, shared types).
   - Confirm auth, product, and order data models.
   - Wire up Stripe sandbox and email sandbox.
3. **In-Progress Decisions:**
   - Final choice of backend framework (Express vs Fastify) and ORM (Prisma vs Knex).
   - Choice of state management on frontend.
4. **Next Steps Checklist:**
   - [ ] Initialize monorepo or two repos with TypeScript configs and tooling.
   - [ ] Define DB schema (Users, Products, Orders, Inventory, Payments) and run initial migration.
   - [ ] Implement basic auth API (register/login/me) + JWT/session handling.
   - [ ] Implement product catalog API (list/search/filter) and seed sample data.
   - [ ] Scaffold React app with routing and base layout (header, footer, theme toggle).
   - [ ] Implement cart state on frontend and basic cart API endpoints.
   - [ ] Integrate Stripe test keys; implement minimal checkout flow (server + client).
   - [ ] Add email service wrapper and send order confirmation on successful payment.
   - [ ] Build minimal admin dashboard (protect by role) for orders and inventory.
   - [ ] Add responsive styles and verify dark mode across key pages.
