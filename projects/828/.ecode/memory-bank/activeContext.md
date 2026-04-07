# Active Context & Next Steps – Memory Bank

1. **Current Phase:** Initial architecture and setup for full-stack e‑commerce marketplace.
2. **Primary Focus Right Now:**
   - Establish skeleton front-end and back-end projects in TypeScript.
   - Decide on framework specifics (Express vs Nest, ORM choice, UI library).
   - Integrate Stripe in sandbox mode with a simple test checkout.
3. **Key Open Decisions to Lock In:**
   - Single-vendor vs multi-vendor (default: single vendor unless changed here).
   - REST vs GraphQL for the public API (default: REST).
   - Database: PostgreSQL vs MongoDB (default: PostgreSQL + Prisma).
4. **Immediate Next-Step Checklist:**
   - [ ] Initialize repo structure (monorepo or separate `frontend`/`backend`).
   - [ ] Set up TypeScript, linting, formatting, and basic CI.
   - [ ] Implement basic auth model and endpoints (register/login/me).
   - [ ] Define initial DB schema for User, Product, Order, OrderItem, CartItem.
   - [ ] Implement product listing API with pagination and basic filters.
   - [ ] Create React pages for catalog and product detail using mock data.
   - [ ] Wire up cart state management on the client.
   - [ ] Implement Stripe test payment flow end-to-end, including webhook.
5. **How This Memory Bank Is Used Going Forward:**
   - Persist final decisions (frameworks, libraries, naming) as they are made.
   - Keep domain models and API contracts synchronized here.
   - Update active checklist as milestones are completed and new ones appear.
