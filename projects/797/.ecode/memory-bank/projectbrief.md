# Project Brief – Memory Bank for E‑Commerce Marketplace

## Overview
- This Memory Bank stores persistent architectural and product knowledge for a TypeScript/React full‑stack e‑commerce marketplace.
- The marketplace supports multiple products, Stripe payments, shopping cart + checkout, user auth, and an order management dashboard.
- Memory entries guide consistent decisions across frontend, backend, DevOps, and UX as the project evolves.

## Core Requirements to Remember
- Full‑stack TypeScript solution with React on the client; backend stack will be chosen to complement TS (e.g., Node/Nest/Express).
- Core features: product catalog, search and filters, cart & checkout, Stripe integration, authentication, orders & admin dashboard.
- Multi‑role access: public visitors, registered customers, and admins/order managers.
- Secure payment flow and proper handling of PII and payment events.

## Goals of the Memory Bank
- Maintain a single source of truth for domain concepts (products, carts, orders, users, payments).
- Capture long‑term architectural decisions (ADRs) so future work aligns with initial design.
- Support consistent UX patterns across user flows (browsing, purchasing, managing orders).
- Track constraints (performance, security, SEO) that must not be violated by later changes.

## Scope of This Memory
- Focused on this specific marketplace project (not a generic e‑commerce template).
- Covers requirements, personas, flows, tech choices, and architectural patterns.
- Excludes implementation details that are ephemeral (e.g., one‑off debug hacks).
- Evolves incrementally as new decisions are made and features are added.
