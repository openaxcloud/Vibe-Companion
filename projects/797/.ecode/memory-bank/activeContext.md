# Active Context – Initial Memory Bank Focus

## Current Phase
- Early architecture and setup phase for the full‑stack TypeScript/React e‑commerce marketplace.
- Decisions about backend framework, DB schema, and Stripe integration strategy are either pending or being finalized.

## What the Team Is Focusing On Now
- Confirming high‑level architecture (React frontend + Node/TS backend + Postgres + Stripe).
- Defining core domain models: User, Product, ProductVariant/Inventory, Cart, Order, Payment.
- Choosing frontend routing/rendering strategy (SPA vs Next.js for SSR/SEO).
- Establishing base project structure, linting/formatting, and shared TS types.

## Next Steps Checklist (For Future Memory Entries)
- [ ] Lock in backend framework and document rationale.
- [ ] Define and document initial DB schema and relationships.
- [ ] Decide on auth stack (JWT vs sessions, library choice) and roles model.
- [ ] Choose frontend state management (React Query/Redux) and UI kit.
- [ ] Outline Stripe payment flow (Checkout vs Elements) and webhook handling pattern.
- [ ] Create initial vertical slice: browse products → add to cart → mock checkout.
- [ ] Add observability basics: logging, error tracking, minimal metrics.
