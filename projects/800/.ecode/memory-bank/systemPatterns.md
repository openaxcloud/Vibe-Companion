# System & Pattern Context – Architecture Memory

1. **High‑Level Architecture:**
   - SPA frontend (React + TypeScript) consuming a backend API.
   - Backend (details to be defined later, but TS‑friendly) exposing REST/JSON or GraphQL.
   - Stripe for payment processing and webhooks.
   - Database for products, users, orders, carts (relational likely).
2. **Key Bounded Contexts to Track:**
   - **Catalog:** products, categories, inventory.
   - **Checkout & Payments:** carts, checkout sessions, Stripe intents.
   - **Users & Auth:** accounts, sessions, roles.
   - **Orders & Fulfillment:** orders, statuses, refunds.
3. **Core Design Patterns (to remember and reuse):**
   - **Front‑end:**
     - Container/presenter separation for complex views (e.g., Dashboard, Checkout).
     - Custom hooks for data fetching and business logic (e.g., useCart, useOrders).
     - Centralized state for cart and auth (Context/Redux/Query depending on later choice).
   - **Back‑end:**
     - Service layer encapsulating domain logic (e.g., OrderService, PaymentService).
     - Repository/DAO layer for database access.
     - DTOs / validation layer for inputs/outputs.
4. **Integration Patterns:**
   - Stripe client SDK on frontend for payment UI; backend for secret operations.
   - Webhook endpoint to sync payment events with order state.
5. **Cross‑cutting Concerns to Persist in Memory:**
   - Authentication & authorization checks on protected routes and APIs.
   - Error handling strategy (HTTP status conventions, error shapes).
   - Logging and basic observability (especially for payments and orders).
   - Idempotency for checkout and webhook processing.
6. **Evolving Decisions:**
   - Choice of REST vs GraphQL.
   - Single vs multi‑tenant marketplace design.
   - State management library on the client.
