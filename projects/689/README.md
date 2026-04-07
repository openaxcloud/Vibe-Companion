# Project Name

Subscription Billing Service with Stripe Webhooks

## Overview

This project is a backend service built to manage subscriptions and handle billing events using Stripe. It exposes a REST API for subscription management, synchronizes billing-related events via Stripe webhooks, and persists subscription data in a database.

Core features:
- Create and manage customers and subscriptions
- Handle recurring payments through Stripe
- Process Stripe webhook events (e.g., invoice creation, payment success/failure, subscription updates)
- Maintain a local record of subscriptions and invoices
- Provide clear scripts to run and develop the service
- Configuration-driven environment setup

This README documents how to:
- Set up your environment
- Install and run the project
- Configure Stripe webhooks
- Understand the high-level architecture

---

## Tech Stack

- Language: TypeScript (Node.js)
- Runtime: Node.js (LTS)
- Framework: Express (or similar HTTP framework)
- Database: PostgreSQL (or another SQL DB, configurable)
- ORM: Prisma (or other ORM if applicable)
- Payments: Stripe
- Build: TypeScript compiler (tsc)
- Testing: Jest (or chosen test framework)
- Tooling: dotenv, nodemon (for development)

---

## Prerequisites

Before you start, ensure you have:

- Node.js (LTS version, e.g., 18.x or later)
- npm or yarn (latest stable)
- PostgreSQL (or your configured database) running locally or accessible remotely
- A Stripe account:
  - Test API keys (Secret and Publishable)
  - Ability to configure webhook endpoints (Stripe Dashboard or Stripe CLI)
- Git (optional but recommended)

---

## Environment Setup

1. Clone the repository

   git clone https://github.com/your-org/your-repo.git
   cd your-repo

2. Install dependencies

   Using npm:
   npm install

   Or using yarn:
   yarn install

3. Create environment file

   Copy the example environment file if present:
   cp .env.example .env

   If .env.example is not present, create a new .env file at the root of the project and define at least the following variables (update with your real values):

   NODE_ENV=development
   PORT=3000

   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public

   STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX
   STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

   # Optional, for logging and telemetry
   LOG_LEVEL=info

4. Database setup

   Ensure your PostgreSQL database is created and running.

   If using Prisma:
   - Run migrations:
     npx prisma migrate dev

   If using another ORM:
   - Run the corresponding migration or schema sync command according to your chosen ORM’s documentation.

---

## Available Scripts

All commands below assume npm. If you use yarn, replace `npm run` with `yarn`.

1. Install dependencies

   npm install

2. Build the project (TypeScript → JavaScript)

   npm run build

   This will compile TypeScript from `src/` into `dist/` (or your configured build directory).

3. Start the server (production mode)

   npm run start

   Typically runs:
   node dist/index.js

4. Start the server in development mode (with auto-reload)

   npm run dev

   Typically runs something like:
   nodemon --watch src --exec ts-node src/index.ts
   or
   ts-node-dev --respawn src/index.ts

5. Run tests

   npm test

   or

   npm run test:watch  (if configured for watch mode)

6. Lint and format (if configured)

   npm run lint
   npm run format

---

## Running the Service

After environment configuration and installation:

1. Ensure the database is running and migrations have been applied.
2. Start the server in development mode:

   npm run dev

   The server will typically start on:
   http://localhost:3000

3. For production-like testing, use:

   npm run build
   npm run start

---

## Configuration Details

The app reads configuration from environment variables (via dotenv in development). Key variables include:

- NODE_ENV
  - development | test | production

- PORT
  - The HTTP port the server listens on (default: 3000)

- DATABASE_URL
  - Connection string to your PostgreSQL (or chosen DB)

- STRIPE_SECRET_KEY
  - Your Stripe secret API key used for all backend Stripe operations

- STRIPE_WEBHOOK_SECRET
  - The signing secret used to verify incoming webhook events
  - Retrieved from the Stripe Dashboard or via the Stripe CLI

- STRIPE_PUBLISHABLE_KEY
  - Your Stripe publishable key (mainly for frontend usage, but sometimes exposed through a config endpoint)

- LOG_LEVEL
  - Logging verbosity level (e.g., debug, info, warn, error)

Update these variables in your .env (and production secrets manager) as needed.

---

## API Overview

The service generally exposes endpoints similar to:

- Healthcheck
  - GET /health
  - Returns basic status information to verify the service is running

- Customers
  - POST /customers
    - Creates a customer in Stripe and in the local database
  - GET /customers/:id
    - Retrieves a customer by internal ID

- Subscriptions
  - POST /subscriptions
    - Creates a subscription for a customer given a plan/price ID
  - GET /subscriptions/:id
    - Retrieves subscription details
  - PATCH /subscriptions/:id
    - Updates subscription (e.g., change plan, cancel, resume)

- Webhooks
  - POST /webhooks/stripe
    - Receives and processes events from Stripe (invoices, payments, subscription updates, etc.)

The exact routes, payloads, and response structures depend on the implementation in `src/routes` or equivalent.

---

## Stripe Webhook Configuration

Stripe webhooks enable the service to stay in sync with Stripe events (e.g., payments, invoices, subscription lifecycle changes). Proper configuration is critical for correct behavior.

### 1. Exposed Webhook Endpoint

By default (and unless changed in your code), the webhook listener is:

POST /webhooks/stripe

If the server runs on localhost:3000, the full URL is:

http://localhost:3000/webhooks/stripe

In production, this might be:

https://your-domain.com/webhooks/stripe

### 2. Requirements for the Webhook Route

To verify Stripe events, the webhook route must:

- Receive the raw request body (unmodified) so Stripe’s signature can be verified
- Use the `STRIPE_WEBHOOK_SECRET` environment variable
- Use Stripe’s official library to construct and verify the event

Typical middleware requirements:

- Do NOT use generic JSON body parsers on the webhook route unless they support raw body.
- Configure an express raw body parser for `application/json` specifically on this route, or globally in a way that preserves the raw body for this endpoint.

If you run into signature verification errors, check:
- Raw body handling
- Correct STRIPE_WEBHOOK_SECRET value
- Matching endpoint in Stripe Dashboard with correct URL

### 3. Obtaining the Webhook Signing Secret

You can get the webhook secret in two ways:

A. Stripe Dashboard (production or staging)
- Go to Developers → Webhooks
- Click “Add an endpoint”
- Enter your webhook URL (e.g., https://your-domain.com/webhooks/stripe)
- Select the events you want to subscribe to (see below)
- Once created, Stripe will show a “Signing secret” (starts with `whsec_...`)
- Copy that value into your `.env` as STRIPE_WEBHOOK_SECRET

B. Stripe CLI (local development)
- Install the Stripe CLI
- Log in: `stripe login`
- Forward webhooks to your local server (assumes your backend is on port 3000):

  stripe listen --forward-to localhost:3000/webhooks/stripe

- The CLI will print a webhook signing secret similar to:

  Webhook signing secret: whsec_XXXXXXXXXXXXXXXXXX

- Copy that secret into `.env`:

  STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXX

### 4. Recommended Events to Subscribe To

At minimum, for subscription lifecycle management:

- customer.created
- customer.updated
- customer.deleted

- subscription-related events (Stripe naming may vary by version; often subscription.* or customer.subscription.*)
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted

- invoice-related events
  - invoice.created
  - invoice.paid
  - invoice.payment_failed
  - invoice.finalized

- payment-related events
  - payment_intent.succeeded
  - payment_intent.payment_failed

Check your implementation’s event handlers to confirm which events are used. You can safely subscribe to a broad set of relevant events; unused events will be logged or ignored, depending on your code.

### 5. Local Development Workflow with Stripe

1. Start your backend API:

   npm run dev

2. In another terminal, start the Stripe CLI webhook forwarding:

   stripe listen --forward-to localhost:3000/webhooks/stripe

3. Use Stripe CLI commands or the Stripe Dashboard to trigger test events, e.g.:

   stripe trigger payment_intent.succeeded
   stripe trigger invoice.paid
   stripe trigger customer.subscription.created

4. Watch your backend logs to