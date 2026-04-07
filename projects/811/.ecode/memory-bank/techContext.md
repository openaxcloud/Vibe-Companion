# Tech Context – Memory Bank

## Core Stack (Fixed in Memory)
- Language: TypeScript end‑to‑end.
- Frontend: React (SPA) with React Router for routing.
- Backend: TypeScript (Node.js framework such as Express/Fastify/Nest – pick one and keep consistent).
- Database: relational (e.g., PostgreSQL) with TypeScript ORM (Prisma/TypeORM).

## Key Libraries (Intended)
- Auth: library for password hashing (bcrypt/argon2); JWT/session library.
- HTTP: Axios/fetch on frontend; REST API on backend.
- Forms & Validation: React Hook Form + Zod/Yup.
- Payments: Stripe Node SDK on backend, Stripe JS + Elements on frontend.

## Dev & Build Setup
- Package manager: npm or yarn (stay consistent across docs).
- Tooling: ESLint, Prettier, TypeScript strict mode, testing with Jest/Vitest and React Testing Library.
- Bundler: Vite/webpack for frontend; ts-node/tsup for backend dev/build.

## Environment Variables (Persistent List)
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL`
- `JWT_SECRET` or session secret
- `NODE_ENV`, `PORT`, `CLIENT_URL`, `SERVER_URL`

## Deployment Assumptions
- Separate frontend and backend deployments with CORS configured.
- Use environment‑specific configs (dev/stage/prod) while preserving the same API contracts.