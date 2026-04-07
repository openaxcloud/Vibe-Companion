# Project Brief – Memory Bank for E‑commerce Marketplace

## Overview
- This Memory Bank documents durable context for a full‑stack e‑commerce marketplace built in TypeScript/React.
- It captures product vision, architecture patterns, tech choices, and active priorities to keep decisions consistent over time.

## Project Summary
- Build a marketplace with: product catalog (search & filters), shopping cart + checkout flow, Stripe payments, auth, and order management dashboard.
- Full‑stack TypeScript with React front end; backend will expose APIs for products, cart, orders, auth, and Stripe integration.

## Core Requirements to Remember
- Buyers can browse/search/filter products, add to cart, and pay using Stripe.
- Users can register/login, view order history, and manage basic profile details.
- Admin/seller dashboard to view/manage orders and basic catalog operations.
- Secure payment flow: client + server Stripe integration, webhooks for payment status.

## Goals and Constraints
- Prioritize clarity, reliability, and testability over premature optimization.
- Use patterns that scale to multiple developers and future feature additions.
- Maintain consistent TypeScript usage across front end and back end.

## Scope Boundaries (v1)
- Single marketplace (multi‑seller support is out of scope for initial version).
- Basic catalog attributes (title, price, description, images, categories, inventory).
- No complex recommendations, reviews, or promotions in v1.

## Memory Bank Role
- Serve as the single source of truth for product, architecture, and tech decisions.
- Reduce re‑litigation of previous decisions and keep new work aligned with vision.
- Evolve as features, constraints, and priorities change.
