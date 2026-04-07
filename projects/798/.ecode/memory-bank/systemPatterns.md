# System Architecture & Patterns – Memory Bank

## High-Level Architecture
- Client: React + TypeScript SPA consuming a JSON REST (or minimal GraphQL) API.
- Server: TypeScript backend (Node) exposing auth, catalog, cart, checkout, and order APIs.
- Data: Relational database (e.g., Postgres) for products, users, orders, payments.
- Payments: Stripe integration via server-side SDK and client-side Stripe.js.

## Key Design Patterns
- Layered architecture: controllers → services → repositories → DB.
- DTOs and domain models separate from persistence models for clarity.
- Auth pattern: JWT-based sessions (HTTP-only cookies) with role-based access (user/admin).
- Cart handling: server-side cart tied to user; fallback to local storage for guests.
- Idempotent payment/checkout: use Stripe Payment Intents + webhook reconciliation.

## Important Decisions to Remember
- Marketplace is initially single-tenant with a global product catalog (per-vendor rules later).
- Search & filter implemented via DB queries + indexed columns; no external search engine in v1.
- Order state machine: created → payment_pending → paid → fulfilled/shipped → completed/cancelled.
- Webhooks from Stripe stored and processed in a dedicated table for auditability.

## Cross-Cutting Concerns
- Consistent error format for API responses for easier client handling.
- Centralized logging & request tracing for payments and order operations.
- Strict validation on all inputs (especially checkout and payment endpoints).
