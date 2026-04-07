# SaaS MVP Starter – README

This repository contains a minimal but production-ready SaaS MVP starter, including:

- TypeScript Node.js/Express backend (REST API)
- React SPA frontend
- PostgreSQL database + migrations & seeds
- Stripe integration (subscriptions, webhooks)
- Basic auth/session handling
- Environment-based configuration

Use this as a base to quickly prototype or launch a small SaaS.

---

## 1. Prerequisites

Before running the app, make sure you have:

- Node.js (LTS, v18+ recommended)
- npm or yarn (examples use npm)
- PostgreSQL 13+ (local or hosted)
- Stripe account and API keys
- Git (optional but recommended)

---

## 2. Environment Setup

There are two main apps:

- `server/` – backend API
- `client/` – frontend SPA

Each has its own environment variables. Copy the example files and fill in your values.

### 2.1 Backend environment

From the repo root:

1. Copy the example env file:

   cp server/.env.example server/.env

2. Edit `server/.env` and configure:

   - APP
     - NODE_ENV=development
     - PORT=4000              (or any free port)
     - FRONTEND_URL=http://localhost:5173
     - BACKEND_URL=http://localhost:4000
   - DATABASE
     - DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB_NAME
   - AUTH / SECURITY
     - SESSION_SECRET=replace-with-a-long-random-string
     - JWT_SECRET=replace-with-a-long-random-string
   - STRIPE
     - STRIPE_SECRET_KEY=sk_test_...
     - STRIPE_PUBLISHABLE_KEY=pk_test_...
     - STRIPE_WEBHOOK_SECRET=whsec_...       (from Stripe CLI or Dashboard)
     - STRIPE_PRICE_ID=price_...             (subscription price ID)
   - OTHER (optional)
     - LOG_LEVEL=info

Make sure DATABASE_URL points to a database that exists and is reachable.

### 2.2 Frontend environment

From the repo root:

1. Copy the example env file:

   cp client/.env.example client/.env

2. Edit `client/.env` and configure:

   - VITE_API_BASE_URL=http://localhost:4000
   - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

These values must be consistent with the backend configuration.

---

## 3. Install Dependencies

From the repo root, install dependencies for both server and client.

### 3.1 Backend dependencies

cd server
npm install

### 3.2 Frontend dependencies

cd ../client
npm install

---

## 4. Database Setup

The backend uses PostgreSQL with migrations and seeds.

### 4.1 Create database

Using psql or a GUI, create an empty database that matches the name in `DATABASE_URL`. Example:

createdb saas_mvp

Or via `psql`:

psql -U postgres -c "CREATE DATABASE saas_mvp;"

### 4.2 Run migrations

From `server/`:

cd server
npm run migrate

This will create all necessary tables (users, sessions, subscriptions, etc.).

### 4.3 Seed initial data

From `server/`:

npm run seed

The seed script typically:

- Inserts a test user or admin (credentials will be logged or documented in /server/SEED_NOTES if applicable)
- Inserts basic subscription/product metadata if required by the app

If you prefer not to seed demo data, you can skip this step, but make sure you create at least one user and product/plan through other means.

---

## 5. Stripe Webhook Setup

Stripe webhooks are required so the backend can react to subscription events (e.g., invoices paid, canceled, trial ending).

### 5.1 Start backend in dev mode

From `server/`:

npm run dev

Assuming the backend listens on `http://localhost:4000`.

### 5.2 Configure Stripe CLI (recommended for local dev)

1. Install Stripe CLI:

   https://stripe.com/docs/stripe-cli

2. Log in:

   stripe login

3. Forward webhooks to your local API:

   stripe listen --forward-to http://localhost:4000/webhooks/stripe

4. When Stripe CLI starts, it will output a webhook signing secret like:

   Webhook signing secret: whsec_xxx

5. Set `STRIPE_WEBHOOK_SECRET` in `server/.env` to that value, then restart the backend:

   npm run dev

Now any Stripe event sent via CLI will be forwarded to your backend’s `/webhooks/stripe` endpoint with proper signature verification.

### 5.3 Dashboard-based webhooks (for staging/production)

In the Stripe Dashboard:

- Go to Developers -> Webhooks
- Add a new endpoint
- Set the URL to: https://YOUR_BACKEND_URL/webhooks/stripe
- Select events like:
  - checkout.session.completed
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
- Copy the signing secret from the endpoint configuration and set `STRIPE_WEBHOOK_SECRET` in the production `.env`.

---

## 6. Running the Apps

### 6.1 Start backend (API)

From `server/`:

npm run dev

This starts a development server (usually on `http://localhost:4000`).

For a production-like build:

npm run build
npm run start

### 6.2 Start frontend (SPA)

From `client/`:

npm run dev

This starts the frontend dev server (typically Vite) on `http://localhost:5173` (or the port configured there).

Open your browser at:

http://localhost:5173

You should see the app’s landing page or login screen.

---

## 7. High-Level Architecture

### 7.1 Overview

- Client:
  - React + TypeScript SPA
  - Vite-based dev/build pipeline
  - Communicates with the backend over JSON REST APIs
  - Uses Stripe.js and Stripe Checkout / Customer Portal where applicable

- Server:
  - Node.js + TypeScript + Express (or similar framework)
  - REST endpoints for auth, subscriptions, and application data
  - JWT or session-based authentication (cookie or Authorization header)
  - Stripe SDK for customer, subscription, and billing management
  - PostgreSQL database via a query builder/ORM (e.g., Prisma/Knex/TypeORM) with migrations and seeds
  - Centralized error handling and logging

- Database:
  - PostgreSQL
  - Core tables:
    - users
    - sessions (if using server-side sessions)
    - subscriptions
    - products/plans (if persisted locally)
    - misc domain tables for your app’s features

- Stripe:
  - Used for:
    - Creating customers for each user
    - Creating Checkout Sessions
    - Managing subscriptions and payment methods
    - Receiving webhook events to sync subscription state

### 7.2 Typical request flow

1. User loads frontend at `VITE_FRONTEND_URL`.
2. User signs up or logs in.
3. Frontend stores auth token (cookie/local storage) and sends it on each API call.
4. For billing actions (e.g., “Upgrade plan”), frontend calls backend:
   - Backend creates Stripe Checkout Session.
   - Frontend redirects to Stripe-hosted checkout.
5. Stripe processes payment and emits webhooks:
   - Backend receives at `/webhooks/stripe`.
   - Backend updates subscription tables in PostgreSQL.
6. Frontend polls or fetches subscription status via API endpoints.

---

## 8. Key API Endpoints

(Exact paths may differ slightly depending on implementation; adjust to your codebase.)

### 8.1 Auth

- POST /auth/register
  - Body: { email, password, name? }
  - Creates new user, hashes password, optionally creates Stripe customer.
  - Returns auth token + user data.

- POST /auth/login
  - Body: { email, password }
  - Verifies credentials.
  - Returns auth token + user data.

- POST /auth/logout
  - Invalidates current session/token (depending on implementation).

- GET /auth/me
  - Requires auth.
  - Returns current user profile and subscription status summary.

### 8.2 Subscription / Billing

- POST /billing/checkout-session
  - Requires auth.
  - Body: { priceId?: string } (or uses default from env STRIPE_PRICE_ID)
  - Creates Stripe Checkout Session for new/updated subscription.
  - Returns: { url } to redirect to Stripe Checkout.

- GET /billing/portal
  - Requires auth.
  - Creates a Stripe Billing Portal session for the logged-in user.
  - Returns: { url } to manage subscription and billing details on Stripe.

- GET /billing/subscription
  - Requires auth.
  - Returns subscription details for the current user from DB/Stripe.

### 8.3 Webhooks

- POST /webhooks/stripe
  - Stripe sends events here.
  - Verifies signature using STRIPE_WEBHOOK_SECRET.
  - Handles events like:
    - checkout.session.completed
    - customer.subscription.created / updated / deleted
    - invoice.payment_succeeded / failed
  - Updates local subscription and user state in PostgreSQL.

### 8.4 Example domain endpoints

You will likely have