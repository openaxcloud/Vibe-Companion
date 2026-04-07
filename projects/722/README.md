# SaaS Starter Kit

A modern, production-ready SaaS starter template built with a TypeScript backend and React frontend. It includes authentication, subscription billing with Stripe, email delivery, and a database-backed API with a clean architecture.

This README explains:

- High-level project overview
- Tech stack
- Local development setup
- Environment variables
- Database setup and migrations
- Stripe integration
- Email setup
- Available scripts (dev, build, test)
- Deployment notes and recommendations

---

## 1. Project Overview

This project is a full-stack SaaS starter designed to help you launch subscription-based products quickly and safely. It is structured to be:

- Type-safe end to end
- Easy to deploy
- Secure by default
- Extensible for common SaaS needs

Core features:

- User authentication and session management
- Subscription billing via Stripe (with webhooks)
- Basic user and subscription models in the database
- Email notifications (e.g., welcome, password reset, billing-related)
- API-first design with a clear separation between frontend and backend
- Environment-based configuration for different stages (development, staging, production)

---

## 2. Tech Stack

Backend:

- Node.js (LTS)
- TypeScript
- Express (or similar HTTP framework)
- PostgreSQL (Primary database)
- Prisma ORM (Schema and migrations)
- Stripe (billing)
- Nodemailer or an email provider SDK (e.g., SendGrid, Postmark, SES)

Frontend:

- React
- TypeScript
- Vite or Next.js (depending on your folder structure; adapt as necessary)
- Tailwind CSS or a similar utility CSS framework (optional but common)
- Axios or fetch for API calls

Tooling & Infrastructure:

- npm or pnpm (package manager)
- dotenv for environment variables (in development)
- ESLint and Prettier for code quality and formatting
- Jest or Vitest for testing

---

## 3. Repository Structure

A typical structure looks like:

- /frontend
  - src/
  - public/
  - vite.config.ts or next.config.js
  - package.json
- /backend
  - src/
  - prisma/
  - package.json
- .env.example
- package.json (root, optional, for workspace scripts)
- README.md

Your actual structure may differ slightly, but the concepts remain the same.

---

## 4. Prerequisites

Before running this project, ensure you have:

- Node.js (LTS, e.g. >= 18)
- npm (>= 9) or pnpm/yarn
- PostgreSQL database (local or remote)
- Stripe account (with API keys)
- Email provider (SMTP or transactional email service)

---

## 5. Environment Variables

Create a .env file based on .env.example at the root of /backend and /frontend as required.

Backend .env (example):

- NODE_ENV=development
- PORT=4000

- DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public

- STRIPE_SECRET_KEY=sk_live_or_test_key
- STRIPE_WEBHOOK_SECRET=whsec_...

- APP_URL=http://localhost:3000

- SESSION_SECRET=some-long-random-string

- EMAIL_FROM="Your App <no-reply@yourapp.com>"
- EMAIL_SMTP_HOST=smtp.yourprovider.com
- EMAIL_SMTP_PORT=587
- EMAIL_SMTP_USER=your_smtp_user
- EMAIL_SMTP_PASSWORD=your_smtp_password
- EMAIL_SECURE=false

Frontend .env (example, using Vite conventions):

- VITE_API_URL=http://localhost:4000
- VITE_STRIPE_PUBLISHABLE_KEY=pk_live_or_test_key

Always:

- Keep secrets out of version control.
- Use separate keys for development, staging, and production.
- For deployment, use the host’s secret manager or environment configuration panel.

---

## 6. Local Development Setup

1. Clone the repository:

   git clone https://github.com/your-org/your-saas-starter.git
   cd your-saas-starter

2. Install dependencies:

   For a monorepo with frontend and backend:

   cd backend
   npm install

   cd ../frontend
   npm install

   Or if using a workspace in the root, you may run:

   npm install

3. Create environment files:

   Copy .env.example to .env in required folders and fill in values:

   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env

4. Setup your local database:

   Ensure PostgreSQL is running and that DATABASE_URL in backend/.env points to an existing database.

   Then run:

   cd backend
   npx prisma migrate dev

   This will create the schema and run any initial seed scripts if configured.

5. Start the development servers:

   Backend:

   cd backend
   npm run dev

   Frontend:

   cd frontend
   npm run dev

   By default:
   - Backend runs on http://localhost:4000
   - Frontend runs on http://localhost:3000

Update any ports as needed in the env files.

---

## 7. Database Setup & Migrations

This project uses Prisma for database schema management.

Main commands (from /backend):

- Initialize (already done in the template):
  npx prisma init

- Run all pending migrations in development:
  npm run prisma:migrate

  Usually mapped to:
  npx prisma migrate dev

- Generate Prisma client:
  npm run prisma:generate

  Usually mapped to:
  npx prisma generate

- View database in Prisma Studio:
  npm run prisma:studio

  Usually mapped to:
  npx prisma studio

Common workflow:

1. Update schema in prisma/schema.prisma
2. Create a new migration:
   npx prisma migrate dev --name descriptive_migration_name
3. Commit schema.prisma and the generated migration files to version control.

In production:

- Use:
  npx prisma migrate deploy
- Run this during your deployment step to ensure the database is up-to-date.

---

## 8. Stripe Integration

Stripe is used for subscription billing, checkout, and webhooks.

### 8.1. Stripe Configuration

1. Create a Stripe account:
   https://dashboard.stripe.com/

2. Retrieve API keys:
   - STRIPE_SECRET_KEY
   - STRIPE_PUBLISHABLE_KEY

3. Set them in .env:

   Backend:
   STRIPE_SECRET_KEY=sk_test_...

   Frontend:
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

4. Create products and prices in the Stripe Dashboard for your subscription plans.
   - Copy the price IDs (e.g., price_123...) into your code or configuration layer.

### 8.2. Webhook Setup

For production and local testing, you must configure Stripe webhooks:

1. In the Stripe Dashboard, create a Webhook endpoint:

   - URL (example): https://your-backend-domain.com/webhooks/stripe
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`, etc.

2. Copy the Signing Secret:
   - STRIPE_WEBHOOK_SECRET=whsec_...

3. For local development, use the Stripe CLI:

   - Install: https://stripe.com/docs/stripe-cli
   - Log in: stripe login
   - Forward events:

     stripe listen --forward-to localhost:4000/webhooks/stripe

   Stripe CLI will print a signing secret; set this as STRIPE_WEBHOOK_SECRET in your backend .env.

### 8.3. Backend Stripe Handlers

The backend exposes routes such as:

- POST /billing/create-checkout-session
- POST /webhooks/stripe

These routes:

- Create a checkout session for the selected price
- Handle incoming webhook events to:
  - Mark subscriptions as active/canceled in the database
  - Synchronize customer and subscription info

Ensure that:

- The webhook route uses the raw request body and verifies the Stripe signature.
- You do NOT log full card data or other sensitive information.

---

## 9. Email Setup

This project supports transactional email via SMTP (Nodemailer) or a provider SDK (e.g., SendGrid, Postmark, AWS SES). The default example uses SMTP.

### 9.1. SMTP Configuration

In backend/.env:

- EMAIL_FROM="Your App <no-reply@yourapp.com>"
- EMAIL_SMTP_HOST=smtp.yourprovider.com
- EMAIL_SMTP_PORT=587
- EMAIL_SMTP_USER=your_smtp_user
- EMAIL_SMTP_PASSWORD=your_smtp_password
- EMAIL_SECURE=false

Choose values according to your email provider’s documentation.

### 9.2. Email Usage

Common email flows:

- Welcome email on user signup
- Password reset link
- Billing notifications (receipt, subscription updates)

Ensure that:

- The "from" address is authorized/sender-verified by your provider.
- Your app uses a branded, accessible email template.
- You respect regional anti-spam regulations (e.g., CAN-SPAM, GDPR).

In development, you may:

- Use Mailtrap or similar sandbox SMTP.
- Log email bodies to the console for debugging.

---

## 10. Scripts

Scripts are defined in the package.json files. The actual names may vary; adjust the following to your setup.

### 10.1 Backend Scripts (package.json in /backend)

Common scripts:

- "dev": Start backend in watch mode (e