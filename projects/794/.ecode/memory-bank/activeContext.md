# Active Context – Current Focus & Checklist

1. **Current Phase:** Initial architectural setup and Memory Bank bootstrapping.
2. **Memory Bank Current Focus:**
   - Pin down high-level architecture and data model for catalog, cart, users, and orders.
   - Decide and document checkout + Stripe integration strategy.
3. **Immediate Decisions to Capture:**
   - Choice of backend framework and ORM.
   - Database type and first version of schema (users, products, carts, orders, payments).
   - Auth approach (JWT vs sessions; cookie vs localStorage usage).
4. **Next Steps Checklist:**
   - [ ] Define and record ERD for products, users, carts, orders, payments.
   - [ ] Specify order lifecycle states and transitions (pending, paid, shipped, cancelled, refunded).
   - [ ] Choose Stripe flow (Checkout Session vs Payment Intents) and document sequence.
   - [ ] Outline REST endpoints for catalog, cart, auth, orders, Stripe webhooks.
   - [ ] Decide on frontend routing structure and state management approach for cart and auth.
   - [ ] Create initial `.env.example` documenting all necessary env vars.
   - [ ] Establish documentation rules: where new knowledge lives in the Memory Bank.
5. **Short-term Outcome:**
   - A minimal but coherent architecture with a synchronized Memory Bank, ready for feature implementation.
