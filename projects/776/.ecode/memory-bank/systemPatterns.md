# System & Architecture Patterns in Memory Bank

1. **Overall Architecture:** Full‑stack, TypeScript‑first web app with a React frontend, backend API (likely Node/Express/Nest/Next API routes), and relational database for products, users, orders, and inventory.
2. **Core Subsystems (to be remembered):**
   - Auth subsystem (JWT/session, roles: shopper, vendor, admin).
   - Product catalog & search subsystem.
   - Cart & checkout subsystem integrated with Stripe.
   - Order management & inventory subsystem.
   - Notification/Email subsystem for order events.
3. **Key Design Patterns:**
   - **Modular monolith** or clearly separated layers: API layer, domain/services, persistence.
   - **Repository/Service pattern** for domain logic (products, orders, inventory, payments).
   - **DTOs + Validation** for API contracts.
   - **State management** on frontend (e.g., React Query/Zustand/Redux) for cart, auth, and server cache.
4. **Integration Patterns:**
   - Stripe via webhooks for payment confirmation and order finalization.
   - Email provider integration (e.g., SendGrid/SES) via async jobs/queues when possible.
5. **Security & Compliance Considerations:**
   - Stripe manages card data; backend never stores raw payment details.
   - Secure auth flows and role‑based access control.
6. **Memory Role:** Persist architectural decisions (e.g., choice of server framework, DB, state management, Stripe integration flow) and update them when changed to avoid inconsistent advice later.
