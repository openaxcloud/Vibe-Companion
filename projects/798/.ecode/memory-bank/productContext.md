# Product & UX Context – Memory Bank

## Problem & Value
- Need: A modern marketplace where users can discover products, compare options, and purchase securely.
- Business value: Enable multiple sellers (future), centralized catalog, streamlined checkout, and operational visibility via an order dashboard.

## Target Users
- Shoppers: Browse/search products, manage carts, place and track orders.
- Admins: Manage catalog, monitor orders, handle fulfillment issues and refunds.
- Future Vendors: Manage own inventory and orders (planned but not in first iteration).

## UX Goals
- Fast product discovery (search + filters + clear categories).
- Frictionless cart and checkout with minimal steps.
- Clear status feedback for payments, order success/failure, and delivery states.
- Mobile-friendly layout for catalog, cart, and checkout.

## Core User Flows to Preserve
- Browse catalog → filter/sort → product detail → add to cart.
- View cart → edit quantities/remove → proceed to checkout.
- Checkout → login/register (if not authenticated) → shipping & billing → Stripe payment → confirmation.
- User views order history → order detail (line items, payment status, shipping status).
- Admin logs in → views orders list → filter by status/date → update status (e.g., pending → shipped).
