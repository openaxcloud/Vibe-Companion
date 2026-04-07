# Memory Bank – System & Patterns

## High-Level Architecture
- **Client**: React + TypeScript SPA (likely Vite/Create React App/Next SPA mode) consuming JSON APIs.
- **Server**: Node.js + TypeScript (e.g., Express/Fastify/Nest) with REST or GraphQL.
- **DB**: Relational (e.g., Postgres) for products, users, orders, carts; Stripe as external payment system.

## Key Technical Decisions to Remember
- **Auth**: JWT or session-based auth with secure cookie; role-based (buyer, admin, possibly seller).
- **Stripe Integration**: Use Checkout Sessions or Payment Intents; webhooks for payment confirmation and order finalization.
- **Cart Model**: Server-side cart tied to user (and anonymous session fallback) to keep pricing and inventory authoritative.
- **Search/Filters**: Implement via backend querying (DB indexes) rather than purely client-side filtering.

## Design Patterns
- **Layered architecture**: Controllers/routers → services → repositories → DB.
- **DTOs / types**: Shared TypeScript types for API contracts to keep client/server in sync.
- **State management**: Local React state + a global store (e.g., context/zustand) for cart and auth.
- **Order workflow**: State machine pattern (e.g., DRAFT → PENDING_PAYMENT → PAID → FULFILLED → CANCELED/REFUNDED).

## Cross-Cutting Concerns
- Centralized error handling and logging on the backend.
- Input validation at API boundaries (e.g., Zod/Yup) with typed schemas.
- Security: CSRF (if cookies), CORS, rate limiting on auth and payment endpoints.
