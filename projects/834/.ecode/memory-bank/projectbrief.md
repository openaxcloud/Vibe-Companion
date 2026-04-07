# Project Brief – E‑Commerce Marketplace Memory Bank

## Overview
- Project: Full-stack e‑commerce marketplace with Stripe payments.
- Stack: TypeScript, React on frontend; (to be finalized) TypeScript-based backend (likely Node/Express or Nest); REST/JSON APIs.
- Purpose: Multi-vendor style marketplace with catalog, search/filters, cart, checkout, authentication, and order management dashboard.

## Core Requirements
- Product catalog: list, detail pages, images, pricing, inventory, categories, tags.
- Search & filters: keyword search, category filter, price range, sort by relevance/price/date.
- Shopping cart: add/remove/update quantities, persist per user/session.
- Checkout: address + shipping, payment via Stripe (cards; later extensible), order confirmation.
- Authentication: sign up, login, logout, password reset; JWT or session-based.
- Order management dashboard: view orders, statuses, payments; basic admin/vendor controls.

## Goals
- Provide a performant, mobile-friendly marketplace experience.
- Keep architecture modular for future features (reviews, wishlists, multi-vendor, promotions).
- Ensure secure handling of payments and user data.

## Scope
- In-scope: core marketplace flows described above; minimal admin UI; basic reporting.
- Out-of-scope (for now): advanced analytics, recommendation engine, complex CMS, multi-language.
- Deliverable: deployable full-stack app with Stripe integration and production-ready baseline.
