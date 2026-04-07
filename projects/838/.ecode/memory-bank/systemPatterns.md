# System Patterns – Memory Bank

## High‑Level Architecture
- Client: React + TypeScript SPA with router, state management (e.g., React Query + minimal global store).
- API: Node/Express (TypeScript) with REST endpoints for auth, products, cart, orders, Stripe webhooks.
- DB: Relational (e.g., Postgres) with schema for users, products, categories, carts, orders, payments.
- Integration: Stripe for payments using PaymentIntents and secure webhooks.

## Key Architectural Decisions
- Use JWT or HTTP‑only session cookies for auth; protect API routes and React routes accordingly.
- Cart is server‑side and keyed by user or anonymous session ID (persisted in cookie/local storage).
- Orders are authoritative records; payment state mirrored from Stripe via webhooks.
- Backend enforces business rules (stock checks, price validation) — never trust client totals.

## Design Patterns
- Domain‑oriented layering:
  - `api` (controllers) → `services` (business logic) → `repositories` (DB) → `models`.
- Use DTOs and validators (e.g., Zod/Yup) for request/response boundaries.
- React patterns:
  - Container/presentational split for complex pages (Checkout, Admin Orders).
  - Hooks for cross‑cutting concerns (useAuth, useCart, useProducts, useOrderActions).

## Cross‑Cutting Concerns
- Error handling: centralized API error middleware, uniform error envelope for frontend.
- Logging: minimal structured logs for auth events, payment attempts, and webhook processing.
- Security: CSRF‑aware design if not fully SPA/JWT; Stripe secrets never exposed to client.

## Extensibility Notes
- Design product model with optional attributes and metadata for future variants/options.
- Keep order status as an enum but allow additional states later via config.
