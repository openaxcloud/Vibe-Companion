# System Patterns & Architecture – Memory Bank

## High-Level Architecture
- Frontend: React + TypeScript SPA, routing (e.g., React Router), state management for cart/user.
- Backend: TypeScript Node service exposing REST APIs for products, cart, orders, auth.
- DB: Relational (e.g., Postgres) for products, users, orders, payments metadata.
- Payments: Stripe SDK/REST; backend handles payment intents and webhooks.

## Key Technical Decisions
- Use JWT-based auth (HTTP-only cookies or Authorization headers) for frontend–backend.
- Strong separation of concerns: product, user, cart, and order services (logical modules).
- Use Stripe Payment Intents API and webhooks to sync payment → order status.

## Design Patterns
- Controller–Service–Repository layering on backend.
- DTOs and input validation at API boundaries.
- React component composition with container/presentational split for pages.
- Centralized domain models for Product, Cart, Order, User, Payment.
- Event-driven hooks internally for side effects (e.g., order_created → email, logging).
