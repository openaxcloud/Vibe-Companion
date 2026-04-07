# Product & UX Memory Bank

## Problem & Value
- Need a simple but scalable marketplace for small/medium sellers to list products and accept secure online payments.
- Buyers get a familiar, frictionless shopping experience; sellers get basic order and product management.

## Target Users
- Buyers: consumers browsing catalog, expecting fast search, clear pricing, and reliable checkout.
- Sellers: small merchants who manage inventory and view orders in a dashboard.
- Admins: internal operators overseeing users, products, and dispute handling.

## UX Priorities to Preserve
- 3‑click path from landing → product → add to cart → checkout.
- Clear separation between browsing and managing (buyer vs seller dashboards).
- Always show cart status (item count, subtotal) in header.
- Minimize friction in checkout: single page or clear multi‑step flow.

## Key User Flows (Canonical)
- Buyer: visit home → search/filter → view product → add to cart → view cart → checkout → Stripe payment → order confirmation → view order history.
- Seller: login → seller dashboard → create/edit products → view incoming orders → update order status.
- Admin: login → admin dashboard → manage users/products → inspect orders.

## UX Constraints / Non‑Goals
- No guest checkout in v1 (simplify auth + order history).
- Limit product detail fields to essentials: title, price, images, description, stock, seller.
