# Active Context – Initial Setup & Next Steps

## Current Focus
- Establish foundational Memory Bank entries for architecture, flows, and tech stack.
- Lock initial decisions that affect many features: routing, state management, auth pattern, and Stripe integration approach.

## Short-Term Decisions to Finalize (Record Outcomes Here)
- Choose app scaffold (e.g., Vite + React + TS) and directory layout.
- Pick server-state library (React Query vs. alternative) and basic query patterns.
- Define auth mechanism (JWT + HTTP-only cookies vs. other) and protected route handling.
- Decide cart model: guest carts persisted in localStorage vs. fully server-side tied to user.

## Implementation Next Steps (Checklist)
- [ ] Initialize repo with TypeScript React setup and base tooling (linting, formatting).
- [ ] Create route map for core pages: `/`, `/products`, `/products/:id`, `/cart`, `/checkout`, `/orders`, `/admin/orders`.
- [ ] Define shared TypeScript types: `Product`, `CartItem`, `Order`, `User`, `PaymentIntentMeta`.
- [ ] Integrate React Query (or chosen lib) with API client and error handling conventions.
- [ ] Wire basic auth flow (login/logout UI, token storage, guarded routes).
- [ ] Implement minimal catalog list and product detail fetching.
- [ ] Set up Stripe client (publishable key, Stripe Elements provider) and placeholder checkout page.
- [ ] Document any deviations from planned patterns directly in this Memory Bank.
