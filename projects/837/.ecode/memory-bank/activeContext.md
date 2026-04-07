# Memory Bank – Active Context & Next Steps

## Current Focus
- Establish a **minimal, working vertical slice**: from landing page → signup → basic team → Stripe subscription.
- Prioritize clean domain boundaries and a small but correct Stripe integration over extra features.

## Next Steps Checklist
- [ ] Initialize repo with TypeScript React app and Node/Next.js backend.
- [ ] Configure linting, formatting, basic testing, and CI workflow.
- [ ] Set up Postgres + Prisma schema for users, teams, memberships, plans, and subscriptions.
- [ ] Implement auth flows: signup, login, logout, password reset, email verification.
- [ ] Build landing page + pricing page wired to plan definitions.
- [ ] Integrate Stripe Checkout and Customer Portal for subscription management.
- [ ] Implement webhooks to sync subscription state to local DB (active, canceled, past_due).
- [ ] Add team management: create team, invite members, accept invite, assign roles.
- [ ] Protect app routes with auth and team-based RBAC guards.
- [ ] Polish onboarding: default team creation, plan selection hints, basic empty states.
