# Active Context – Initial Memory Bank Setup

1. **Current Focus:**
   - Establish the Memory Bank structure and seed high-value entries for the new TypeScript e-commerce marketplace.
   - Align team on how/when to update Memory Bank as part of daily work.
2. **Initial Memory Bank Structure (proposed):**
   - `/memory/adr/` – Architecture Decision Records.
   - `/memory/domain/` – Domain models (Product, Cart, Order, User, Payment).
   - `/memory/flows/` – User flows (Search, Add to Cart, Checkout, Stripe, Orders).
   - `/memory/ops/` – Env vars, deployment, and operational notes.
3. **Checklist – Next Steps:**
   - [ ] Create `/memory/` directory and subfolders in the repo.
   - [ ] Add ADR on overall architecture and tech stack choice.
   - [ ] Add domain notes for Product, Cart, Order, User, and Payment models.
   - [ ] Document the end-to-end checkout + Stripe payment intent flow.
   - [ ] Capture initial auth strategy (JWT vs sessions) and roles (customer/admin).
   - [ ] Define how Memory Bank updates are required in PR templates.
   - [ ] Seed ops doc with env vars and Stripe test mode setup.
4. **Short-Term Priorities:**
   - Make sure Stripe integration and order lifecycle are well-documented from the start.
   - Clarify catalog search/filter expectations before implementing backend queries.
5. **Planned Evolution:**
   - Add vendor-specific docs if/when multi-vendor features are implemented.
   - Record scaling decisions (caching, indexing) as traffic grows.
