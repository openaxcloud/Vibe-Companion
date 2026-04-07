# Product & Domain Context – Memory Bank

## Problem Statement
- Need a scalable marketplace where users can discover products and pay securely via Stripe.
- Must support clear order lifecycle and an admin view for managing catalog and orders.
- Memory Bank ensures domain rules and flows remain consistent as the app evolves.

## Target Users
- Shoppers: browse, search, filter, purchase products, view order history.
- Admins/Sellers: manage inventory, pricing, orders, and fulfillment status.
- Developers: rely on Memory Bank for stable product rules and flows.

## UX Goals (Persist in Memory Bank)
- Fast, intuitive product discovery (search + filters always visible and performant).
- Predictable cart/checkout behavior (no hidden steps, clear error handling).
- Transparent payment states (pending, succeeded, failed, refunded) reflected in UI.
- Clear separation between shopper and admin experiences.

## Key User Flows to Preserve
- Product discovery: landing → search/filter → product detail → add to cart.
- Checkout: cart → shipping/billing info → Stripe payment → confirmation → order detail.
- Auth: signup/login → maintain session → access profile/order history.
- Admin catalog: login as admin → list products → create/edit/deactivate products.
- Admin orders: view orders → inspect details → update status (e.g., mark shipped).

## Non-Functional Considerations
- Performance for large catalogs (search + filter strategies documented separately).
- Security: Stripe integration patterns, auth/session rules, data exposure limits.
- Auditability: being able to reconstruct how/why an order changed states.
