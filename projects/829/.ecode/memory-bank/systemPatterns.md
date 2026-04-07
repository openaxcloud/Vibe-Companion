# System Architecture & Patterns (Memory Bank)

## High-Level Architecture
- Front-end: React + TypeScript SPA or hybrid (e.g., Next.js style) for client rendering and some server-side API integration.
- Back-end: TypeScript Node server (REST/GraphQL) exposing APIs for auth, catalog, cart, checkout, and orders.
- Data layer: relational DB (e.g., Postgres) for users, products, orders, and Stripe references.
- Integrations: Stripe for payment intents, webhooks for payment/charge events.

## Key Technical Decisions (to keep consistent)
- Strong typing end-to-end using shared TypeScript types between front-end and back-end.
- Explicit separation:
  - Domain layer (entities, use-cases/services).
  - Infrastructure (DB, Stripe, HTTP, auth providers).
  - Presentation (React components, hooks, pages).
- Cart stored server-side (linked to user or temporary session) to prevent client-only loss and ease cross-device support.
- All money values stored in smallest currency unit (e.g., cents) with explicit currency code.

## Design Patterns & Conventions
- Use service layer pattern: `ProductService`, `CartService`, `OrderService`, `PaymentService`.
- Repository pattern for persistence: `ProductRepository`, `UserRepository`, etc.
- Use React hooks for data fetching and state: `useProducts`, `useCart`, `useOrders`.
- Use Controller/Handler pattern for API endpoints with input validation (e.g., zod or similar).
- Stripe integration pattern:
  - Server: create PaymentIntent on checkout; store `payment_intent_id` on order.
  - Webhook: update order status on `payment_intent.succeeded` / `payment_intent.payment_failed`.
