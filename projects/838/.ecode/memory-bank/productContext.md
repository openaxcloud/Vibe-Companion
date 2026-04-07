# Product Context – Memory Bank

## Problem Statement
- Need a modern marketplace web app that supports browsing a catalog, adding items to a cart, and paying securely with Stripe.
- Must support authenticated customers and an internal admin who manages products and orders.
- Experience should be fast, intuitive, and mobile‑friendly.

## Target Users
- Shoppers: browse, search, filter, add to cart, checkout, view order history.
- Admin/Operations: manage products and inventory, review and update orders, handle support.

## UX Goals
- Clear navigation: Home, Catalog, Product Detail, Cart, Checkout, Account, Admin.
- Cart and checkout must be frictionless, with minimal required fields and clear validation.
- Secure and trustworthy payment UX: explicit total, fees, and confirmation.
- Simple admin dashboard focusing on visibility: orders list, search, filter by status.

## Key User Flows to Preserve
- Guest to User Conversion:
  - Guest browses → adds to cart → prompted to sign up / log in at checkout → completes order.
- Authenticated Purchase:
  - User logs in → uses existing addresses/payment methods (if supported by Stripe) → quick checkout.
- Catalog Exploration:
  - User lands on catalog → applies filters (category, price, sort) → opens product → adds to cart.
- Order Management (Admin):
  - Admin logs in → sees recent orders (Pending first) → opens order detail → changes status (e.g., Pending → Shipped) → notes are stored.
- Order Self‑Service:
  - User logs in → views order history → opens order detail → sees items, totals, and status.
