# Memory Bank – Project Brief

## Overview
- This Memory Bank tracks persistent context for the **full‑stack e‑commerce marketplace** project (TypeScript + React, Stripe, auth, orders).
- Purpose: keep critical decisions, constraints, and evolving understanding easily findable across the project lifecycle.

## What this project is
- A marketplace web app with:
  - Product catalog with search, filters, and detail pages.
  - User authentication (sign up / login / account area).
  - Shopping cart and multi-step checkout flow.
  - Stripe-based payments (cards, webhooks, basic refunds support).
  - Order management dashboard for admins/sellers.

## Memory Bank goals
- Persist non-obvious decisions (e.g., how we model multi-vendor orders, tax/shipping assumptions, Stripe integration choices).
- Capture UX and domain nuances that drive implementation (search behavior, cart rules, roles & permissions).
- Track important trade-offs, technical constraints, and future refactors.

## Scope of what we remember
- Architecture and domain model decisions (products, users, orders, payments).
- API contracts, key data shapes, and invariants.
- Integration details with Stripe and auth provider.
- Operational details: environments, feature flags, seeded test data assumptions.
- Out-of-scope: generic tutorials, deep Stripe docs, or unrelated experiments.
