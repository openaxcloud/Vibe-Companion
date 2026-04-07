# Tech Context & Environment in Memory Bank

1. **Primary Stack:**
   - Language: **TypeScript** across frontend and backend.
   - Frontend: **React** (SPA or Next.js React framework).
   - Backend: Node.js TypeScript framework (to be chosen/recorded: Express/Nest/Next API routes).
   - Database: relational (e.g., PostgreSQL) with TypeScript ORM (Prisma/TypeORM) – record once selected.
2. **Key Dependencies to Track:**
   - React + router (React Router or Next router).
   - HTTP client/state: React Query or equivalent.
   - Stripe SDKs (frontend & backend) and webhook handling lib.
   - Auth library (e.g., NextAuth, custom JWT, or Passport‑based).
   - Email client SDK (SendGrid/SES/Mailgun).
   - UI toolkit/theme system for responsive layout + dark mode.
3. **Environment Variables (conceptual):**
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
   - `DATABASE_URL`.
   - `JWT_SECRET` or auth provider secrets.
   - `EMAIL_API_KEY` and `EMAIL_FROM`.
   - App URLs: `APP_URL`, `API_URL`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`.
4. **Dev Setup Notes to Remember:**
   - Local dev uses test Stripe keys and sandbox email.
   - Seed scripts for sample products and test users.
   - Shared TypeScript types between frontend and backend for domain models.
5. **Memory Role:** Keep an up‑to‑date snapshot of chosen libs, versions (when specified), env expectations, and tooling decisions (linting, formatting, testing) to guide future code snippets and environment‑specific instructions.
