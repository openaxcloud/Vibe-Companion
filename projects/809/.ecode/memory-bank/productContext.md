# Product & Experience Context – Memory Bank

## Problem Statement
- Build a discoverable, trustworthy marketplace where users can find products, add them to a cart, and pay securely via Stripe.
- Support vendors/admins with an order management dashboard for processing and tracking orders.

## Target Users
- Shoppers: Browse/search products, manage carts, complete secure checkout, view orders.
- Vendors/Admins: Manage inventory (future), review orders, track fulfillment.
- Internal Devs: Extend marketplace features without breaking core commerce flows.

## UX Goals (What Memory Bank Tracks)
- Fast product discovery: search + filters with predictable behavior and empty-state handling.
- Frictionless checkout: minimal required steps, clear errors, Stripe-backed payment trust.
- Clear state transitions: from cart to payment to order confirmation.
- Cohesive auth: obvious login/signup, consistent session behavior across flows.

## Key User Flows to Preserve
- Browse → Filter/Search → Product Detail → Add to Cart → Edit Cart → Checkout → Stripe Payment → Order Confirmation.
- First-time visitor → Signup/Login → Restore/Initialize Cart → Checkout.
- Logged-in user → View Order History → View Order Detail.
- Admin/Vendor → Login → View Orders List → Filter/Sort Orders → View Order Detail (line items, payment status).

## Memory Bank Responsibilities
- Document assumptions per flow (e.g., guest carts vs. auth-only checkout).
- Capture edge cases that impact UX: failed payments, out-of-stock items, invalid filters.
- Record any cross-flow dependencies (e.g., cart tied to user session model).
