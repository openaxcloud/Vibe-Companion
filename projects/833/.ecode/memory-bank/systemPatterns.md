# System & Patterns – Memory Bank for Marketplace Architecture

1. **High-Level Architecture (for the Marketplace):**
   - Frontend: React + TypeScript SPA for catalog, cart, checkout, dashboards.
   - Backend: TypeScript (Node/Express/Nest-like) REST/JSON API.
   - DB: SQL or document DB for products, users, carts, and orders.
   - Payments: Stripe Payment Intents API + webhooks.
2. **Memory Bank Role in Architecture:**
   - Store ADR-like records for architectural choices (e.g., why Stripe Payment Intents, why a specific cart model).
   - Document module boundaries (Catalog, Auth, Checkout, Orders) and their contracts.
   - Record API shapes (request/response examples) for major endpoints.
3. **Design Patterns to Document in Memory Bank:**
   - **Layered architecture:** controller → service → repository.
   - **Domain models:** Product, User, Cart, CartItem, Order, Payment, Refund.
   - **State management (frontend):** how cart, auth state, and filters are stored.
   - **Stripe integration patterns:** idempotent webhooks, event-sourcing of payment events.
4. **Security & Compliance Notes:**
   - No card data stored; Stripe handles all sensitive payment details.
   - JWT/session strategy, CSRF approach, and password storage standards.
   - Access control patterns for admin vs customer vs (future) vendor.
5. **Performance & Reliability Considerations to Capture:**
   - Caching strategy for product catalog and search.
   - Pagination and rate limiting of search/listing APIs.
   - Stripe webhook retry handling and idempotency keys.
6. **Memory Bank Structural Patterns:**
   - `/memory/adr/` for architecture decisions (e.g., `adr-001-auth-strategy.md`).
   - `/memory/domain/` for domain concepts and models.
   - `/memory/flows/` for end-to-end sequences (browse→checkout→order).
   - Cross-linking between ADRs, flows, and domain docs for traceability.
