# Active Context – Current Focus & Next Steps

## Current Focus: Initial Setup
- Clarify foundational decisions: **auth model, DB schema skeleton, Stripe integration mode**, and app routing.
- Establish a **working dev environment** with TypeScript, bundling, and linting in place.

## Immediate Next Steps (Checklist)
- [ ] Choose backend framework + ORM (e.g., Express + Prisma) and scaffold project.
- [ ] Define initial DB schema: User, Product, Category, Seller, Order, OrderItem, Cart.
- [ ] Initialize React + TypeScript frontend with routing and base layout.
- [ ] Implement basic auth API (signup/login/logout) and connect to frontend forms.
- [ ] Configure Stripe in backend (test keys) and add a simple test route.
- [ ] Define API contracts for catalog, cart, checkout, and orders (typed DTOs).
- [ ] Set up React Query + API client; wire product listing → backend.
- [ ] Create initial admin-only route protection and placeholder dashboard.
- [ ] Add basic observability: logging middleware, error handler, simple health check.
- [ ] Document `README` for setup, env vars, and run scripts.
