# System Patterns & Architecture – Memory Bank Summary

1. **High-Level Architecture:**
   - Client: React + TypeScript SPA (or SSR/ISR if Next.js is chosen later).
   - API: TypeScript-based backend (e.g., Node/Express/Nest/Next API routes) exposing REST/GraphQL.
   - DB: Relational DB (likely Postgres) for products, users, orders, inventory.
   - Integrations: Stripe for payments, email provider (e.g., SendGrid) for notifications.
2. **Domain Concepts to Track:**
   - `User` (roles: shopper, admin).
   - `Product`, `Category`, `Variant` (if used), `InventoryItem` or stock fields.
   - `Cart`, `CartItem`, `Order`, `OrderItem`, `PaymentIntent`, `Refund`.
3. **Key Patterns:**
   - Clear separation of concerns: UI, API, domain, infra.
   - Strong TypeScript domain types shared (where appropriate) between front and back.
   - Stripe webhooks pattern for post-payment order confirmation.
   - Event/state-driven order lifecycle (Created → Paid → Fulfilled → Cancelled/Refunded).
4. **Security & Auth Patterns:**
   - Token/session-based auth with protected routes for checkout and dashboards.
   - Role-based access control for admin operations.
5. **Performance & UX Patterns:**
   - Client-side caching for catalog data (e.g., React Query/TanStack Query).
   - Debounced search, paginated product lists, and incremental filter updates.
6. **What Memory Should Preserve:**
   - Chosen patterns (e.g., React Query, backend framework, routing strategy).
   - API contract decisions (endpoint routes, payload shapes, error format).
   - Order/inventory lifecycle rules and invariant assumptions.

