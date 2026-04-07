# System Architecture & Patterns – Memory Bank

## High-Level Architecture
- Full-stack TypeScript application with React front-end and Node/Express or similar back-end.
- REST or GraphQL API for product catalog, cart, auth, and orders.
- Stripe integration on server for payment intents and webhooks.
- Relational database (e.g., Postgres) for users, products, orders, and payments metadata.

## Key Design Patterns
- Modular feature domains: `auth`, `catalog`, `cart`, `checkout`, `orders`, `admin`.
- React front-end using container/presentational split or feature-based folder structure.
- Centralized state for cart and user session (React Query/RTK/Context).
- Service layer on backend: controllers → services → repositories.
- DTO/validation layer for request/response contracts.

## Integration & Data Patterns
- Stripe: create PaymentIntent server-side, confirm client-side, finalize order after webhook confirmation.
- Idempotent order creation and payment handling to avoid double charges.
- Pagination and filtering for product queries, with consistent query parameter contracts.

## Non-Functional Concerns
- Authentication via JWT or session cookies with secure storage.
- Role-based access control for admin vs customer.
- Logging and basic error taxonomy for checkout and payments.
