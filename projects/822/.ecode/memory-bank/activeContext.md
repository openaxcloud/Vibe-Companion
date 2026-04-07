# Active Context & Next Steps (Memory Bank)

## Current Focus: Initial Setup
- Align on architecture: SPA React frontend + TypeScript backend + Postgres + Stripe.
- Define minimal domain model for v1: User, Product, Cart, CartItem, Order, OrderItem, Payment.
- Establish auth approach (JWT + cookies) and basic role model.

## Immediate Next Steps (Checklist)
- [ ] Initialize monorepo or separate frontend/backend projects with TypeScript configs.
- [ ] Choose backend framework (Express vs Nest) and ORM (Prisma vs TypeORM) and record decision.
- [ ] Set up database schema migration tooling and seed scripts for test data.
- [ ] Configure Stripe keys and basic payment intent test flow.
- [ ] Implement auth endpoints (register, login, logout, current user) and basic JWT middleware.
- [ ] Implement minimal product listing API + React page with search & basic filters.
- [ ] Implement basic cart API + frontend cart state + add/remove/update item flows.
- [ ] Document all major decisions in the Memory Bank before expanding features.
