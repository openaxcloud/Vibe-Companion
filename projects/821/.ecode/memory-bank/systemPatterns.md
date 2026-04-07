# System & Architecture Patterns – Memory Bank

## High-Level Architecture
- Full-stack TypeScript app:
  - Frontend: React SPA for shopper and admin UIs.
  - Backend: TypeScript API (likely REST) serving product, cart, auth, and order endpoints.
  - Stripe: external payments provider, used via client+server SDKs.
- Single shared domain model across frontend and backend captured in Memory Bank.

## Core Bounded Contexts
- Catalog: products, categories, inventory metadata.
- Cart & Checkout: carts, line items, pricing, discounts, taxes (if in scope).
- Payments: Stripe payment intent/session lifecycle mapping to internal payment records.
- Orders: order creation, status transitions, fulfillment data.
- Identity & Access: users, roles (shopper, admin), sessions, permissions.

## Key Design Patterns to Remember
- API Layer:
  - REST-style routes grouped by bounded context.
  - DTOs separating transport shape from internal domain models.
- Domain Layer:
  - Aggregate roots: Product, Cart, Order, User.
  - Explicit state machines for Order and Payment statuses.
- Frontend:
  - React + hooks; feature-based folder structure.
  - Centralized state for cart and auth (e.g., React Query + context or state manager).

## Stripe Integration Pattern
- Server owns creation/confirmation of PaymentIntents/Checkout Sessions.
- Client obtains only ephemeral keys/IDs needed for Stripe.js.
- Webhooks update payment + order status asynchronously.
- Memory Bank stores canonical mapping between Stripe events and internal state changes.

## Cross-Cutting Concerns
- Error handling: standardized error envelope for API responses.
- Logging/metrics: capture key flows (checkout, payment, order updates).
- Security: JWT or session cookies; CSRF considerations; secure Stripe key handling.
