# Memory Bank – Product Context

## Problem / Need
- We are building a **marketplace**, not a simple single-store shop.
- Buyers need an easy way to discover products, compare, and buy securely.
- Admins (and possibly vendors) need clear visibility into orders, statuses, and payouts.

## Target users to remember
- **Buyers**: browse, search, filter, save cart, complete checkout.
- **Admins**: manage catalog, users, and orders, see payment status.
- **(Optional future) Vendors**: manage their own products and orders.

## UX principles to keep in mind
- Fast discovery: search bar always accessible, filters quick to adjust, sensible defaults.
- Cart should feel persistent and trustworthy (no unexpected clearing between sessions if logged in).
- Checkout: minimal friction, clear step indicators, obvious error handling for Stripe failures.
- Clear separation of buyer vs admin flows; no leakage of admin tools into buyer UI.

## Core user flows to preserve as memories
- Buyer: land → search/filter → view product → add to cart → modify cart → checkout → payment → order confirmation.
- Auth: sign up / login → maintain session → view orders → logout.
- Admin: login → view orders by status → inspect order detail (Stripe charge, shipping info) → update status.

## Product rules worth remembering
- Decide if guest checkout is allowed or if auth is required before payment.
- Define how inventory is checked and reserved during checkout.
- Clarify refund / cancellation rules and who triggers them (admin only vs buyer self-service).
