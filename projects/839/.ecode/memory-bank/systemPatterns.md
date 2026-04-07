# System & Architecture Patterns – Memory Bank

## High‑Level Architecture
- SPA front end (React + TypeScript) consuming a typed HTTP/JSON API.
- Backend in TypeScript (Node.js) exposing REST (or minimal RPC‑style) endpoints.
- Postgres (or similar relational DB) for products, users, carts, and orders.
- Stripe integration for payments + webhooks for asynchronous events.

## Domain Boundaries
- Catalog: products, categories, variants, inventory count.
- Accounts: users, roles (buyer, admin), sessions/tokens.
- Commerce: carts, line items, checkout sessions, orders, payments.
- Operations: order status changes, basic audit fields.

## Key Patterns & Decisions
- Layered backend: controllers → services (domain logic) → repositories (DB access).
- DTOs and domain models in TypeScript, shared types across FE/BE when possible.
- Auth: JWT or session‑based auth, stored securely (HTTP‑only cookies preferred).
- Stripe: server creates Checkout Sessions/PaymentIntents; webhooks confirm payment and update order status.

## State & Data Flow
- React Query (or similar) for data fetching, caching, and synchronization.
- Client state for UI (filters, modal state, cart preview) + server state for cart, orders.
- All price calculations validated server‑side to avoid tampering.

## Cross‑Cutting Concerns
- Logging/metrics hooks in backend service layer for key flows (checkout, payments).
- Input validation at API boundary with a schema library (e.g., Zod/Yup).
- Role‑based access control on admin endpoints.

## Memory Notes
- Prefer explicit, simple APIs over clever abstractions.
- Maintain Stripe idempotency and webhook signature verification from day one.
