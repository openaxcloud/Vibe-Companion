# Memory Bank – Product & UX Context

## Problem & Product Framing
- Build a multi‑seller e‑commerce marketplace where users can browse products, use search/filters, add to cart, and pay via Stripe.
- Support sellers/admins with an order management dashboard.

## Target Users
- Buyers: discover products, compare options, complete secure checkout quickly.
- Sellers/Admins: track orders, see payment status, manage catalog (MVP: catalog may be admin‑curated only).

## UX Intent (to be remembered)
- Product discovery: searchable catalog with filters (category, price, possibly rating/availability).
- Clear cart & checkout: cart review, shipping/billing details, final order summary, Stripe‑hosted or Stripe Elements payment.
- Trust & feedback: visible order status, email/UX confirmation after payment.

## Key User Flows
- Anonymous user: browse catalog → search/filter → view product detail → (prompt to sign in/sign up on checkout).
- Authenticated buyer: add to cart → view/edit cart → checkout → Stripe payment → order confirmation with status.
- Seller/admin: sign in → view orders list → drill into order details (items, buyer info, payment/fulfillment state).

## Memory Focus
- Always assume marketplace behavior (multiple sellers possible) even if the first iteration has a single admin.
- Stripe is the primary payment processor; flows should align with Stripe‑recommended patterns.
