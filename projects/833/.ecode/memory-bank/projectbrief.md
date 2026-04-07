# Project Brief – Memory Bank for E‑commerce Marketplace

1. **Project Name:** Memory Bank – Full‑stack TypeScript E‑commerce Marketplace
2. **Objective:** Provide a structured, queryable Memory Bank of decisions, context, and patterns to keep the marketplace implementation consistent and traceable over time.
3. **Product Scope:**
   - Multi-vendor marketplace with product catalog, search, and filters.
   - Shopping cart and checkout flow integrated with Stripe.
   - User authentication (customers, admins; optional vendors later).
   - Order management dashboard for admins/ops.
4. **Memory Bank Scope:**
   - Persist requirements, UX flows, and domain concepts (products, carts, orders, payments).
   - Record architectural decisions (ADR-style), schemas, and API contracts.
   - Track Stripe integration details (webhooks, payment intents, security notes).
   - Capture environment conventions, deployment assumptions, and edge cases.
5. **Out-of-Scope for Memory Bank:**
   - Actual code implementation.
   - Monitoring logs or operational telemetry.
6. **Core Requirements for Memory Bank:**
   - Human-readable, markdown-first entries tied to this specific marketplace.
   - Organized by domain (Catalog, Cart, Checkout, Auth, Orders, Payments).
   - Easy retrieval by feature, decision, or user flow.
   - Versionable and diffable in Git alongside the codebase.
7. **Goals:**
   - Reduce repeated decision-making and context loss during development.
   - Enable new contributors to understand the system quickly.
   - Provide a single source of truth for how/why the marketplace works.
8. **Success Criteria:**
   - Every major feature/epic has at least one Memory Bank entry.
   - Stripe/payment flows and security constraints are explicitly documented.
   - Onboarding a new engineer requires reading Memory Bank plus repo README only.
