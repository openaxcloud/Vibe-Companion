# System Architecture & Patterns – Memory Bank

## High-Level Architecture
- **Client:** React + TypeScript SPA (or CSR-first), consuming a REST/JSON API.
- **Server:** TypeScript backend (e.g., Node/Express or similar) exposing modular routes: auth, catalog, cart/checkout, orders, admin.
- **Data:** Relational DB (e.g., Postgres) with entities: User, Product, Category, Seller, Cart, Order, OrderItem, PaymentIntent.
- **Payments:** Stripe SDK for server-side payment intent creation + client-side Elements/Checkout.

## Key Technical Decisions
- **TypeScript end-to-end** for shared types between client and server.
- **JWT or session-based auth** (HTTP-only cookies) to secure user sessions.
- **Role-based access control (RBAC)** for admin vs regular users.
- **Soft coupling to Stripe:** Store Stripe IDs but keep internal Order/Payment models independent.

## Design Patterns
- **Layered architecture** on backend: routing → controllers → services → repositories → DB.
- **DTOs & validation** for API requests/responses using a schema library (e.g., Zod/Yup).
- **Domain-driven modules:** `auth`, `catalog`, `cart`, `checkout`, `orders`, `admin`.
- **State management** on client: React Query (or similar) for server state + minimal local state for UI.
- **Form management**: Reusable form components (inputs, validation errors) for checkout and auth.

## Integrations & Cross-Cutting Concerns
- **Stripe integration pattern:**
  - Client requests checkout → server creates PaymentIntent → returns client secret → client confirms via Stripe.
  - Webhook endpoint updates Order payment status asynchronously.
- **Security:** CSRF-safe auth, input validation, strict CORS, Stripe signature verification.
- **Observability:** Centralized error logging, basic request metrics, Stripe event logs.
