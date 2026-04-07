# Memory Bank – Project Brief

## Overview
- Memory Bank is a **TypeScript + React SaaS starter kit** focused on subscription-based products.
- It provides an end-to-end foundation: **marketing site, authentication, billing, and team management**.
- Goal: ship a production-ready starter that founders can clone and extend rather than re-building boilerplate.

## Core Requirements
- **Public marketing site** with a landing page, feature highlights, and pricing tiers.
- **Stripe-based subscription billing** (monthly/yearly), handling trials, plan upgrades/downgrades, and cancellations.
- **User authentication** (email/password + magic link or OAuth-ready) with secure session handling.
- **Team / workspace management**: invites, roles (owner, admin, member), and multi-tenant isolation.
- **Account & billing settings** UI: view/change plan, update payment method, view invoices.

## Goals
- Provide a **clean, opinionated architecture** that is easy to reason about and extend.
- Favor **developer productivity**: clear module boundaries, consistent patterns, and sensible defaults.
- Ensure **security & compliance basics**: protected routes, secure token storage, Stripe webhooks.
- Optimize for **fast onboarding**: a new developer should understand the system in under an hour.

## Scope
- Frontend: React-based SPA/SSR app, responsive, with minimal but polished UI.
- Backend: API layer for auth, billing, teams, and internal admin actions.
- Integrations: Stripe for billing; email provider for auth & invites (pluggable).
- Not in scope: complex analytics, in-app messaging, or full CMS (can be added later).
