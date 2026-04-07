# Project Brief: E‑Commerce Marketplace Memory Bank

## Overview
- Full‑stack TypeScript React e‑commerce marketplace with secure Stripe payments.
- Features: product catalog (search + filters), shopping cart, checkout, user auth, and order management dashboard.
- Memory Bank purpose: persist key product, system, and design decisions to keep implementation consistent over time.

## Core Requirements (to remember)
- Multi-user marketplace: buyers browse, sellers/admins manage products and orders.
- Product catalog: categories, tags, price range, search by text, sort by relevance/price/date.
- Cart + checkout: add/update/remove items, shipping options, tax handling, Stripe payment intents.
- Authentication: signup/login, sessions, account management, role-based access (user/admin).
- Order management dashboard: view orders, statuses, refunds, payouts, basic analytics.

## Goals
- Deliver a scalable, maintainable TypeScript codebase with clear boundaries between front-end, API, and data.
- Provide a smooth, trustworthy checkout experience to maximize conversion.
- Support incremental feature growth (discounts, reviews, inventory) without rewrites.

## Scope (initial phase)
- MVP marketplace (single region/currency) with Stripe integration.
- Admin-ish dashboard for viewing and updating orders.
- No complex multi-vendor settlement or advanced logistics in v1.
- Memory Bank will store finalized decisions, not every experiment.
