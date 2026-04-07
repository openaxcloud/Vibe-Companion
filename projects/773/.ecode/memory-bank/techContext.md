# Tech Context & Setup – Memory Bank

1. **Core Stack:**
   - Frontend: React + TypeScript, React Router, React Query/Redux, CSS‑in‑JS or Tailwind.
   - Backend: Node.js + TypeScript with Express or Next.js API routes.
   - DB: PostgreSQL (via Prisma or TypeORM).
2. **Key Dependencies (planned):**
   - `react`, `react-dom`, `react-router-dom`.
   - `@stripe/stripe-js`, `@stripe/react-stripe-js`, `stripe` (server).
   - `jsonwebtoken` or session middleware, `bcrypt` for password hashes.
   - `nodemailer` or email provider SDK (e.g., SendGrid/Mailgun).
   - `prisma` (or ORM of choice) + `pg` driver.
3. **Dev Environment:**
   - Node LTS, pnpm/yarn for package management.
   - `.env` files with separate values for dev, staging, prod.
   - ESLint + Prettier + TypeScript strict mode; basic test runner (Jest/Vitest).
4. **Environment Variables (examples):
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
   - `JWT_SECRET` or session secret
   - `EMAIL_SMTP_HOST`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS`, `EMAIL_FROM`
   - `APP_BASE_URL`, `FRONTEND_URL`
5. **Build & Deploy:**
   - Frontend built with Vite or Next.js build; backend bundled with ts-node or build step.
   - Deployment targets: e.g., Vercel/Netlify for frontend, Render/Fly.io for backend + DB.
