# Project Brief – Memory Bank for E‑commerce Marketplace

1. **Project Name:** Full-stack TypeScript React e‑commerce marketplace with Stripe.
2. **Memory Bank Purpose:** Persist important context, decisions, and conventions so future LLM sessions can act as a consistent, knowledgeable team member.
3. **Product Summary:** A multi-vendor marketplace with searchable/filterable product catalog, shopping cart + checkout, Stripe payments, auth, and order management dashboard.
4. **Core Functional Modules:**
   - User auth & profiles (buyers, sellers, admins)
   - Product catalog (listing, search, filters, details)
   - Cart & checkout (shipping, taxes placeholder, Stripe integration)
   - Orders (creation, status updates, history)
   - Admin/seller dashboards (manage products, orders)
5. **Non-goals (for v1):**
   - No complex multi-currency, marketplace payouts, or tax engines beyond Stripe basics
   - No advanced recommendation engine or social features
6. **Primary Goals for Memory Bank:**
   - Track evolving feature scope and constraints
   - Record architecture and API contracts
   - Store UX flows and naming conventions
   - Capture integration details (Stripe, auth provider) and env setup
7. **Usage Expectations:**
   - Read on session start; update when architecture, APIs, or flows change
   - Serve as single source of truth for future code generation and reviews.
