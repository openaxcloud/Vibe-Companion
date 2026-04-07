# Memory Bank – Active Context & Next Steps

## Current Focus
- Establish foundational architecture and scaffolding for the TypeScript React frontend and TypeScript backend.
- Decide and record: framework choices (Express vs Nest, etc.), ORM, auth mechanism, and Stripe integration mode.
- Set up environment config to support local dev with Stripe test mode.

## In-Scope for This Phase
- Project structure (client/server or monorepo) and base tooling.
- Auth skeleton (sign up/in endpoints + React forms; no full UX polish yet).
- Product catalog read-only endpoints and basic UI list/detail.
- Basic cart state on frontend and corresponding backend model.

## Next Steps Checklist
- [ ] Choose backend framework (Express/Fastify/Nest) and scaffold TypeScript project.
- [ ] Choose ORM (e.g., Prisma) and define initial schema: User, Product, Cart, CartItem, Order, OrderItem.
- [ ] Set up React + TypeScript app with routing and base layout.
- [ ] Implement .env management and document required env vars for Stripe and DB.
- [ ] Implement auth flow: signup/login/logout + protected routes.
- [ ] Expose product listing/search APIs and wire to frontend catalog.
- [ ] Implement server-backed cart endpoints and React cart state.
- [ ] Integrate Stripe in test mode for checkout, including webhooks and order state updates.
- [ ] Add minimal admin dashboard for viewing orders.
