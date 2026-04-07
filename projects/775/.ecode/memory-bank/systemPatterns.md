# System Architecture & Patterns (Memory Bank)

1. **Overall Style:**
   - Full-stack TypeScript SPA (React front-end) + REST/JSON API backend + relational DB.
2. **Frontend Architecture:**
   - React with component-based UI and router for pages (catalog, product, cart, checkout, dashboard).
   - State management: global store for cart, auth, theme; query hooks for server data (products, orders).
   - Theming: central theme context, CSS variables for dark/light mode.
3. **Backend Architecture:**
   - Layered design: routing layer → controllers → services → repositories → DB.
   - REST endpoints for auth, products, cart/checkout, orders, inventory, and admin functions.
   - Stripe integration encapsulated in a payment service (create Checkout Session / Payment Intent, webhooks).
4. **Data & Persistence:**
   - Relational schema with tables for Users, Products, ProductVariants, Inventory, Orders, OrderItems, Payments.
   - Inventory adjustments handled in transactional operations to avoid overselling.
5. **Security & Auth Patterns:**
   - Token-based auth (JWT or session cookies) with secure password hashing.
   - Role-based access control (shopper vs admin) enforced at route/service level.
   - Webhook signature verification for Stripe events.
6. **Key Design Patterns:**
   - **Repository pattern** for DB access abstraction.
   - **Service layer** for business logic (order creation, inventory update, notifications).
   - **DTOs** for API request/response models.
   - **Observer/event pattern** internally for reacting to order state changes (e.g., send email when status changes).
7. **Integration Points:**
   - Stripe API for payments + webhooks for payment confirmations.
   - Email provider API/SMTP for transactional emails.
8. **Scalability Considerations (later):**
   - Cache product catalog reads; paginate everywhere.
   - Separate background job worker for email + webhook processing if volume grows.
