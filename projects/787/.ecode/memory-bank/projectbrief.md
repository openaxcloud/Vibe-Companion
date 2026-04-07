# Memory Bank – SaaS Starter Kit – Project Brief

## Overview
- Memory Bank is a TypeScript/React SaaS starter kit that product teams can clone to rapidly launch subscription products.
- It includes marketing (landing page, pricing), subscription billing (Stripe), authentication, and team / workspace management.

## Core Requirements
- Public marketing site with landing page, feature sections, and responsive layout.
- Pricing tiers with free / trial / paid plans mapped directly to Stripe products & prices.
- Stripe subscription billing (checkout, customer portal, webhooks for lifecycle events).
- Secure user authentication (email/password + optional OAuth providers).
- Team management: organizations/workspaces, invite members, roles, and seat-aware billing.

## Goals
- Provide a clean, opinionated foundation that can be adapted to any B2B or prosumer SaaS.
- Minimize setup friction: one-command local dev, clear env configuration, seed data.
- Encapsulate subscription logic and access control so app features can plug in easily.

## Scope
- In-scope: core auth, teams, billing, marketing pages, minimal settings UI, basic audit logs.
- Out-of-scope: mobile apps, complex CRM, in-app analytics, complex feature flagging.
- Deliverable: a production-ready starter repo plus documentation explaining decisions.
