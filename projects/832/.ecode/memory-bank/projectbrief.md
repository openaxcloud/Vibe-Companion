# Project Brief: E‑Commerce Marketplace Memory Bank

## Overview
- Full‑stack TypeScript React marketplace for multiple sellers and buyers.
- Includes product catalog with search/filters, shopping cart, checkout, Stripe payments, auth, and order management dashboard.
- This Memory Bank tracks stable decisions, constraints, and patterns to keep the system coherent over time.

## Core Requirements to Remember
- Buyers can browse, search, and filter products; add to cart; checkout with Stripe.
- Auth: email/password (and optionally OAuth later) with JWT sessions.
- Orders: create on successful payment, visible in dashboards (buyer + seller + admin views).
- Marketplace: supports multiple vendors; products linked to a seller account.

## Goals
- Prioritize correctness, security, and payment reliability over feature breadth.
- Maintain clear separation between front‑end, back‑end API, and payment provider.
- Ensure search and filters are performant and UX‑friendly.
- Design for incremental features (e.g., wishlists, reviews) without major refactors.

## Scope Boundaries
- Out of scope (for now): digital downloads, subscriptions, complex shipping logic, multi‑currency.
- Single region / single currency; one Stripe account operating the marketplace.
- Admin UI limited to basic product, user, and order oversight.

## Memory Bank Usage
- Record key decisions (auth scheme, data models, routing, Stripe flow) as they stabilize.
- Avoid re‑deciding fundamentals (e.g., cart model, order lifecycle) without explicit change notes.
- Treat this as the project’s “architectural memory” for all future work.
