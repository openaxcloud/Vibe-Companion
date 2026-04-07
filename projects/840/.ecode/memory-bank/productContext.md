# Memory Bank – Product Context

## Problem & Vision
- Build a marketplace where users can browse/search products, add to cart, and pay via Stripe.
- Support secure, auditable order workflows for both customers and admins.

## Target Users (for remembering personas)
- **Buyer**: Browses catalog, uses search/filters, manages cart, completes checkout, tracks orders.
- **Seller/Admin**: Manages products, pricing, availability, and reviews orders.
- **Ops/Support**: Needs clear order/payment status for issue resolution.

## UX Goals to Persist
- Fast, **search-first** product discovery with intuitive filters (category, price range, rating, etc.).
- **Frictionless cart and checkout**: minimal steps, clear error handling, Stripe-powered payment UI.
- **Trust & transparency**: clear pricing, fees, taxes, and order state (pending, paid, shipped, canceled, refunded).

## Key User Flows to Track
- Auth: sign up / sign in / sign out / password reset.
- Catalog: search, filter, sort, view product details, add/remove from cart.
- Cart: view cart, update quantities, calculate totals, proceed to checkout.
- Checkout: capture shipping/billing info, integrate Stripe, handle success/failure and webhooks.
- Post-purchase: order confirmation, order history, view order details.
- Admin: product CRUD, inventory changes, order state changes, refunds/adjustments.

## Non-Functional Expectations
- Reliable cart persistence across sessions.
- Secure payment and PII handling aligned with Stripe’s best practices.
- Scalable patterns for adding new filters, payment methods, or order states later.
