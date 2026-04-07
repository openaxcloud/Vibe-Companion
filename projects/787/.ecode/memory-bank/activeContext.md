# Memory Bank – Active Context & Next Steps

## Current Focus: Initial Setup
- Establish repo structure, dev tooling, and base configurations.
- Implement foundational auth and multi-tenant data model.
- Wire up Stripe products/prices and basic checkout + webhook flow.

## Immediate Next Steps (Checklist)
- [ ] Initialize TypeScript React frontend and Node backend (possibly as monorepo).
- [ ] Configure ESLint, Prettier, testing framework, and basic CI.
- [ ] Set up PostgreSQL schema: `users`, `organizations`, `memberships`, `subscriptions`, `invitations`.
- [ ] Implement auth flows: sign up, login, password reset, email verification.
- [ ] Implement organization creation and switching, with RBAC roles.
- [ ] Configure Stripe products/prices and environment variables.
- [ ] Build pricing page mapped to Stripe prices and launch Stripe Checkout session.
- [ ] Implement Stripe webhook handler to sync subscription status and trial periods.
- [ ] Create basic app shell: marketing layout, app layout, protected routes.
- [ ] Add team management UI: invite members, accept invite, change roles.
- [ ] Document local/dev deployment steps and seed scripts.
