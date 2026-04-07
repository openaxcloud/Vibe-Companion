# Product Context – What This Memory Bank Tracks

## Problem & Domain
- Build a **multi-vendor e‑commerce marketplace**: users browse/search products, add to cart, checkout via Stripe; vendors/admins manage orders.
- Core complexity centers on: marketplace catalog, cart/checkout, Stripe payment/intents/webhooks, and role-based access (buyer, vendor, admin).

## Target Users
- **Shoppers**: discover, compare, and purchase products quickly and safely.
- **Vendors**: list/manage products, process and track orders, view payouts.
- **Admins**: oversee catalog, users, orders, and handle exceptions/refunds.

## UX Goals to Remember
- Simple, frictionless cart and checkout (minimal steps, clear error states).
- Search + filters fast and intuitive (category, price range, tags, availability).
- Clear order status lifecycle for both buyers and vendors.
- Transparent and trustworthy payment UX (secure, recognizable Stripe patterns).

## Key User Flows to Preserve in Memory
- **Browse/Search** → Filter → View Product → Add to Cart.
- **Cart** → Update quantities/remove items → Proceed to Checkout.
- **Checkout** → Address & shipping (if applicable) → Stripe payment → Order confirmation.
- **Auth**: sign-up/login/logout; password reset; possibly social login later.
- **Order Management**: vendors/admins viewing orders, updating statuses, issuing refunds.

## What Memory Should Capture Here
- Canonical flow diagrams/notes for checkout and payment states.
- Agreed terminology (e.g., "Order" vs "PaymentIntent" vs "Charge").
- UX decisions that affect back-end contracts (e.g., how we show partial failures or pending payments).