# SaaS App Starter – Monorepo

A production-ready SaaS starter kit with a TypeScript/Node.js backend, React frontend, PostgreSQL database, and Stripe integration for subscriptions and payments. This repository is structured as a monorepo to keep backend and frontend code organized while sharing common configuration and tooling.

---

## Table of Contents

1. Project Overview  
2. Tech Stack  
3. Monorepo Structure  
4. Prerequisites  
5. Environment Setup  
6. Backend Setup and Commands  
7. Frontend Setup and Commands  
8. Database and Migrations  
9. Stripe Setup  
10. Development Scripts  
11. Testing  
12. Linting and Formatting  
13. Common Issues and Troubleshooting  
14. Deployment Notes  

---

## 1. Project Overview

This project provides a solid foundation for building a production-grade SaaS application with:

- Secure, token-based authentication
- Role-based access control (RBAC)
- Subscription management powered by Stripe
- API backend with REST endpoints
- React-based SPA frontend
- PostgreSQL database with migrations and seed data
- Environment-based configuration (development, staging, production)
- Unified development workflows through a monorepo

The goal is to minimize initial setup overhead and ensure you can focus on domain logic rather than wiring infrastructure.

---

## 2. Tech Stack

### Backend

- Node.js
- TypeScript
- Express (or similar HTTP framework)
- PostgreSQL
- Prisma / Knex / TypeORM (whichever ORM/migration tool you are using)
- JSON Web Tokens (JWT) / session-based auth
- Stripe Node SDK

### Frontend

- React
- TypeScript
- Vite or Create React App (depending on implementation)
- React Router
- Axios / Fetch for API calls
- TailwindCSS / styled-components / CSS Modules (as configured)

### Tooling

- pnpm / npm / yarn (specified below)
- ESLint
- Prettier
- Jest / Vitest / React Testing Library
- dotenv for environment variables

---

## 3. Monorepo Structure

The repository is organized as follows:

- /backend  
  - src/            – Backend TypeScript source code  
  - src/app.ts      – Express app entrypoint (without server listen)  
  - src/server.ts   – HTTP server bootstrap  
  - src/config/     – Configuration, env loader  
  - src/routes/     – Route definitions  
  - src/controllers – Request handlers  
  - src/services/   – Business logic  
  - src/db/         – DB client and migrations  
  - prisma/ or migrations/ – Migration files (if applicable)  
  - package.json  
- /frontend  
  - src/            – React app source  
  - src/main.tsx    – App bootstrap  
  - src/App.tsx     – Main application component  
  - src/pages/      – Page components  
  - src/components/ – Reusable UI components  
  - src/lib/        – API client, utils  
  - vite.config.ts / config files  
  - package.json  
- /scripts  
  - Utility scripts (e.g., database seeding, one-off tasks)  
- package.json (root)  
- pnpm-lock.yaml / package-lock.json / yarn.lock  
- .env.example  
- README.md  

Note: The actual tool names (Vite vs CRA, Prisma vs Knex) depend on this specific codebase. The commands below are written in a generic but compatible way and will be accurate for a typical modern setup.

---

## 4. Prerequisites

Ensure you have the following installed:

- Node.js (LTS; e.g., 18.x or above)
- npm (bundled with Node) or pnpm/yarn if you prefer
- PostgreSQL (local or remote instance)
- Git
- A Stripe account and API keys

Recommended:

- nvm (Node Version Manager) to match the Node version defined in .nvmrc (if present).

---

## 5. Environment Setup

### 5.1. Clone the Repository

git clone https://github.com/your-org/your-saas-starter.git
cd your-saas-starter

### 5.2. Install Dependencies

If using pnpm:

pnpm install

If using npm:

npm install

If using yarn:

yarn install

The root package.json will install dependencies in both backend and frontend workspaces if configured. If not, install separately:

cd backend && npm install
cd ../frontend && npm install

### 5.3. Environment Variables

A template is provided at the root as .env.example (and/or in backend/.env.example and frontend/.env.example).

Copy the example env file(s) and customize:

cp .env.example .env

Or for split env files:

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

Update the variables to match your local environment.

#### Required Backend Environment Variables

These may vary slightly; typical variables include:

NODE_ENV=development
PORT=4000

DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/your_db_name

JWT_SECRET=replace-with-a-long-random-string
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=replace-with-another-random-string
REFRESH_TOKEN_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

APP_URL=http://localhost:5173
API_URL=http://localhost:4000

LOG_LEVEL=info

If using Prisma, DATABASE_URL must match the configured database connection.

#### Required Frontend Environment Variables

VITE_API_URL=http://localhost:4000
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

Depending on the bundler, the variable prefix may differ (e.g., REACT_APP_ for CRA, VITE_ for Vite).

---

## 6. Backend Setup and Commands

Navigate to the backend directory:

cd backend

### 6.1. Install Dependencies (if not installed from root)

npm install
# or
pnpm install
# or
yarn install

### 6.2. Running the Backend in Development

npm run dev
# or
pnpm dev
# or
yarn dev

This typically starts the backend on http://localhost:4000 (or as defined in your env). It uses nodemon or ts-node-dev for hot reloading.

### 6.3. Build the Backend

npm run build
# or
pnpm build
# or
yarn build

This compiles TypeScript into the dist/ directory.

### 6.4. Run the Backend in Production Mode

Ensure you have run the build first, then:

npm run start
# or
pnpm start
# or
yarn start

---

## 7. Frontend Setup and Commands

Navigate to the frontend directory:

cd frontend

### 7.1. Install Dependencies (if not installed from root)

npm install
# or
pnpm install
# or
yarn install

### 7.2. Running the Frontend in Development

npm run dev
# or
pnpm dev
# or
yarn dev

This usually starts the frontend on http://localhost:5173 or http://localhost:3000 depending on config. Open the URL in your browser.

### 7.3. Build the Frontend

npm run build
# or
pnpm build
# or
yarn build

The production-ready build will be generated in dist/ or build/ based on tooling.

### 7.4. Preview Production Build

For Vite:

npm run preview
# or
pnpm preview
# or
yarn preview

---

## 8. Database and Migrations

The project uses PostgreSQL and a migration tool (e.g., Prisma Migrate / Knex / TypeORM). Commands below illustrate common workflows; adjust based on the actual tool.

Make sure your DATABASE_URL is configured correctly in backend/.env before running any commands.

### 8.1. Creating the Database

Using psql or a GUI, create the database:

createdb your_db_name

Or via psql:

psql -c "CREATE DATABASE your_db_name;"

### 8.2. Running Migrations

From the backend directory:

# Prisma example
npx prisma migrate dev --name init

# Knex example
npx knex migrate:latest

# TypeORM example
npm run typeorm migration:run

Check package.json scripts to see which migration tool and script names are defined. Common scripts include:

npm run db:migrate
npm run db:migrate:dev
npm run db:migrate:prod

### 8.3. Rolling Back Migrations

From the backend directory:

# Prisma example
npx prisma migrate reset

# Knex example
npx knex migrate:rollback

# TypeORM example
npm run typeorm migration:revert

Or use the provided script:

npm run db:rollback

### 8.4. Seeding the Database

If the project defines seed scripts, they are usually available as:

npm run db:seed

Commonly this will:

- Insert baseline data (e.g., roles, plans)
- Create an initial admin user
- Populate test records

Confirm the initialization in backend/src/db or scripts/.

---

## 9. Stripe Setup

Stripe is used for subscription and payment processing. You must configure Stripe both in your environment variables and in the dashboard.

### 9.1. Stripe Keys

In your Stripe Dashboard,