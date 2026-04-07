# System Architecture & Pattern Decisions

## Overall Architecture
- Full-stack TypeScript using a React frontend and a Node/TypeScript backend (framework: likely Express/Nest/Next API routes – to be locked in early).
- REST (or typed HTTP) API between frontend and backend; backend as the single integration point with Stripe and database.
- Relational database (e.g., Postgres) as system of record for users, products, carts, orders, and payments metadata.

## Key Design Patterns (memory)
- Layered backend architecture: controllers/routes → services → repositories → database models.
- Domain models: User, Product, Category, Cart, CartItem, Order, OrderItem, PaymentIntent/PaymentRecord.
- Auth pattern: JWT or secure HTTP-only cookies with refresh strategy; role-based authorization middleware.
- Stripe integration: server-side creation of PaymentIntents/Checkout Sessions; webhook handlers to confirm payment and update orders.
- Cart pattern: server-side cart tied to user; fallback guest cart in localStorage merged on login.

## Cross-Cutting Concerns
- Validation at API boundaries (e.g., Zod/Yup) shared types between frontend and backend where possible.
- Error handling: standardized error envelope for the frontend with human-readable + machine-readable fields.
- Logging and audit: log Stripe events, order state transitions, and admin actions.
- Security: CSRF protection (if cookie-based), rate limiting for auth endpoints, secure Stripe secret handling.

## Extensibility Considerations
- Marketplace-ready schema: Product has optional vendorId; OrderItem retains snapshot of product data at purchase time.
- Feature flags for experimental UX flows (e.g., quick-checkout) using a simple config first.
