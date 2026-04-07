# Memory Bank – Product Context

## Problem Statement
- Need a foundational marketplace app for selling products online with discoverability, smooth checkout, and basic operational tooling.
- Must be production-minded (Stripe, auth, order management) but small enough for a focused implementation.

## Target Users
- Shoppers: browse products, manage carts, place orders securely.
- Admin/Operations: manage catalog, view orders, update statuses.
- Developers: extend and maintain the platform easily over time.

## UX Goals
- Frictionless browsing: fast search, intuitive filters, clear product details.
- Predictable checkout: clear order summary, transparent pricing, easy payment.
- Trust and safety: visible security cues, reliable payment, sensible error handling.
- Accessible UI: keyboard navigation, semantic HTML, ARIA where needed.

## Key User Flows to Remember
- Visitor → browse catalog → view product → add to cart → checkout as guest or sign up.
- Auth user → sign in → cart persists across sessions → complete Stripe payment → order confirmation.
- Admin → sign in → view orders list → inspect specific order (items, user, payment status) → update order status.
- Admin → manage catalog (create/update products, inventories, prices) – minimal at first.
