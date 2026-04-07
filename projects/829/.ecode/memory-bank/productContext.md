# Product & UX Context (Memory Bank)

## Problem Statement
- Need a ready-to-extend marketplace template that handles end‑to‑end commerce: browsing, buying, and managing orders.
- Must be easy for devs to maintain and for non‑technical staff to operate (e.g., catalog, orders).

## Target Users
- Shoppers: discover products, compare, buy quickly and safely.
- Store staff/admins: manage products, monitor orders, handle issues/refunds.
- Developers: customize and extend marketplace without fighting the architecture.

## UX Goals (remember as guardrails)
- Fast browsing: responsive catalog pages with quick filters and search.
- Predictable cart: always visible/accessible, preserving state across navigation.
- Trustworthy checkout: clear pricing, shipping, taxes, and payment security cues.
- Simple account flows: minimal friction for signup/login; guest checkout considered later.
- Clear admin insights: at-a-glance order status, payments, and basic metrics.

## Key User Flows
- Shopper:
  - Land on home → browse catalog → apply filters/search → view product → add to cart → view cart → checkout → payment (Stripe) → order confirmation.
- Returning shopper:
  - Login → view past orders → reorder / track order.
- Admin:
  - Login → view orders list → filter by status/date → open order → update status (paid/shipped/cancelled/refunded).
  - Manage catalog: create/update products, prices, inventory, visibility.
