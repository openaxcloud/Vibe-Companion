# Project Brief – Memory Bank for E‑commerce Marketplace

## Overview
- This Memory Bank documents durable decisions, patterns, and context for the e‑commerce marketplace project.
- It is optimized for an AI assistant to recall constraints, preferences, and prior work across sessions.

## Core Project Requirements
- Full‑stack TypeScript e‑commerce marketplace built with React on the frontend.
- Product catalog with search, filters, and pagination.
- Shopping cart with full checkout flow and order creation.
- Stripe integration for secure payments (card payments, webhooks for payment status).
- User authentication (sign up, login, session handling, protected pages) and basic profile.
- Order management dashboard (for customers and admins/operators).

## Memory Bank Goals
- Preserve architectural and product decisions to avoid re‑deciding.
- Maintain consistency in UX flows, API shapes, and data models.
- Track constraints (e.g., tech stack, non‑goals) and accepted trade‑offs.

## Project Scope (for Memory)
- Store only what is stable or reused: domain models, routes, APIs, envs, key flows.
- Exclude highly transient details (e.g., one‑off logs, temporary debugging steps).
- Focus on “how this marketplace works” rather than generic e‑commerce theory.

## How This Memory Will Be Used
- As a reference for future tasks: feature additions, refactors, test strategy, and documentation updates.
- To keep new code, prompts, and designs aligned with previously agreed behavior and terminology.