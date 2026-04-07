# Full-Stack App – README

This document explains how to set up, configure, and run the full-stack application in development. It covers environment variables for both server and client, database seeding, Stripe configuration, and common commands.

==================================================
1. Project Overview
==================================================

This repository contains:

- Server
  - Node.js / TypeScript backend
  - REST / GraphQL APIs (depending on your actual implementation)
  - Database integration (PostgreSQL or another SQL/NoSQL database)
  - Stripe integration for payments
- Client
  - React (or another modern framework) SPA
  - Communicates with the server via HTTP / WebSocket APIs
  - Uses environment variables for API base URLs and public Stripe keys

The project is structured so that server and client can be developed independently, but share a common development workflow.

Typical structure (may vary slightly):

- /server
  - src/
  - prisma/ or migrations/
  - package.json
  - tsconfig.json
  - .env (not committed)
- /client
  - src/
  - public/
  - package.json
  - .env (not committed)
- package.json (optional monorepo tooling)
- README.md (this file)

==================================================
2. Prerequisites
==================================================

Before you start, ensure you have:

- Node.js (LTS recommended, e.g., 18.x or 20.x)
- npm, pnpm, or yarn (examples below use npm)
- A running database instance (commonly PostgreSQL)
- A Stripe account and API keys
- Git (optional but recommended)

Check your Node and npm versions:

- node -v
- npm -v

If using PostgreSQL locally, confirm it is running and that you know:

- Host (e.g., localhost)
- Port (e.g., 5432)
- Database name
- Username
- Password

==================================================
3. Repository Setup
==================================================

Clone the repository:

- git clone https://github.com/your-org/your-repo.git
- cd your-repo

Install dependencies for both server and client:

If the repo uses separate package.json files:

- cd server
- npm install
- cd ../client
- npm install

If the repo has a root-level package.json with scripts to bootstrap, use that instead (for example):

- npm install
- npm run bootstrap

Refer to the root package.json and each subproject’s package.json to confirm which approach your project uses.

==================================================
4. Environment Variables
==================================================

Both server and client rely on environment variables for configuration. You must create the appropriate .env files before running the app.

-----------------------------------------------
4.1 Server Environment (.env in /server)
-----------------------------------------------

Create /server/.env (never commit this file to version control). At a minimum, configure:

- NODE_ENV
  - NODE_ENV=development

- Server configuration
  - PORT=4000                            # Or any desired port
  - HOST=0.0.0.0                         # Optional, for binding

- Database configuration (example for PostgreSQL)
  - DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public

- JWT / Auth secrets (if applicable)
  - JWT_SECRET=replace_with_a_long_random_string
  - REFRESH_TOKEN_SECRET=replace_with_another_random_string

- Stripe secrets
  - STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX
  - STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX
  - STRIPE_PRICE_ID=price_XXXXXXXXXXXXXXXXXXXXXXXX      # If using a specific price

- Other optional flags
  - LOG_LEVEL=info
  - CORS_ORIGIN=http://localhost:3000

Adjust names to match your actual codebase if they differ. The important part is that the server has access to:

- Database URL
- Stripe secret key (and webhook secret if used)
- Any auth-related secrets
- Origin / CORS configuration
- Port and host details

-----------------------------------------------
4.2 Client Environment (.env in /client)
-----------------------------------------------

Create /client/.env (also not committed). Typical variables:

- VITE_API_BASE_URL=http://localhost:4000
  or
- REACT_APP_API_BASE_URL=http://localhost:4000

(depending on whether you use Vite or Create React App – use the correct prefix required by your bundler)

- Public Stripe key
  - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
  or
  - REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

Additional possible settings:

- VITE_ENV=development
- VITE_ENABLE_MOCKS=false

Make sure that:

- All variables required by the client code are defined with the correct prefix (VITE_ for Vite, REACT_APP_ for CRA).
- The API base URL points to your running server’s URL and port.

==================================================
5. Stripe Configuration
==================================================

To use Stripe in development:

1. Create or log into your Stripe account:
   - https://dashboard.stripe.com/

2. Obtain your test keys (found in the Stripe dashboard under “Developers” → “API keys”):
   - Publishable key (starts with pk_test_)
   - Secret key (starts with sk_test_)

3. Set them in your environment files:

   On the server (.env in /server):
   - STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX

   On the client (.env in /client):
   - VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX
   or
   - REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

4. If your server handles Stripe webhooks, you must configure them:

   - Install the Stripe CLI locally:
     - https://stripe.com/docs/stripe-cli

   - Log in and forward webhooks to your server:
     - stripe login
     - stripe listen --forward-to localhost:4000/webhooks/stripe
       (replace with your actual webhook route)

   - Stripe CLI will output a webhook signing secret (starts with whsec_...). Put it into:
     - STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX

5. Ensure that your backend code reads STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET from the environment and initializes Stripe accordingly.

==================================================
6. Database Setup and Seeding
==================================================

The project uses a database (commonly PostgreSQL). Follow these steps to get a working schema and seed data.

-----------------------------------------------
6.1 Create the Database
-----------------------------------------------

1. Create a database in your local DB server (example with PostgreSQL):

   - psql -U your_user -h localhost -c "CREATE DATABASE your_db_name;"

2. Update DATABASE_URL in /server/.env accordingly, for example:

   - DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_db_name?schema=public

-----------------------------------------------
6.2 Run Migrations
-----------------------------------------------

Make sure you are in the /server directory:

- cd server

If using Prisma:

- npx prisma migrate dev

If using another migration tool (Knex, TypeORM, etc.), run the corresponding migration command, for example:

- npm run migrate

Check package.json in /server to confirm the exact script name. Common patterns:

- npm run migrate
- npm run db:migrate

-----------------------------------------------
6.3 Seed the Database
-----------------------------------------------

Still in the /server directory, run the seed script:

- npm run seed

If using Prisma:

- npx prisma db seed
  or
- npm run db:seed

Check /server/package.json for the correct command. Typical examples:

- "scripts": {
    "db:seed": "ts-node prisma/seed.ts",
    "seed": "npm run db:seed"
  }

After seeding, your database should contain initial data (e.g., test users, products, plans, etc.) that the app expects in development.

==================================================
7. Running the Development Servers
==================================================

You usually run the server and client development servers concurrently. Follow the steps below.

-----------------------------------------------
7.1 Quick Start – Root-Level Commands (If Available)
-----------------------------------------------

If the repository provides root-level scripts to run both server and client:

From the project root:

- npm install                 # If not already done
- npm run dev                 # Or npm run start:dev, npm run start:all, etc.

Examples (may vary; check root package.json):

- npm run dev           → starts server and client
- npm run dev:server    → starts only the backend
- npm run dev:client    → starts only the frontend

If no root-level scripts are present, run them in separate terminals as described below.

-----------------------------------------------
7.2 Running the Server Only
-----------------------------------------------

From the /server directory:

1. Install dependencies (if not already):

   - cd server
   - npm install

2. Ensure .env is configured and migrations/seed have been run.

3. Start the server in development mode:

   - npm run dev
     or
   - npm run start:dev
     or
   - npm start

Check package.json in /server for the exact script. Typical definitions:

- "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc"
  }

By default, the server typically runs at:

- http://localhost:4000

(or whatever port you set in PORT