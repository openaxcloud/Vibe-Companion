# Tech Stack & Environment Memory

## Core Technologies
- Language: TypeScript end-to-end (frontend and backend).
- Frontend: React with functional components, hooks, and a router (React Router or Next.js routing if chosen).
- Backend: Node.js with a TypeScript-friendly framework (e.g., Express/Nest/Next API routes – must be standardized per project decision).
- DB: Postgres (via Prisma or another TypeScript ORM) for strong schema and migrations.

## Key Dependencies (planned)
- React + React Router (or Next.js) for SPA / hybrid routing.
- State management: React Query/RTK Query for server state; lightweight local state via hooks or Redux Toolkit if needed.
- Form handling & validation: React Hook Form + Zod.
- Auth: JSON Web Tokens or cookie-session library; bcrypt/argon2 for password hashing.
- Stripe SDK: `stripe` on backend, `@stripe/stripe-js` + `@stripe/react-stripe-js` on frontend (if using Elements).
- ORM: Prisma for schema, migrations, and typed queries.

## Environment Variables (to track)
- `DATABASE_URL` – connection string for Postgres.
- `STRIPE_SECRET_KEY` – secret API key for Stripe.
- `STRIPE_WEBHOOK_SECRET` – secret for verifying Stripe webhooks.
- `STRIPE_PUBLISHABLE_KEY` – public key used in frontend.
- `JWT_SECRET` or `SESSION_SECRET` – signing key for tokens/sessions.
- `APP_BASE_URL` – public URL used in redirects/webhooks.

## Dev Setup
- Node LTS, package manager (pnpm/yarn/npm) standardized across team.
- `.env` for local dev, `.env.example` checked in with placeholders.
- Scripts: `dev`, `build`, `test`, `lint`, `db:migrate`, `db:seed`.
