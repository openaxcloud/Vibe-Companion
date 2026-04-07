# Memory Bank – Product Context

## Problem Statement
- SaaS founders repeatedly build the same **boring infrastructure**: auth, billing, teams, landing page.
- This slows validation and leads to fragile, copy-pasted code from ad-hoc tutorials.
- Memory Bank solves this by providing a **robust, reusable starter kit** with sensible patterns.

## Target Users
- Solo founders and small teams building **B2B or prosumer SaaS**.
- Agencies that need a **re-usable baseline** for multiple SaaS projects.
- Developers who prefer **TypeScript + React** and want Stripe subscriptions out-of-the-box.

## UX Goals
- **Frictionless signup**: clear pricing, onboarding in < 2 minutes.
- **Transparent billing**: users always know their current plan, limits, and next charge date.
- **Intuitive team model**: easy to invite coworkers and manage roles.
- **Predictable navigation**: clear separation between marketing pages, app workspace, and account settings.

## Key User Flows
1. **Marketing Visitor → Trial User**
   - Land on marketing page → view features & pricing → click "Start free trial" → sign up → onboarded to default team.
2. **User → Subscriber**
   - From inside the app or pricing page → pick a plan → Stripe Checkout/Customer Portal → plan activated → access updated.
3. **Owner → Team Management**
   - Open workspace settings → invite member via email → member accepts invite → role assigned → access enforced in app.
4. **Owner → Manage Billing**
   - Open billing settings → manage payment method, upgrade/downgrade plan, cancel subscription → Stripe reflects changes.
5. **Authenticated User → Daily Use**
   - Log in → switch between teams/workspaces → access team-scoped data and features safely.
