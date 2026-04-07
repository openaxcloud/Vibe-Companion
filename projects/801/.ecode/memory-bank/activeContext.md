# Active Context – Current Focus & Next Steps for Memory Bank

1. **Current Phase:** Initial setup of the marketplace architecture and the Memory Bank structure.
2. **Memory Bank Initial Focus:**
   - Capture high‑level domain model: users (buyer/seller/admin), products, carts, orders, payments.
   - Define canonical order state machine and link it to Stripe events.
   - Record initial search/filter requirements and catalog schema.
3. **Immediate Tasks (Checklist):**
   - [ ] Define and document the core entities and their relationships.
   - [ ] Decide and log auth strategy (JWT vs sessions) and role/permission model.
   - [ ] Specify Stripe payment flow (Elements vs Checkout, one‑time vs future payments).
   - [ ] Document order lifecycle and refund/cancellation rules.
   - [ ] Establish naming conventions for env vars and config.
   - [ ] Create sections in Memory Bank for: Domain Rules, API Contracts, UX Flows, Integrations, and Ops.
4. **Short‑Term Next Steps:**
   - [ ] As endpoints are designed, store their contracts and error codes.
   - [ ] Capture any deviations from this initial plan and why.
   - [ ] Add onboarding notes so new team members can rely on the Memory Bank as a single source of truth.
