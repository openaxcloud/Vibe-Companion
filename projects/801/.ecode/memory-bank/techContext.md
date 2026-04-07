# Tech Context – What the Memory Bank Stores Technically

1. **Core Stack:**
   - Frontend: React + TypeScript, likely Vite or CRA, React Router, state management (e.g., Redux Toolkit/Zustand).
   - Backend: Node.js + TypeScript, Express/Fastify, REST API (possibly GraphQL later).
   - Database: SQL (PostgreSQL/MySQL) with an ORM (Prisma/TypeORM).
2. **Key Integrations:**
   - Stripe SDK (client + server): payment intents, webhooks, dashboards.
   - Auth: JWT or session‑based auth; potential use of a library (Passport, NextAuth if Next.js is chosen).
3. **Dependencies to Track in Memory:**
   - Versions and constraints for React, Node, ORM, and Stripe.
   - Shared type packages between backend and frontend.
   - Testing libraries (Jest, React Testing Library, Playwright/Cypress).
4. **Environment Variables (names & purpose, not secrets):**
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` – Stripe server integration.
   - `STRIPE_PUBLISHABLE_KEY` – client integration.
   - `DATABASE_URL` – main DB connection.
   - `JWT_SECRET` / `SESSION_SECRET` – auth.
   - `APP_BASE_URL`, `FRONTEND_URL`, `BACKEND_URL` – URL coordination.
5. **Dev Workflow Assumptions:**
   - Local dev via `docker-compose` for DB and possibly Stripe CLI for webhooks.
   - Migrations tracked via ORM; seeding strategies for products/test users.
6. **Memory Bank Usage:** Record tech choices, versions, env naming conventions, and migration/upgrade notes (e.g., Stripe API version changes).
