# Project Brief – Memory Bank: E‑commerce Marketplace

## Overview
- Memory Bank is a persistent knowledge base for this full-stack TypeScript/React e‑commerce marketplace.
- It stores decisions, patterns, constraints, and domain knowledge to keep the codebase and team aligned over time.

## Project Summary
- Build a marketplace web app with:
  - Product catalog (search, filters, categories).
  - Shopping cart and checkout flow.
  - Stripe-based payments.
  - User authentication and profiles.
  - Order management dashboard (admin/seller focus).

## Core Requirements (Product)
- Users can browse/search products, add to cart, and complete checkout using Stripe.
- Secure signup/login and session management.
- Persistent orders with status tracking (e.g., Pending, Paid, Shipped, Canceled).
- Admin/seller dashboard to manage products and orders.

## Core Requirements (Memory Bank)
- Capture stable decisions (e.g., DDD boundaries, auth model, Stripe integration mode).
- Track trade-offs, rejected options, and constraints (e.g., PCI scope, data privacy).
- Provide quick onboarding context for new contributors.
- Stay concise and updated as the source of architectural truth.

## Goals and Scope
- Keep Memory Bank focused on decisions that affect multiple layers (frontend, backend, DevOps).
- Exclude low-level implementation notes that belong in code comments.
- Support long-term maintainability, feature evolution, and refactors.
- Enable consistent behavior across product catalog, checkout, and order management features.
