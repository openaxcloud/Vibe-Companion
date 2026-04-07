# System Architecture & Patterns – Memory Bank

## High‑Level Architecture
- Web client: React + TypeScript SPA/MPA consuming a JSON API.
- Backend: TypeScript‑based Node server (framework TBD: likely Express/Nest) exposing REST (or GraphQL) endpoints.
- Data layer: relational DB (e.g., Postgres) for products, users, orders, transactions.
- Integrations: Stripe for payments and webhooks for payment/order lifecycle.

## Core Design Patterns
- Separation of concerns: distinct layers for API controllers, services, repositories, and UI components.
- Domain‑oriented modules: `catalog`, `cart`, `checkout`, `payments`, `users`, `orders`, `admin`.
- State management pattern on frontend (likely React Query + context or Redux) to keep cart, auth, and order state predictable.
- DTOs and validation schemas shared across client and server where possible to reduce drift.
- Event‑driven edges: Stripe webhooks update order/payment state via idempotent handlers.

## Cross‑Cutting Concerns to Keep Consistent
- AuthN/AuthZ: JWT or session‑based auth, role‑based authorization for admin features.
- Error handling: structured error responses, user‑friendly messages, and logging.
- Security: CSRF protection (if applicable), HTTPS, secure cookie usage, Stripe best practices (no card data on our servers).
- Performance: pagination for catalog, server‑side or hybrid rendering for SEO‑critical pages (product listing/details).
- Observability: basic request logging, error tracking, and key business metrics (conversion, orders).
