# Memory Bank – Project Brief

## Overview
- Memory Bank is an internal knowledge base summarizing key decisions, constraints, and context for the e-commerce marketplace project.
- It ensures consistency across the team as the app evolves: what we are building, why, and how.

## Project Summary
- Build a full-stack e-commerce marketplace using TypeScript + React.
- Core capabilities: product catalog with search/filters, shopping cart + checkout, Stripe payments, user auth, and order management dashboard.
- Multi-role support: anonymous visitors, authenticated buyers, and admin/ops users.

## Core Requirements to Remember
- Secure, reliable checkout with Stripe (no raw card handling; use Stripe Elements/Checkout).
- Robust catalog: categories, search, filtering, sorting.
- Persistent cart per user (guest cart + upgrade on sign-in).
- Order lifecycle: creation, payment confirmation, status updates, and admin visibility.
- Modern UX: responsive, fast, and accessible.

## Goals
- Provide a clean, extensible architecture for future features (e.g., reviews, inventory, shipping rules).
- Maintain a single source of truth for decisions (this Memory Bank) to reduce rework.

## Scope Boundaries
- Start with a single-tenant marketplace (one store / brand), not a multi-vendor platform.
- Shipping and tax logic: basic flat rules at first; integrate advanced services later.
- Minimal CMS capabilities; focus on core commerce flows.
