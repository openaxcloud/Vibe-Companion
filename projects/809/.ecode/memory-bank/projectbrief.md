# Project Brief – Memory Bank: E‑commerce Marketplace

## Overview
- Memory Bank is the central knowledge base for the full-stack TypeScript/React e-commerce marketplace.
- It stores decisions, constraints, patterns, and conventions so the system can be extended consistently over time.

## Core Requirements Captured
- Multi-vendor product catalog with search, filters, and pagination.
- Shopping cart and checkout flow integrated with Stripe payments.
- User authentication (signup, login, sessions) and profile basics.
- Order creation, payment confirmation, and order history.
- Admin/vendor order management dashboard.

## Memory Bank Goals
- Preserve architectural decisions (what & why) to avoid re‑litigating choices.
- Provide a shared language for components, modules, and data models.
- Enable incremental feature development without breaking core flows.
- Track integration contracts with Stripe and any backend services.

## Scope of Documentation
- Functional scope: catalog, cart, checkout, auth, orders, dashboards.
- Technical scope: TypeScript React frontend, API boundaries, data models, state management, and integration touchpoints.
- Non-goals: Detailed UI design specs or exhaustive API reference (those live elsewhere; Memory Bank links to them).

## Usage
- Treat Memory Bank as the first place to check before adding/changing features.
- Update entries whenever we add new flows (e.g., refunds, coupons) or alter data models.
- Keep information high-signal and implementation-agnostic where possible.
