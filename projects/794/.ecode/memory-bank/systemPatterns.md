# System Patterns – Architecture & Design Memory

1. **Overall Architecture Pattern:**
   - TypeScript full‑stack app with React frontend and Node/Express or similar backend API.
   - API-driven architecture: REST/JSON for products, cart, auth, orders, and Stripe events.
2. **Key Bounded Contexts:**
   - **Catalog:** products, categories, search, filters.
   - **Cart & Checkout:** cart state, pricing, discounts, taxes, Stripe integration.
   - **Users & Auth:** registration, login, sessions/JWT, roles.
   - **Orders:** order creation, payment status, fulfillment, refunds.
3. **Patterns to Document:**
   - Controller/service/repository layering on the backend.
   - React container/presentational split, hooks for state and data fetching.
   - Centralized error handling and logging strategy.
4. **Stripe Integration Memory:**
   - Chosen flow (PaymentIntent/Checkout Session) and why.
   - Webhook architecture and idempotency keys usage.
   - How order status is synchronized with Stripe events.
5. **Data & State Management:**
   - Client: global state (e.g., cart, user session) vs local state patterns.
   - Server: how cart is persisted (session vs DB) and when it becomes an order.
6. **Security Patterns:**
   - Authentication tokens handling in browser.
   - Authorization middleware (customer vs admin endpoints).
   - Stripe secret/public key separation and webhook signature verification.
7. **Scalability & Extensibility:**
   - How to add new product attributes/filters.
   - How to extend order states or add vendor roles without breaking existing flows.
