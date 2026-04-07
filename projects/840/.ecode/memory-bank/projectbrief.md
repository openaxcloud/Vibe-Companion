# Memory Bank – Project Brief

## Overview
- **Project**: Full-stack e-commerce marketplace with Stripe, search/filterable catalog, cart & checkout, auth, and order dashboard.
- **Memory Bank Role**: Persist key decisions, conventions, and context so the team can move fast without re-litigating choices.

## Core Requirements to Remember
- **Domain**: Multi-vendor marketplace (buyers, sellers, admins) with secure payments via Stripe.
- **Frontend**: TypeScript + React SPA with product catalog, search/filters, cart, checkout, order history.
- **Backend**: TypeScript API (likely Node/Express or similar) with REST/GraphQL endpoints, Stripe integration, auth, and admin tools.
- **Data**: Products, users, orders, payments, carts, inventory, and vendor data.

## Goals of the Memory Bank
- Capture **architectural decisions** (APIs, data models, security approach, payment flow).
- Record **UX and domain rules** (search behavior, filter semantics, cart rules, order states).
- Track **integration details** (Stripe modes, webhook handling, environment configs).
- Provide a **living source of truth** for new contributors and future changes.

## Scope of This Memory Bank
- Focused on this marketplace only (not generic e-commerce).
- Includes design decisions, patterns, naming conventions, and constraints.
- Excludes low-level implementation detail that can be derived from code unless it encodes important policy or workflow.
