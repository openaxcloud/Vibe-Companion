# Product Context – What the Memory Bank Remembers

1. **Problem Statement:**
   - Building a complex marketplace (Stripe, catalog, search, cart, checkout, auth, orders) leads to scattered tribal knowledge.
   - Without structure, flows like payments, refunds, and order states diverge between code, UI, and tests.
2. **Target Users (of the Memory Bank):**
   - Devs implementing catalog, cart, checkout, and dashboards.
   - Product and QA defining expected behaviors (e.g., when payment fails, how cart behaves).
3. **UX Goals (Marketplace):**
   - Fast discovery: reliable search and filters for products.
   - Frictionless checkout: minimal steps, clear payment states.
   - Transparent orders: users can see status and history; admins can manage efficiently.
4. **What the Memory Bank Captures for UX:**
   - Canonical user journeys: browse → filter → product detail → cart → checkout → order tracking.
   - Edge cases: expired carts, failed payments, out‑of‑stock flows, partial shipments.
   - Role-based views: customer vs admin (and later vendor) behavior.
5. **Key User Flows to Document:**
   - **Customer:** sign up/login → browse/search/filter → add to cart → modify cart → checkout (Stripe) → view orders.
   - **Admin:** login → view orders list → inspect order details → update status (paid, shipped, refunded).
6. **Decision Recording:**
   - Chosen patterns for search/filter UX (e.g., debounced search, filter persistence).
   - Checkout flow design (single-page vs multi-step, error-copy text).
   - Order lifecycle states and transitions shared across UI, API, and DB.
7. **Non-goals:**
   - Capturing generic e-commerce theory; focus on decisions unique to this project.
