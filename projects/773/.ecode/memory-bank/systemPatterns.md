# System Patterns & Architecture – Memory Bank

1. **Overall Architecture:**
   - Full‑stack TypeScript app with React front‑end and TypeScript Node/Express (or Next.js API routes) back‑end.
   - REST/JSON API between UI and server; server integrates with Stripe and email service.
2. **Key Bounded Contexts:**
   - Auth & Users, Catalog, Cart & Checkout, Orders, Inventory, Notifications.
3. **Data Flow Patterns:**
   - Client state via React Query/Redux for cart and user session.
   - Server as source of truth for inventory, pricing, and orders.
4. **Stripe Integration Pattern:**
   - Backend creates PaymentIntents; client confirms via Stripe.js.
   - Webhooks used for final payment confirmation and order finalization.
5. **Inventory Pattern:**
   - Optimistic cart UI; final stock validation and decrement on successful payment.
6. **Order Management Pattern:**
   - State machine style statuses: `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `CANCELLED`.
7. **Security Patterns:**
   - JWT or secure session cookies; role‑based access control for admin vs user.
   - Never expose secret keys; validate all incoming webhooks.
8. **Design Patterns in Code:**
   - Repository or service layer for DB access.
   - Adapter pattern for Stripe and email providers to keep them swappable.
   - Presentational vs container components in React; hooks for shared logic.
