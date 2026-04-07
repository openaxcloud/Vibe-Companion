# Project Brief – Memory Bank for E‑commerce Marketplace

1. **Project Name:** Memory Bank – Full‑stack E‑commerce Marketplace
2. **Mission:** Provide a persistent, queryable knowledge base of this marketplace’s decisions, constraints, and implementation details to keep the team aligned.
3. **Product Scope (App):**
   - Multi-vendor marketplace with product catalog, search, filters.
   - Shopping cart + checkout using Stripe payments.
   - User authentication (customers, admins; later vendors).
   - Order management dashboard (view, update, fulfill orders).
4. **Memory Bank Scope:**
   - Store design decisions (architecture, APIs, data models, Stripe integration details).
   - Track user flows, UX rules, business rules (tax, shipping, refunds basics).
   - Capture environment/config values (without secrets), deployment patterns.
   - Keep history of trade-offs and rejected options.
5. **Goals:**
   - Reduce rework by centralizing knowledge.
   - Make onboarding fast: new devs can understand system in hours, not days.
   - Support consistent implementation across backend, frontend, and infra.
6. **Out of Scope (for Memory Bank):**
   - Storing secrets or live PII/PCI data.
   - Replacing issue tracking (Jira/GitHub) or source control.
7. **Consumers:**
   - Engineers (backend, frontend, full‑stack).
   - Product/QA for behavior expectations.
   - DevOps for infra context.
8. **Format & Access:**
   - Markdown entries grouped by topic (architecture, APIs, UX, Stripe, auth, orders).
   - Versioned in Git, kept close to codebase.
9. **Change Policy:**
   - Update Memory Bank on every meaningful architectural or business-rule change.
   - Treat docs edits as part of the Definition of Done.
