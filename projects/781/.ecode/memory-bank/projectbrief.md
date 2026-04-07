# Project Brief – Memory Bank for E‑commerce Marketplace

## Overview
- Memory Bank purpose: persist important context, decisions, and constraints for the full-stack TypeScript/React e‑commerce marketplace.
- Project: multi-vendor marketplace with Stripe payments, searchable/filterable catalog, cart + checkout, auth, and order management dashboard.
- Scope of Memory Bank: only long-lived, reusable knowledge that will meaningfully guide future development steps.

## Core Requirements to Remember
- Full-stack TypeScript with React on the frontend; backend also TypeScript (e.g., Node/Express or similar).
- Stripe integration: secure payments, webhooks for payment status, support for multiple orders and line items.
- Product catalog: search (free text), filters (category, price, rating, availability, etc.), pagination.
- Shopping cart: guest and authenticated support (ideally cart persistence post-login), tax/shipping calculation hooks.
- Checkout flow: address + shipping selection, payment, order confirmation, and receipt.
- User auth: email/password at minimum; JWT/session-based; roles (buyer, seller, admin) planned.
- Order management dashboard: view orders, statuses, payments, and basic fulfillment actions.

## Goals
- Provide a coherent memory of architecture, patterns, and decisions across sessions.
- Minimize repeated clarification by storing finalized constraints and preferences.
- Keep Memory Bank concise, periodically pruned, and focused on this project’s evolution.

## Out of Scope
- Non-TS tech stacks (e.g., Python, PHP) unless explicitly added later.
- Highly speculative features (e.g., ML recommendations) until the user confirms they are in scope.

## How This Memory Is Used
- Treat stored items as defaults; override only when the user explicitly changes requirements.
- Use Memory Bank to keep terminology consistent (e.g., "marketplace", "order management dashboard").
- Prefer incremental elaboration of this project over proposing unrelated architectures.