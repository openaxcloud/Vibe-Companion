# Tech Stack & Environment – Memory Bank

1. **Front-end:**
   - React + TypeScript SPA.
   - Routing via React Router (or similar) for catalog, product detail, cart, checkout, account, and admin pages.
   - UI library (e.g., Tailwind CSS, Chakra UI, or Material UI; choose and persist here once decided).
2. **Back-end:**
   - Node.js + TypeScript (framework: Express, NestJS, or similar; decide and record here).
   - REST (or GraphQL) API with typed request/response contracts.
3. **Database & Persistence:**
   - SQL (e.g., PostgreSQL) or NoSQL (e.g., MongoDB); once chosen, store schema conventions here.
   - ORM/Query builder (e.g., Prisma, TypeORM, or Knex; record models and migrations approach).
4. **Payments:**
   - Stripe SDK for server-side operations.
   - Stripe.js and Stripe Elements/Checkout on client.
5. **Auth & Sessions:**
   - Password-based auth with hashing (e.g., bcrypt).
   - JWT or cookie-based session tokens; secure, HTTP-only cookies if possible.
6. **Key NPM Dependencies (to track here):**
   - React, React Router, chosen UI kit, form library (e.g., React Hook Form), state manager if any.
   - Express/Nest, ORM, validation library (e.g., Zod/Yup), Stripe SDK.
7. **Core Env Vars (naming to standardize):**
   - FRONTEND: `VITE_API_BASE_URL` (or analogous), `VITE_STRIPE_PUBLISHABLE_KEY`.
   - BACKEND: `PORT`, `DATABASE_URL`, `JWT_SECRET` (if JWT), `SESSION_SECRET` (if sessions), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_BASE_URL`.
8. **Dev Experience:**
   - Monorepo or separate repos (decide and store).
   - Local dev using `.env` files, seeded dev DB, mock data for products.
