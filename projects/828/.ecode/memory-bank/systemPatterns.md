# System Architecture & Patterns – Memory Bank

1. **Overall Architecture:**
   - Full-stack TypeScript application with React SPA front-end and Node-based REST/GraphQL API back-end.
   - API layer responsible for auth, business logic, Stripe integration, and database access.
2. **High-Level Modules:**
   - Auth module (JWT or session-based) with role support (user, admin).
   - Catalog module (products, categories, search/filter endpoints).
   - Cart/Checkout module (cart state, validation, shipping, tax placeholders).
   - Orders module (order creation, status transitions, history).
   - Payments module (Stripe Payment Intents, webhooks, refund hooks later).
3. **Key Design Patterns:**
   - Layered architecture: controllers/handlers → services → repositories → DB.
   - DTOs / request-response mappers between API and front-end types.
   - Domain models for Product, User, CartItem, Order, PaymentIntentRef.
   - React container/presentational components + hooks for business logic.
4. **State Management (Front-end):**
   - Global state for auth and cart (e.g., React Context + reducer or lightweight store library).
   - Local state for view-specific UI (filters, modals, etc.).
5. **Stripe Integration Pattern:**
   - Back-end creates Payment Intents and returns client secret.
   - Front-end uses Stripe Elements/Checkout to complete payment.
   - Webhook endpoint updates order/payment status idempotently.
6. **Security Patterns:**
   - Auth middleware on protected routes; role-based checks for admin endpoints.
   - CSRF/XSST protections as appropriate; input validation at API boundary.
   - Never expose Stripe secret keys to the client; use publishable key only in front-end.
7. **Scalability Considerations to Remember:**
   - Pagination on product and order lists.
   - Caching layers (later) for frequent catalog queries.
   - Idempotency keys for payment/order creation.
