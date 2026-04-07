# Product & UX Context – Memory Bank

## Problem Statement
- Need a straightforward marketplace where users can reliably find products, purchase via Stripe, and track orders.
- Existing options may be over‑complex for a focused catalog or lack streamlined order management for small operators.

## Target Users
- Buyers: end‑users browsing and purchasing products.
- Admins/Operators: internal staff managing catalog, inventory visibility, and orders.

## UX Goals
- Fast discovery: simple search bar + clear category/price filters.
- Low‑friction checkout: minimal steps from cart to payment confirmation.
- Trust & clarity: visible totals, fees, and statuses at every step.
- Mobile‑friendly layouts for listing, cart, and checkout.

## Key User Flows to Preserve
- Browsing: Home → Product listing → Filter/search → Product details.
- Cart & Checkout: Product details → Add to cart → View cart → Checkout → Stripe payment → Order confirmation.
- Authentication: Sign up / Login → Persisted session → Access to order history.
- Order Management (Admin): Login as admin → Order list → View order details → Update status (e.g., processing, shipped).

## Non‑Goals (v1)
- No social/sharing features, reviews/ratings, or wishlists.
- No multi‑tenant marketplace (separate seller accounts) in the first iteration.

## Memory Notes
- Keep flows simple and explain each step (esp. payment) with clear copy.
- Design UX so most tasks complete in 3–5 clicks from landing page.
