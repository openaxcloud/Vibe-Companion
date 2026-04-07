# Active Context – Current Focus & Next Steps

1. **Current Focus for Memory Bank:**
   - Capture foundational decisions and conventions before implementation begins.
   - Maintain a persistent map of domains (catalog, cart, payments, orders, auth).
2. **What Is Already Known (and stored):**
   - Project goal and core features: marketplace with Stripe, catalog search/filters, cart + checkout, auth, order dashboard.
   - High‑level architecture (React TS frontend + TS backend + Stripe + DB).
3. **Immediate Next Steps (to track as checklist):**
   - [ ] Decide and record backend framework (e.g., Express vs Nest) and ORM.
   - [ ] Define initial data models for User, Product, Cart, Order, Payment.
   - [ ] Choose state management and UI library for React and store that choice.
   - [ ] Define API surface (routes, request/response schemas) for main flows.
   - [ ] Specify auth strategy (JWT vs sessions) and flows (signup/login/reset).
   - [ ] Outline end‑to‑end checkout sequence with Stripe (including webhooks).
4. **Near‑Term Memory Additions Planned:**
   - Detailed ER diagram or entity list with relationships.
   - Page/route map for the frontend (catalog, product, cart, checkout, dashboard).
   - Error and edge‑case handling policies for payments and orders.
5. **How Memory Will Be Used Going Forward:**
   - As a canonical context when generating code, tests, and docs.
   - To keep future architectural changes consistent with earlier decisions, or to mark them as intentional deviations.
