# Project Brief – Memory Bank: E‑commerce Marketplace

## Overview
- Memory Bank entry for: **Full-stack e-commerce marketplace** built with **TypeScript + React**.
- Purpose: Persist core project intent, constraints, and success criteria to guide all future decisions.

## Core Requirements
- Product catalog with search, category filters, price range, and sorting.
- Shopping cart with full checkout flow (shipping, tax estimate stub, payment).
- Stripe-based payments (cards; extensible to wallets later).
- User authentication (signup/login, password reset) and profile.
- Marketplace behavior: multiple sellers, per-seller products, and order attribution.
- Order management dashboard for buyers (order history, tracking) and admins (order list, status updates, refunds).

## Goals
- Deliver a **secure, reliable, and performant** marketplace MVP.
- Achieve **clear, composable front-end architecture** aligned with React + TypeScript best practices.
- Ensure **payment flows are robust and PCI-safe** via Stripe Elements/Checkout.
- **Minimize coupling** between product catalog, orders, and payment provider.

## Scope (MVP)
- Web app only (responsive desktop/mobile); no native apps.
- Single region, single currency (e.g., USD) configuration in Stripe.
- Basic admin features for catalog and order management; no advanced analytics.
- No on-platform messaging or reviews in MVP (possible v2).

## Non-Goals
- Custom payment gateway implementation (Stripe is the single provider).
- Complex marketplace revenue sharing and tax automation (simple fee model first).
- Multi-tenant white-label support (single marketplace instance).
