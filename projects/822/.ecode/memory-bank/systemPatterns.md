# System Architecture & Patterns (Memory Bank)

## High-Level Architecture
- Client: React (TypeScript) SPA + router, talking to a backend API.
- Backend: TypeScript (e.g., Node/Express/Nest) REST/GraphQL API.
- DB: Relational (e.g., Postgres) with tables for users, products, carts, orders, payments.
- Integrations: Stripe (Checkout / Payment Intents + Webhooks).

## Key Decisions to Preserve
- Auth: likely JWT-based with HTTP-only cookies; roles: shopper, admin/vendor.
- Payments: server-initiated Stripe Payment Intents; store payment status in orders.
- Product search: backend filtering + text search; client keeps URL-based filter state.
- Cart: server-side cart per user + guest cart synced on login.

## Design Patterns
- Layered backend: controllers/routes → services → repositories → database.
- DTOs and type-safe models shared between front and back (when feasible).
- React: container/presentational components; hooks for data fetching; global state for cart/auth.
- Error handling: centralized middleware on backend; toast/inline messages on frontend.
- Webhooks: idempotent processing with event log table.
