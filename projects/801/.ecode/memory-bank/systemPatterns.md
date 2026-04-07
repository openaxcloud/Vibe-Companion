# System Patterns – What the Memory Bank Tracks

1. **Architecture Overview to Remember:**
   - Full‑stack TypeScript: React frontend + Node/Express (or similar) backend + relational DB.
   - Clear separation: public APIs (catalog, search), authenticated APIs (cart, orders), and privileged admin APIs.
2. **Key Technical Decisions:**
   - Stripe as sole payment provider; use Payment Intents and webhooks for order state.
   - JWT‑based auth with refresh tokens; role‑based access control (buyer/seller/admin).
   - Strong typing via TypeScript shared interfaces across client/server.
3. **Patterns to Encode:**
   - CQRS‑lite: read‑optimized catalog/search endpoints vs write APIs for cart/orders.
   - Repository pattern for data access; service layer for domain logic (pricing, fees, stock checks).
   - Event‑driven order state changes (e.g., Stripe webhook → order status update event).
4. **Security & Compliance Decisions:**
   - Never store raw card data; Stripe Elements/Checkout on client.
   - Centralized validation and authorization middleware patterns.
   - Logging and audit trails for order changes and refunds.
5. **Scalability & Reliability Concerns:**
   - Caching strategy for product catalog/search; pagination defaults.
   - Idempotent operations for order creation and webhook handling.
6. **Cross‑Cutting Concerns:**
   - Error handling and error vocabulary shared across frontend/backend.
   - Internationalization assumptions (currencies, locales) and tax/shipping strategy.
7. **Memory Bank Role:** Track all these decisions and their evolution, including deprecated patterns and migration notes.
