# Project Brief – Memory Bank for E‑Commerce Marketplace

## Overview
- This Memory Bank captures durable knowledge about the e‑commerce marketplace project for reuse across prompts and sessions.
- It stores architectural decisions, domain concepts, constraints, and conventions, not transient task details.

## Core Requirements
- Persist high‑level product and system context: marketplace, Stripe payments, product catalog, search/filters, cart/checkout, auth, and order management.
- Maintain a consistent vocabulary for entities such as Product, Seller, Buyer, Cart, Order, PaymentIntent.
- Track critical decisions about tech stack: TypeScript, React front end, full‑stack architecture, API style, and integrations.

## Goals
- Help the AI respond consistently with prior decisions and avoid re‑deriving architecture from scratch.
- Reduce ambiguity in future prompts (e.g., "cart" always means server‑backed cart tied to authenticated users by default).
- Enable quick recall of UX flows and system patterns when implementing or extending features.

## Scope
- Long‑lived, implementation‑agnostic knowledge: requirements, workflows, domain models, integrations.
- Excludes one‑off commands, temporary debugging details, or highly implementation‑specific snippets.
- Evolves as major decisions change (e.g., switching payment provider or auth mechanism) and records rationale at a high level.
