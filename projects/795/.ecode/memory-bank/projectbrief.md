# Project Brief – Memory Bank for E‑commerce Marketplace

## Overview
- This Memory Bank documents enduring decisions, patterns, and context for the TypeScript + React full-stack e‑commerce marketplace.
- The product supports a multi-vendor marketplace with Stripe payments, searchable/filterable product catalog, shopping cart and checkout, authentication, and an order management dashboard.

## Memory Bank Purpose
- Capture **stable, reusable knowledge**: architecture rationales, integration nuances, naming conventions, and domain language.
- Reduce rework by avoiding repeated discovery of API contracts, edge cases, and configuration gotchas.
- Provide a **single source of truth** for future features, refactors, and onboarding.

## Scope of Memory
- Product & domain: marketplace concepts (users, vendors, products, carts, orders, payouts).
- System architecture: frontend structure, backend services, API shapes, Stripe flows.
- Implementation patterns: React/TypeScript patterns, state management, error handling, testing norms.
- Ops & environment: deployment expectations, keys/secrets usage patterns.

## Out of Scope
- Low-level implementation details that change frequently (e.g., styling minutiae, one-off bug workarounds).
- Per-sprint status updates; those live in issue tracker, not Memory Bank.

## Goals
- Keep decisions **discoverable**, **diffable**, and **justified**.
- Enable contributors to understand "why we did it this way" within minutes.
- Ensure Stripe and auth flows are implemented **once, correctly**, and reused consistently.