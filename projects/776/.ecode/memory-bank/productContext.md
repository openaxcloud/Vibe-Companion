# Product Context in Memory Bank

1. **Problem Statement:** Build a scalable multi‑vendor e‑commerce marketplace where users can browse/search products, purchase via Stripe, and track orders; admins/vendors can manage products, inventory, and orders.
2. **Target Users:**
   - Shoppers: browse, filter, buy, track orders, manage accounts.
   - Vendors/Admins: manage catalog, inventory, orders, and fulfillment.
3. **Core UX Goals:**
   - Fast, intuitive product discovery (search + rich filters).
   - Frictionless cart and checkout experience with Stripe.
   - Clear order status visibility and notifications.
   - Mobile‑first responsive design with optional dark mode toggle.
4. **Key User Flows to Preserve in Memory:**
   - **Browse & Discover:** home → category → filtered/search results → product detail.
   - **Cart & Checkout:** add to cart → view/edit cart → address & shipping → Stripe payment → confirmation.
   - **Auth & Accounts:** sign up / log in → manage profile → view order history.
   - **Vendor/Admin:** login → product CRUD → inventory updates → review/fulfill orders.
5. **Non‑Functional UX Requirements:**
   - Reliable performance on mobile devices.
   - Accessible UI (color contrast, keyboard navigation, dark mode accessible choices).
   - Clear error handling and validation, especially in checkout.
6. **Memory Focus:** Track UX decisions (navigation patterns, filter behavior, checkout steps, dark mode behavior) so later changes don’t break core flows.
