# Product Context – Memory Bank

## Problem Statement to Remember
- Build a full-stack e-commerce *marketplace* (not just a single-store shop) with Stripe payments.
- Must support exploring products via search and filters, managing a cart, and completing a full checkout.
- Must support authenticated users and an order management dashboard for post-purchase workflows.

## Target Users
- Buyers: browse, search, filter products, manage cart, checkout with card, track orders.
- Sellers/Admins: manage product catalog and view/handle orders via dashboard.

## UX Goals to Persist
- Fast, responsive product discovery with clear filters and search.
- Straightforward cart and checkout minimizing friction (few steps, clear validation).
- Clear feedback around payment status and order confirmation (Stripe-driven states).
- Simple, role-aware dashboard for managing orders.

## Key User Flows to Keep in Mind
- Anonymous browse → search/filter products → add to cart → optional sign up/login → checkout → payment via Stripe → order confirmation.
- Authenticated user: login → see existing cart/orders → continue shopping → checkout.
- Admin/seller: login → open dashboard → view order list → inspect order details → update status.

## Memory Bank Use
- Preserve agreed user flows and UX goals so later design decisions align with them.
- When new flows are added (e.g., refunds, returns), they should be appended here for future reference.