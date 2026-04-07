# Tech Context – Stack & Configuration Memory

1. **Core Stack:**
   - Language: TypeScript across frontend and backend.
   - Frontend: React (SPA), likely with a router and state management (e.g., React Context or Redux).
   - Backend: Node.js with an HTTP framework (e.g., Express/Nest) exposing REST APIs.
   - Database: Relational (e.g., PostgreSQL) or document (e.g., MongoDB) – record chosen DB and schema conventions.
2. **Key Dependencies to Record:**
   - React, React Router, state library (if any).
   - HTTP client (e.g., axios/fetch wrapper).
   - Backend framework, ORM/ODM (e.g., Prisma/TypeORM/Mongoose).
   - Stripe SDK (frontend + backend) and webhook handling library.
   - Auth libraries (e.g., passport, JWT, or custom middleware).
3. **Development Setup:**
   - How to run frontend and backend locally (commands, ports).
   - Local DB setup/migrations; seeding sample products.
   - Mock/Stripe test setup (test keys, scripts, tunnels for webhooks if needed).
4. **Environment Variables to Track (names only, no secrets):**
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
   - `DATABASE_URL` (or equivalent).
   - `JWT_SECRET` or session config variables.
   - `APP_BASE_URL`, `API_BASE_URL`, `FRONTEND_URL`.
   - Any feature flags for payments, search, or experimental flows.
5. **Build & Deployment:**
   - Build commands and output artifacts (frontend build, backend bundle).
   - Environment-specific configs (dev/stage/prod differences recorded here).
   - Strategy for migrations and rollback.
6. **Testing Strategy Stored in Memory:**
   - Testing tools (Jest, React Testing Library, supertest, etc.).
   - Conventions for integration tests around checkout and Stripe webhooks.
