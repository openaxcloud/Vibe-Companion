# System Patterns – Memory Bank

## Architectural Overview
- Full-stack TypeScript project with a monolithic API backend and React SPA frontend.
- Likely stack: Node.js (Express/Fastify/Nest) + PostgreSQL (or similar SQL DB) + Stripe for payments.
- Frontend communicates via JSON REST (or tRPC/GraphQL if chosen; decision to be recorded once made).

## Key Design Decisions
- Use Stripe Payment Intents API for secure, PCI-light card handling; backend never stores raw card data.
- Maintain strong separation between "payment" state (Stripe) and "order" state (internal DB) with reconciliation.
- Shopping cart stored server-side per user (with session fallback for anonymous users) to support multi-device continuity.
- Single-tenant app in v1, with data model designed to be multi-tenant-ready (optional `store_id` / `merchant_id`).

## Core Patterns
- Domain-driven slices: `users`, `products`, `cart`, `orders`, `payments` modules with clear boundaries.
- Repository pattern for DB access (abstract SQL queries for testability and future DB swaps).
- Service layer orchestrating flows (e.g., checkout: validate cart → create order → create PaymentIntent → update order on success).
- Event-style state changes via domain events (even if implemented simply): ORDER_PLACED, PAYMENT_SUCCEEDED, ORDER_FULFILLED.
- Auth pattern: JWT or secure session cookies with refresh strategy; RBAC roles (buyer, admin).

## Non-Functional Constraints
- Prioritize correctness and transactional integrity around payments and orders.
- Aim for simple deployment footprint (single API service + single DB + static frontend hosting) in early phases.
- Logging of all payment-related operations for auditability; avoid logging sensitive card data (Stripe handles).

## Deferred Patterns / Non-Goals
- No microservices in v1; consider modular monolith only.
- No complicated CQRS/event-sourcing; simple CRUD + events is sufficient.
- No hard requirement for offline-first or PWA in v1.