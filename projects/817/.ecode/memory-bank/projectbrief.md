# Project Brief – Memory Bank for E‑commerce Marketplace

## Overview
- This Memory Bank documents enduring decisions and context for a TypeScript + React full-stack e‑commerce marketplace.
- Core features: product catalog with search/filters, shopping cart + checkout, Stripe payments, user auth, order management dashboard.
- Goal: accelerate consistent decision-making, reduce re‑analysis, and keep rationale discoverable over time.

## Core Requirements (System)
- Multi-tenant marketplace support (buyers; sellers optional in v1 TBD).
- Secure user auth (email/password + optional social later).
- Product catalog with categories, tags, price range, text search, and basic sorting.
- Shopping cart persisted per user (and per anonymous session until login).
- Checkout flow integrated with Stripe (Payment Intents) for card payments.
- Order lifecycle: created → paid → fulfilled/shipped → completed/cancelled.
- Admin/ops dashboard for order management and basic catalog operations.

## Memory Bank Goals
- Capture stable architectural constraints (TypeScript, React, Stripe) and non-goals.
- Track design tradeoffs (e.g., Postgres vs. NoSQL, monolith vs. microservices).
- Record UX and domain decisions (cart behavior, refund policies, taxes, etc.).
- Provide a single source of truth for future contributors.

## Scope Boundaries (Current Phase)
- In-scope now: monolithic backend API, web frontend, Stripe card payments, basic admin dashboard.
- Out-of-scope (explicitly): native mobile apps, third-party marketplace integrations, advanced recommendation engine.
- Future but not now: inventory sync with external systems, subscription billing, gift cards, and loyalty programs.