# Tech Context – Memory Bank

## Core Stack
- Language: TypeScript end‑to‑end.
- Frontend: React, React Router, React Query (or similar), CSS framework (e.g., Tailwind or CSS‑in‑JS).
- Backend: Node.js, Express (or Fastify) + TypeScript, Node Postgres client (pg) or ORM (Prisma).
- Payments: Stripe SDK (server + client), Webhooks with signed secret verification.

## Project Structure (Baseline)
- `/frontend`: React app with feature‑oriented folders (catalog, cart, checkout, auth, admin).
- `/backend`: Express API with `routes/`, `controllers/`, `services/`, `repositories/`, `models/`.
- Shared types (if any) in `/shared` or via generated TypeScript types.

## Key Dependencies to Track
- Frontend: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `axios` or `fetch` wrappers, UI library.
- Backend: `express`, `cors`, `helmet`, `jsonwebtoken` or session middleware, `pg`/`prisma`, `stripe`.
- Tooling: `ts-node`/`ts-node-dev` or `nodemon`, `tsx`, `eslint`, `prettier`, `vitest`/`jest`.

## Environment Variables (Examples)
- `NODE_ENV` – environment selection.
- `PORT` – backend port.
- `DATABASE_URL` – Postgres connection string.
- `JWT_SECRET` or session secret.
- `STRIPE_SECRET_KEY` – server‑side secret.
- `STRIPE_WEBHOOK_SECRET` – webhook signing secret.
- `STRIPE_PUBLISHABLE_KEY` – frontend.
- `APP_BASE_URL` – used for redirect/return URLs.

## Dev Setup Notes
- Run backend and frontend independently with CORS during dev; use a reverse proxy only in prod.
- Use migrations (Prisma or another tool) to version DB schema.
- Keep `.env` out of version control; provide `.env.example` with required keys.
