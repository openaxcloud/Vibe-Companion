# Tech Stack & Environment (Memory Bank)

1. **Core Stack:**
   - Language: TypeScript (frontend and backend).
   - Frontend: React, router, state/query library (e.g., React Router + React Query/Zustand/Redux).
   - Styling: CSS-in-JS or utility CSS (e.g., Tailwind) with theme support for dark mode.
   - Backend: Node.js + Express / Fastify (HTTP API), TypeScript.
   - Database: PostgreSQL (primary), with migration tooling (e.g., Prisma or Knex).
2. **Key Dependencies (planned):
   - Auth: library for password hashing (bcrypt/argon2), JWT/session management.
   - Payments: Stripe Node SDK (server), Stripe.js + Elements (client).
   - Email: nodemailer or transactional email SDK (e.g., SendGrid/Mailgun).
   - Tooling: ESLint, Prettier, Jest/React Testing Library, backend test framework.
3. **Dev Setup:**
   - Node LTS, pnpm/yarn/npm for package management.
   - Local DB via Docker (Postgres container).
   - `.env` for secrets; `.env.example` committed for reference.
   - Separate dev/stage/prod environment configs.
4. **Environment Variables (initial list):**
   - `NODE_ENV`, `PORT` (backend HTTP port)
   - `DATABASE_URL` (Postgres connection)
   - `JWT_SECRET` or session secret
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_USER`, `EMAIL_PASS`
   - `APP_BASE_URL` (for email links, Stripe return URLs).
5. **Build & Deploy Expectations:**
   - Frontend built as static assets served by backend or separate CDN.
   - Backend deployed to a Node-compatible host; DB hosted on managed Postgres.
   - Basic CI: lint + tests + typecheck on push.
