# Product Context – Memory Bank

## Problem Statement
- Need a multi‑user e‑commerce marketplace that supports browsing products, adding to cart, paying via Stripe, and managing orders.
- Must be reliable, secure, and intuitive for non‑technical buyers and sellers/admins.

## Target Users (Store in Memory)
- Shoppers: browse/search/filter products, manage cart, pay, review orders.
- Admins/Operators: manage product catalog, see orders, track payment status.

## UX Goals
- Fast product discovery with search + filters (category, price, sort, etc.).
- Frictionless cart and checkout; minimal steps from cart to payment.
- Clear order/payment status visibility (pending, paid, failed, refunded).
- Consistent authentication UX (email/password, clear error states) and session persistence.

## Key User Flows (High‑Level)
- Browse Catalog → Search/Filter → View Product → Add to Cart → View Cart → Checkout → Pay via Stripe → Order Confirmation.
- Sign Up / Login → Browse → Purchase → View Order History.
- Admin Login → View Orders Dashboard → Inspect Order Details → Update Fulfillment Status.

## Constraints / Non‑Goals (Good to Remember)
- Marketplace is not initially focused on complex multi‑vendor payouts or inventory per warehouse.
- Mobile‑friendly web app, but no native mobile apps in first phase.