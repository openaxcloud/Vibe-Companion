# Product Context – Memory Bank Focus

1. **Problem Statement:** Multi‑feature e‑commerce marketplaces become inconsistent over time; payment flows, search behavior, and order rules drift across code paths and teams. The Memory Bank anchors all product and domain knowledge.
2. **Target Users of Memory Bank:**
   - Developers implementing features (catalog, cart, checkout, dashboards).
   - Product managers defining business rules (fees, refunds, shipping, roles).
   - Designers maintaining UX consistency across search, cart, and dashboards.
3. **Domain Areas to Capture:**
   - Product catalog structure, attributes, category taxonomy, search/filter rules.
   - Cart behaviors, validation rules, promotions/discount logic.
   - Checkout constraints: address rules, tax and shipping policy, Stripe integration details.
   - User roles: buyers, sellers, admins; permissions and visibility rules.
   - Order lifecycle: placed → paid → fulfilled → shipped → completed/refunded.
4. **UX Goals to Encode:**
   - Frictionless, predictable checkout with clear Stripe error handling.
   - Fast product discovery via well‑defined filters and search relevance.
   - Clear order history and dashboard insights for both buyers and sellers.
5. **Key User Flows to Document in Memory:**
   - "Browse & Search" → filter → product detail → add to cart.
   - "Cart Management" → adjust quantities → apply coupon → proceed to checkout.
   - "Checkout" → auth/login → address & shipping → payment via Stripe → confirmation.
   - "Seller Dashboard" → create/edit products → manage stock → monitor orders.
   - "Admin / Ops" → dispute handling, refunds, manual adjustments.
6. **Non‑Goals for Memory Bank:** End‑user facing copywriting; it stores rules and intent, not marketing content.
