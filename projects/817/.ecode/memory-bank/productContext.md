# Product Context – Memory Bank

## Problem & Vision
- Problem: Small and mid-sized merchants need a simple marketplace experience to list products, let users search/browse, buy securely, and track orders without heavy custom development.
- Vision: A modern, Stripe-enabled marketplace web app optimizing for clarity, speed, and trust for buyers; operational visibility for admins.

## Target Users
- Buyers: browse/search products, manage cart, checkout securely, view orders.
- Admins/Operators: manage product catalog, monitor payments, process/fulfill orders.
- (Optional future) Sellers: manage their own listings and orders.

## UX Goals
- Frictionless discovery: clear navigation, search box on primary pages, fast filters (category, price, rating).
- Checkout clarity: minimal steps, transparent pricing (taxes, shipping), and clear Stripe-backed payment form.
- Trust & safety: visible security cues, consistent error handling, and robust order history.

## Key User Flows (v1)
- Browse/Search: Home → category/search → filtered list → product detail.
- Cart: Product detail/list → add to cart → view cart → adjust quantities → proceed to checkout.
- Checkout: Login/signup (if not yet) → shipping info → payment via Stripe → order confirmation.
- Auth: Signup → email/password login → session persistence → logout.
- Orders (buyer): Account → order list → order detail (items, status, Stripe payment ref).
- Orders (admin): Admin dashboard → orders table → filter by status/date → update status (fulfill/cancel) → optional refund trigger.

## Product Assumptions to Remember
- Single default currency (e.g., USD) in v1; multi-currency deferred.
- Taxes and shipping modeled simply (flat or rule-based), no complex tax jurisdiction engine initially.
- No guest checkout in v1 (requires account to complete payment).