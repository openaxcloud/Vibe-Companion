# Project Brief – Memory Bank for E‑commerce Marketplace

1. **Project Name:** E‑commerce Marketplace (Typescript/React, full‑stack)
2. **Memory Bank Purpose:** Persist and reuse key project decisions, constraints, and context across iterative assistant sessions.
3. **Core Product Scope:**
   - Multi-vendor or single-vendor marketplace (clarify early; default: single vendor with room to extend).
   - Product catalog with search, category/price filters, and sorting.
   - Shopping cart with full checkout flow integrated with Stripe.
   - User authentication (signup, login, session management, profile).
   - Order creation, Stripe payment handling, and order history.
   - Admin/owner dashboard for order management and basic catalog management.
4. **Non‑Goals (initially):**
   - Complex multi-tenant vendor management UI.
   - Advanced marketing features (coupons, referral programs, A/B testing).
   - Native mobile apps.
5. **High‑Level Requirements:**
   - Secure checkout with Stripe (Payment Intents, webhooks for confirmation).
   - Responsive SPA front-end in React + TypeScript.
   - Back-end API with auth, product, cart, and order endpoints.
   - Persistent data store (SQL or document DB) with proper modeling.
6. **Quality Goals:**
   - Clear separation of concerns (UI, API, data, payments).
   - Testable, modular code and predictable state management.
   - Deployable to common cloud platforms (e.g., Vercel + hosted DB + server for webhooks).
7. **Memory Usage:** Store architectural decisions, APIs, domain models, and UX assumptions here so future work stays consistent.
