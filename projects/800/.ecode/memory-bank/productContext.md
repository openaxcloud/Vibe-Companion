# Product Context – What the Memory Bank Remembers

1. **Problem Statement:**
   - Build a marketplace where users can browse products, search and filter, add to cart, pay via Stripe, and track orders, while operators manage catalog and orders.
2. **Target Users & Roles:**
   - **Buyers:** Browse, search/filter, add to cart, checkout, see order history.
   - **Sellers/Operators:** Manage products, inventory, and order fulfillment.
   - **Admins (optional):** Oversee marketplace, resolve disputes, manage users.
3. **Core UX Goals:**
   - Fast, discoverable catalog with responsive search and filters.
   - Frictionless cart and checkout with clear Stripe payment flow.
   - Transparent order status and history for buyers.
   - Simple, actionable order management dashboard for operators.
4. **Key User Flows to Track in Memory:**
   - **Authentication:** sign up, login, logout, password reset; role handling.
   - **Catalog:** browse categories, text search, apply filters (price, category, etc.), view product details.
   - **Cart:** add/remove items, adjust quantity, persist cart across sessions.
   - **Checkout:** shipping/billing info, review order, Stripe payment, confirmation.
   - **Orders:** order summary, status updates, cancellation/refunds (if in scope).
   - **Dashboard:** list orders, update status, view payment state from Stripe.
5. **Non‑functional Context to Remember:**
   - Mobile‑friendly layout.
   - Reasonable performance for search/filter on medium catalogs.
   - Clear error handling for payment and auth issues.
6. **Future Memory Hooks:**
   - Any later decisions about multi‑vendor vs single‑vendor behavior.
   - Localization, tax/shipping rules, and regulatory constraints once defined.
