# Memory Bank – System Architecture & Patterns

## High-Level Architecture
- **Client**: React (TypeScript) SPA/SSR with route-based code splitting.
- **Backend**: TypeScript API layer (e.g., Node/Express or Next.js API routes) exposing REST/JSON endpoints.
- **Data Layer**: SQL database (e.g., Postgres) with a type-safe ORM (Prisma or equivalent).
- **Billing Integration**: Stripe for subscriptions, webhooks for lifecycle events.
- **Auth Layer**: Session-based auth (HTTP-only cookies) or JWT with rotation; password + magic-link ready.

## Key Modules
- `auth`: signup, login, sessions, password reset, email verification.
- `billing`: plans, Stripe Checkout/Portal integration, webhook handlers, subscription state sync.
- `teams`: team CRUD, membership, roles, invitations, team-switching.
- `marketing`: public landing, pricing, docs/help stubs.
- `app-core`: dashboard shell, feature flag hooks, tenant-scoped services.

## Design Patterns
- **Domain-driven modularization**: group code by domain (auth, billing, teams) not by technical layer.
- **Hexagonal/ports & adapters**: Stripe, email, and persistence behind interfaces for easy swapping/testing.
- **Command/Query separation**: clear distinction between read endpoints and mutating operations.
- **Multi-tenancy guard pattern**: every team-scoped operation requires `teamId` + membership check.
- **Webhook outbox pattern (lightweight)**: log inbound Stripe events before processing for idempotency.

## Security & Compliance
- HTTP-only cookies for sessions; CSRF protection on sensitive endpoints.
- Role-based access control (RBAC) for team roles, owner-only billing changes.
- Stripe signature verification for webhooks; event replay protection via idempotency keys.
