# Tech Context – Stack & Setup for Memory Bank

1. **Primary Stack Decisions (to persist):**
   - Language: TypeScript end-to-end.
   - Frontend: React (framework specifics such as Next.js/CRA/Vite to be recorded once chosen).
   - Backend: Node.js TypeScript framework (Express/Nest/Next API routes – to be finalized).
   - DB: Postgres (or similar SQL) with a TypeScript-friendly ORM (Prisma/TypeORM – to record once chosen).
2. **Frontend Key Concerns:**
   - Routing (product lists, product detail, cart, checkout, account, admin dashboard).
   - State management for cart, auth, and theme (context, Zustand, Redux, or React Query cache – capture final choice).
   - Styling solution supporting dark mode (CSS-in-JS, Tailwind, or CSS modules – record decision).
3. **Backend Key Concerns:**
   - Auth (JWT/cookie sessions, password hashing, OAuth if used).
   - Stripe integration (PaymentIntents API, webhooks endpoint, idempotency).
   - Inventory-safe operations in transactions.
4. **Integrations & Env Vars to Track:**
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
   - `DATABASE_URL`.
   - `EMAIL_PROVIDER_API_KEY`, `FROM_EMAIL`.
   - `JWT_SECRET` / session keys, `APP_BASE_URL`.
5. **Tooling & Quality:**
   - Linting: ESLint with TypeScript rules.
   - Formatting: Prettier.
   - Testing: Jest/Vitest + React Testing Library, plus minimal API tests.
6. **What Memory Should Capture Over Time:**
   - Concrete library choices and versions.
   - Directory structure and module boundaries.
   - Reusable components (Button, Layout, ProductCard) and patterns around them.

