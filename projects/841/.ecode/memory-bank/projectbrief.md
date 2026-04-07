# Project Brief – Memory Bank for E‑Commerce Marketplace

## Overview
- This Memory Bank documents durable decisions and context for a full-stack TypeScript/React e‑commerce marketplace.
- The system supports: product catalog, search & filters, shopping cart, checkout with Stripe, user auth, and order management.
- Memory entries here guide consistent implementation, avoid re‑decisions, and align future changes.

## Core Requirements (to remember)
- Full-stack TypeScript app with React on the frontend.
- Marketplace model: multiple vendors can list products (future‑friendly), but initial scope may act as a single-store marketplace.
- Product catalog with rich metadata: categories, tags, price, inventory, and vendor reference.
- Search and filtering across name, category, price range, and possibly text description.
- Shopping cart and checkout: persistent cart, promo‑code ready, Stripe integration for payments.
- User authentication: email/password (JWT or session-based) with roles: customer, admin, vendor (future-capable).
- Order lifecycle: placed → paid → fulfilled → shipped → completed/cancelled, with dashboard views.

## Goals
- Provide a clear reference of architectural and product decisions.
- Keep Stripe, security, and data integrity as first-class concerns.
- Support iterative delivery: MVP first (core flows), then enhancements.

## Scope Boundaries
- In-scope: core marketplace flows, Stripe payments, order tracking, basic vendor/admin dashboards.
- Out-of-scope (initially): complex promotions engine, multi-currency, marketplace payouts automation, advanced analytics.
- This Memory Bank will evolve; deprecations and superseded decisions should be annotated, not deleted.
