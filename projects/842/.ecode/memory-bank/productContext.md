# Memory Bank – Product Context

## Problem & Vision
- Need a multi-vendor e-commerce marketplace with secure Stripe payments.
- Must support discoverable product catalog (search + filters), frictionless cart/checkout, and clear order tracking.

## Target Users
- Shoppers: browse/search products, manage cart, pay securely, view order history.
- Vendors (if supported later): manage listings, pricing, stock, and see orders.
- Admins/Operators: monitor orders, manage disputes, handle catalog and user issues.

## UX Goals
- Fast search/filter experience (responsive, no confusing empty states).
- Simple checkout: minimal steps, clear error states for payments.
- Transparent order status and history for users; efficient dashboard for admins.

## Key Flows to Remember
- Anonymous → signup/login → persistent cart → checkout with Stripe → order confirmation.
- Authenticated user: view/edit profile, addresses, saved payment methods (if supported), order history.
- Admin: search/filter orders, change order status, refund via Stripe Dashboard (initially), later via API.

## Product Assumptions (Track Here)
- MVP: one marketplace brand, Stripe as sole PSP, no complex promotions initially.
- Shipping and tax rules: start simple (flat or per-region) and record any rule changes.
