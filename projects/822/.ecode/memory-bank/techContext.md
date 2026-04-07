# Tech Context & Setup (Memory Bank)

## Core Stack
- Language: TypeScript end-to-end.
- Frontend: React, React Router, state management (Context/Redux/Zustand), component library (to be decided), CSS-in-JS or utility CSS.
- Backend: Node.js with Express or NestJS; ORM (Prisma/TypeORM) for DB access.
- Database: PostgreSQL (preferred for relational/data integrity).
- Payments: Stripe SDK + Stripe CLI for local testing.

## Key Dependencies (to track choices)
- Auth: library for password hashing (bcrypt/argon2), JWT lib if used, cookie parser.
- API: validation (Zod/Yup/Joi), logging (winston/pino), CORS.
- Frontend: HTTP client (fetch/axios), form handling (React Hook Form/Formik).

## Env Vars (examples to remember)
- FRONTEND: `VITE_API_URL`, `VITE_STRIPE_PUBLISHABLE_KEY`.
- BACKEND: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SESSION_COOKIE_NAME`, `NODE_ENV`.
- Infra: `PORT`, `LOG_LEVEL`.
