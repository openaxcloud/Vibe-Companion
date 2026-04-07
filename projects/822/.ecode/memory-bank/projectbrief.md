# Project Brief: E‑Commerce Marketplace Memory Bank

## Overview
- Full-stack TypeScript React e-commerce marketplace.
- Core features: product catalog with search & filters, shopping cart, checkout with Stripe, user auth, order management dashboard.
- Memory Bank purpose: persist decisions, patterns, and constraints to keep implementation aligned and consistent.

## Core Requirements (for Memory Tracking)
- Track evolving domain model: Users, Products, Carts, Orders, Payments, Vendors.
- Track UX and API contracts for: search, cart, checkout, dashboard.
- Capture integration details: Stripe flows, webhooks, error handling policies.
- Preserve auth/session decisions: JWT vs cookies, roles, permissions.

## Goals
- Provide a single source of truth for architectural and product decisions.
- Reduce rework by remembering prior choices and rationales.
- Enable consistent patterns across frontend, backend, and infra.

## Scope
- Covers requirements, architecture, tech stack, APIs, data model, and workflows.
- Excludes transient implementation details (e.g., small styling changes).
- Updated iteratively as features are designed and implemented.
