# Memory Bank – Active Context & Next Steps

## Current focus (initial setup phase)
- Clarify domain boundaries: products, carts, orders, payments, users.
- Decide on exact Node framework (Express vs Nest) and DB tooling.
- Choose state management/data fetching patterns in React (e.g., React Query + simple store for cart).
- Establish baseline integration plan for Stripe (Checkout vs custom payment flow with Payment Intents).

## Immediate next steps (checklist)
- [ ] Define user roles (buyer, admin, and whether vendor is a separate role now or later).
- [ ] Sketch data models: User, Product, ProductVariant (if needed), Cart, CartItem, Order, OrderItem, Payment.
- [ ] Decide auth strategy (built-in JWT vs using a third-party provider) and session lifetime.
- [ ] Specify cart behavior: logged-out carts, persistence after login, one-cart-per-user rules.
- [ ] Choose how search and filters work (simple SQL + indexes vs external search later).
- [ ] Draft order lifecycle: CREATED → PAID → FULFILLED → CANCELLED/REFUNDED and how Stripe states map.
- [ ] Plan webhook handling strategy (dedicated endpoint, idempotency keys, logging).
- [ ] Create initial .env template and document all required variables.
- [ ] Set up basic CI checks (lint, typecheck, tests) once repo structure is in place.
