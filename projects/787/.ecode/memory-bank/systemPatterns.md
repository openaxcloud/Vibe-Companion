# Memory Bank – Architecture & System Patterns

## High-Level Architecture
- SPA or SPA-with-SSR React frontend (TypeScript) consuming a typed REST/GraphQL API.
- Backend (TypeScript) with layered architecture: API layer → service layer → repository layer.
- Multi-tenant data model with Organizations/Workspaces, Users, Memberships, and Subscriptions.

## Key Technical Decisions
- Stripe as the single source of truth for billing amounts; app stores only references & status.
- Role-based access control (RBAC) based on OrganizationMembership (role: owner/admin/member).
- Strong typing end-to-end with shared TypeScript types between frontend and backend.

## Design Patterns
- Authentication: JWT or session-based auth with refresh tokens; middleware for auth & tenancy.
- Multi-tenancy: per-request tenant resolution via subdomain or workspace slug + membership.
- Billing integration: Stripe webhooks handler as a dedicated module with idempotency keys.
- Domain services: `AuthService`, `BillingService`, `TeamService`, `SubscriptionService`.
- Repositories: abstracted data access per aggregate (`UserRepo`, `OrgRepo`, `SubscriptionRepo`).
- UI composition: layout shells for `MarketingLayout` vs `AppLayout` with route guards.

## Observability & Reliability
- Centralized error handling + logging for webhook and auth flows.
- Basic audit logging for security-sensitive actions (invites, role changes, billing changes).
