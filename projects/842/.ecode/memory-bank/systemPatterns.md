# Memory Bank – System Patterns & Architecture

## Overall Architecture
- Full-stack TypeScript app: React front-end + Node/Express (or similar) backend + Postgres (or similar RDBMS).
- API as BFF for React (REST/JSON); future-ready for separate clients.

## Key Patterns to Record
- Auth: JWT-based sessions (HTTP-only cookies) with role-based access (user, admin, optional vendor).
- Payments: Stripe Checkout or Payment Intents; webhooks for order finalization and refunds tracking.
- Catalog: normalized product schema; separate indexes/strategies for search and filters.
- Cart: server-side cart tied to user (and to anonymous session pre-login) with merge-on-login behavior.

## Domain Modules
- Users & Auth, Products & Catalog, Cart & Checkout, Orders, Payments, Admin/Dashboard.

## Cross-Cutting Concerns
- Validation: central DTO/schema validation (e.g., zod/yup) at API boundary.
- Error handling: consistent error envelope for front-end consumption.
- Logging & observability: minimal request logs + Stripe event logs; expand later.
- Security: Stripe keys & webhook secrets in env; CSRF protection via cookies; input sanitization.

## Decisions to Capture Over Time
- Choice of search implementation (DB-only vs external search service).
- Stripe integration mode and webhook retry/verification strategy.
- Order state machine design (pending, paid, shipped, cancelled, refunded, etc.).
