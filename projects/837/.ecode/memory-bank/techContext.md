# Memory Bank – Tech Context

## Core Stack
- **Language**: TypeScript end-to-end.
- **Frontend**: React, React Router (or Next.js routing if chosen), TailwindCSS or minimal design system.
- **Backend**: Node.js with an opinionated framework (e.g., Next.js API routes or Express).
- **Database**: PostgreSQL with Prisma ORM (type-safe models, migrations).
- **Billing**: Stripe (Billing + Customer Portal + Webhooks).
- **Email**: Provider-agnostic adapter (e.g., SendGrid/Postmark/SES).

## Development Setup
- Node.js LTS, PNPM/Yarn/NPM for dependency management.
- `.env` files for local, staging, production; never committed.
- Scripts: `dev`, `build`, `lint`, `test`, `db:migrate`, `db:seed`.
- Local dev using Stripe CLI for webhook forwarding.

## Key Dependencies (indicative)
- `react`, `react-dom`, `react-router-dom` or `next`.
- `typescript`, `ts-node`, `eslint`, `prettier`.
- `prisma`, `@prisma/client`, `pg`.
- `stripe`, `@stripe/stripe-js`.
- `jsonwebtoken` or session lib, `bcrypt` (or `argon2`) for passwords.
- `zod` or `yup` for schema validation.

## Environment Variables
- `DATABASE_URL` – Postgres connection string.
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`.
- `STRIPE_WEBHOOK_SECRET` – verify incoming Stripe webhooks.
- `APP_URL` – base URL for redirects and links.
- `SESSION_SECRET` – secure key for signing cookies/tokens.
- `EMAIL_FROM`, `EMAIL_PROVIDER_API_KEY`.
