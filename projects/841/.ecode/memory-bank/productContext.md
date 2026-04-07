# Product Context & UX Memory

## Problem & Value
- Need: A modern, secure marketplace where users can browse products, add to cart, pay via Stripe, and track orders.
- Value: Sellers get a manageable catalog & order interface; customers get a smooth, trustworthy shopping experience.

## Target Users
- Customers: browse, search, filter, purchase products, view order history.
- Admins: manage catalog, users, and orders; handle refunds and manual fulfillment updates.
- Vendors (future-focused): manage their own products and see their orders (may initially be combined with admin role).

## UX Goals (sticky decisions)
- Frictionless browsing: fast search, responsive filters, visible product metadata (price, stock, rating placeholder).
- Transparent checkout: clear order summary, shipping & tax breakdown, Stripe-hosted payment for trust.
- Consistent authentication UX: simple login/signup, password reset, and protected routes for dashboards.
- Mobile-first layout, with a focus on quick add-to-cart and quick checkout.

## Key User Flows to Preserve
- Guest → Browse → Search/Filter → View Product → Add to Cart → Create Account/Login → Checkout via Stripe → Order Confirmation.
- Authenticated user → Persistent cart across sessions → Checkout using saved details where possible.
- Admin → Login → View Orders → Change status (fulfill/ship/cancel) → View basic order timeline.
- Admin → Manage Products: create/edit products, toggle active status, adjust stock.
