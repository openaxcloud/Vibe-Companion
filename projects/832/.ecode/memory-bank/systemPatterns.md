# System Architecture & Pattern Memory Bank

## High‑Level Architecture
- Front‑end: React + TypeScript SPA/CSR with possible incremental SSR later.
- Back‑end: TypeScript Node.js API (REST or tRPC/GraphQL; decide once and keep consistent).
- Database: relational (PostgreSQL preferred) with strong schema for products, orders, users.
- Payments: Stripe Checkout or Payment Intents; webhook‑driven order finalization.

## Core Design Patterns
- Domain modules: `auth`, `catalog`, `cart`, `checkout/payments`, `orders`, `users/sellers`.
- Use a “thin controller, fat domain service” approach on the server.
- Cart stored server‑side, keyed by user (and session for not‑yet‑logged‑in if later added).
- Event‑driven side effects: order status updated from Stripe via webhook events.

## Key Decisions to Lock In
- Single source of truth for monetary amounts: integer minor units (e.g., cents) in DB.
- Order lifecycle: `PENDING_PAYMENT` → `PAID` → `FULFILLED` / `CANCELLED`.
- Inventory decrement on payment success, not on add‑to‑cart.
- Strong separation of Stripe customer/payment IDs from internal user IDs.

## Security & Reliability Patterns
- JWT or session tokens with HTTP‑only cookies; role‑based access control (buyer/seller/admin).
- Idempotent Stripe webhook handlers using event IDs and order/payment records.
- Input validation at API boundary (e.g., Zod) and trusted types internally.
- Logging key business events (order created, paid, refunded).
