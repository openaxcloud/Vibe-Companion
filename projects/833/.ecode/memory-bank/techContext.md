# Tech Context – Memory Bank for TypeScript Marketplace

1. **Core Stack (Marketplace):**
   - Frontend: React + TypeScript, likely with React Router and a state library.
   - Backend: Node.js + TypeScript with an HTTP framework (Express/Nest/Fastify).
   - Database: A relational DB (e.g., Postgres) or a document DB; decision logged as an ADR.
   - Payments: Stripe (Payment Intents, Webhooks, Dashboard integration).
2. **Key Dependencies to Track in Memory Bank:**
   - Auth: JWT/session libs, password hashing (e.g., bcrypt/argon2).
   - HTTP: Axios/fetch wrappers, request/response interceptors.
   - ORM/Query layer: Prisma/TypeORM/Knex (decision documented with pros/cons).
   - Stripe SDK versions and configuration patterns.
3. **Environment & Configuration (for docs):**
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
   - `DATABASE_URL`.
   - `JWT_SECRET` or session-related secrets.
   - `FRONTEND_BASE_URL`, `BACKEND_BASE_URL`, `STRIPE_WEBHOOK_URL`.
4. **Dev Setup Notes to Capture:**
   - Local dev: running frontend and backend, seeding products, using Stripe test keys.
   - Testing workflows: unit/integration tests for cart, orders, Stripe webhooks.
   - Local vs staging vs production config differences.
5. **Tooling Conventions:**
   - TypeScript config baseline (strictness, path aliases).
   - Linting/formatting (ESLint, Prettier) rules that impact how code is written.
   - Git hooks or CI checks tied to docs (e.g., ADR required for major changes).
6. **Memory Bank Implementation Detail:**
   - Lives in the same repo (e.g., `/memory/` directory), versioned with code.
   - Entries updated as part of PRs affecting architecture, flows, or APIs.
