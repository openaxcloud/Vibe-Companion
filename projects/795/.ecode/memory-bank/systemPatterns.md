# System Patterns – Architecture Memory

## High-Level Architecture
- **Frontend**: React + TypeScript SPA (or app) consuming a typed HTTP/JSON API.
- **Backend**: TypeScript (Node) API server (e.g., Express/Nest/Fastify) exposing REST endpoints for auth, catalog, cart, checkout, orders, webhooks.
- **DB Layer**: Relational DB (e.g., Postgres) with ORM (Prisma/TypeORM) for products, users, orders, payments.
- **Stripe Integration**: server-side PaymentIntent + Webhook handling; frontend Stripe Elements/Checkout for card entry.

## Core Design Patterns to Reuse
- **Domain layering**: `controllers → services → repositories → DB` to decouple HTTP from business logic.
- **DTOs & types**: shared TypeScript types (via a shared package or codegen) so frontend and backend agree on shapes.
- **State management**: centralized cart + auth state (e.g., React Query for server state + context/store for client state).
- **Idempotent operations** for Stripe webhooks and order creation (idempotency keys, webhook event logs).

## Cross-Cutting Concerns
- **Auth & Authorization**: JWT or session-based auth, with role-based guards (buyer/vendor/admin) on routes and UI.
- **Validation**: schema-based (e.g., Zod/Yup) at API boundaries; same schemas reused on frontend when feasible.
- **Error Handling**: standardized error shapes (`code`, `message`, `fieldErrors`) and toasts/dialogs on frontend.
- **Logging & Monitoring**: structured logs for payments and order transitions.

## Memory Focus
- Record canonical API contracts for cart, checkout, and order lifecycle.
- Document chosen patterns for Stripe (e.g., when we confirm PaymentIntent, when we mark order as paid).
- Capture conventions: naming (e.g., `OrderStatus`, `PaymentStatus`), folder structure, shared utilities.
- Keep a living list of **non-obvious decisions** (e.g., how we handle price calculations and currency rounding).