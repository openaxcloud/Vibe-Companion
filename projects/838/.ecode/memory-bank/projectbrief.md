# Project Brief – Memory Bank for E‑Commerce Marketplace

## Overview
- This Memory Bank documents durable decisions, constraints, and patterns for a full‑stack e‑commerce marketplace.
- Tech stack: TypeScript, React (frontend), Node/Express or equivalent API, Stripe integration, persistent DB (likely Postgres).
- Core features: product catalog with search/filters, shopping cart + checkout, Stripe payments, auth, order management dashboard.

## Core Requirements to Remember
- User auth: email/password (JWT or session) with protected routes for account and admin dashboards.
- Marketplace catalog: products, categories, variants, prices, images, inventory.
- Search & filters: free‑text search, category, price range, sort options (relevance, price, newest).
- Shopping cart: persistent per user (and anonymous session), supports quantity updates, promo codes (future).
- Checkout: address, shipping method (configurable placeholder), Stripe PaymentIntent flow, order confirmation.
- Order management dashboard: for admins/sellers to view, filter, and update order status.
- Responsive UI: mobile‑first, accessible components, clear error and loading states.

## Goals
- Build a clean, composable TypeScript React app with a clear separation of concerns between UI, domain logic, and data access.
- Ensure payment and auth flows are secure, auditable, and testable.
- Keep architecture extensible for future additions (multiple sellers, wishlists, reviews, etc.).

## Project Scope (Initial Phase)
- Single storefront (not multi‑tenant) with a single admin role.
- Basic Stripe card payments (no subscriptions, no Stripe Connect in v1).
- Simple shipping model: flat‑rate or free shipping; handled as line items/metadata.
- Minimal but production‑oriented: error handling, logging, and basic monitoring hooks in design.

## Out‑of‑Scope (For Now)
- Multi‑vendor payouts, complex tax engine, or region‑specific tax rules.
- On‑site product reviews, recommendations, or personalization.
- CMS for content pages; assume static or hard‑coded content for marketing pages.
