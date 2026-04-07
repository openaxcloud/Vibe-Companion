# Memory Bank – System Patterns & Architecture

## High-level architecture to remember
- **Full-stack TypeScript** with React front-end and a Node-based backend (e.g., Express/Nest/Fastify) exposing a JSON API.
- Likely layered architecture:
  - Presentation: React (SPA) with router, state management (e.g., React Query/Zustand/Redux).
  - API: REST endpoints for auth, products, cart, checkout, orders.
  - Domain/services: business logic for pricing, order state transitions, Stripe flows.
  - Persistence: relational DB (e.g., Postgres) via TypeScript ORM or query builder.

## Important design patterns
- **Domain-driven modeling** for key aggregates: User, Product, Cart, Order, PaymentIntent.
- **Repository pattern** for data access, to swap underlying DB details more easily.
- **CQRS-lite**: simple separation of read queries (catalog/search) vs write operations (checkout, admin changes).
- **Event-driven edges** where Stripe webhooks update order/payment state.
- **State machines** (explicit or implicit) for order/payment status transitions.

## Non-functional decisions to retain
- All code in TypeScript (front+back) for shared models and types.
- Validation on both client and server; never trust client cart totals or prices.
- Idempotent order creation and webhook handlers to avoid double-charging or duplicate orders.
- Pagination and query limits for catalog and admin views to prevent heavy queries.

## Future patterns to consider
- Feature flags for payment methods or experimental filters.
- Background jobs/queues for email notifications and heavy tasks.
