# Jira-like Project Management MVP

This repository contains a minimal but production-ready Jira-like project management application. It focuses on core issue tracking and agile project workflows while remaining small enough to understand and extend.

The app is designed as a modern full‑stack TypeScript project with a performant API, a responsive frontend, and a robust database layer.

---

## Features

- Projects with basic metadata
- Issues (tasks, bugs, stories, epics) with:
  - Title, description, status, priority, type
  - Assignee, reporter, project association
  - Story points, estimate, due date
- Kanban-style board (Backlog / Todo / In Progress / Done)
- Basic user management (registration, login, JWT-based auth)
- Simple role-based access control (admin, member, viewer)
- Activity tracking (created/updated timestamps)
- Commenting on issues
- Tagging/labels
- Pagination and filtering for issues

The MVP intentionally omits advanced features (sprints, complex workflows, custom fields, etc.) but is structured to allow easy extension.

---

## Architecture Overview

The application is organized as a monorepo-style structure with a clear separation between frontend, backend, and shared code.

Top-level layout (conceptual):

- /apps
  - /web        → Next.js frontend (React, TypeScript)
  - /api        → Node.js backend (Express/Fastify + TypeScript)
- /packages
  - /db         → Prisma schema, migrations, DB client
  - /shared     → Shared types, utility functions, validation schemas

Core layers:

1. Frontend (apps/web)
   - Next.js 14 with the App Router
   - React 18 for UI
   - TypeScript throughout
   - Tailwind CSS and/or component library for styling
   - Data fetching via REST or tRPC-like abstractions
   - State management: React Query (TanStack Query) for server state, minimal local state only
   - Authentication via HTTP-only cookies or Authorization headers

2. Backend (apps/api)
   - Node.js (LTS)
   - Fastify or Express for HTTP server
   - TypeScript with strict mode
   - RESTful API endpoints for:
     - Auth (login, register, refresh token, logout)
     - Users
     - Projects
     - Issues
     - Comments
     - Labels
   - Zod (or similar) for request/response validation
   - JWT-based authentication
   - Role-based authorization middleware

3. Database Layer (packages/db)
   - PostgreSQL as the primary database
   - Prisma ORM for schema, migrations, and type-safe queries
   - Seed scripts for demo data (users, projects, issues, labels)

4. Shared Package (packages/shared)
   - Domain models / DTO types
   - Validation schemas (Zod)
   - Shared enums/constants (issue status, priority, type, roles)
   - Utility functions used by both frontend and backend

---

## Tech Stack

- Language: TypeScript
- Runtime: Node.js (LTS)
- Frontend:
  - Next.js 14 (App Router)
  - React 18
  - Tailwind CSS
  - TanStack Query (React Query)
- Backend:
  - Fastify (or Express) + TypeScript
  - Zod for input/output validation
  - JSON Web Tokens (JWT) + HTTP-only cookies (optional)
- Database:
  - PostgreSQL
  - Prisma ORM
- Tooling:
  - pnpm or yarn or npm (choose one; examples will assume pnpm)
  - ESLint + Prettier
  - Jest / Vitest for tests
  - dotenv for environment variables
  - Turborepo or simple npm scripts for running multiple apps

---

## Prerequisites

Before running the project locally, ensure you have:

- Node.js (LTS, e.g. ≥ 18.x)
- pnpm (recommended) or yarn / npm
- PostgreSQL (≥ 13) accessible locally or remotely
- Git

You will also need to configure environment variables (see below).

---

## Getting Started

### 1. Clone the repository

git clone https://github.com/your-org/jira-mvp.git
cd jira-mvp

### 2. Install dependencies

Using pnpm:

pnpm install

or with npm:

npm install

or with yarn:

yarn install

---

## Environment Configuration

The application is configured via environment variables. There are separate env files for the root, frontend, and backend if needed.

Typical files:

- .env                → Root-level (optional, shared variables)
- apps/api/.env       → Backend-specific variables
- apps/web/.env.local → Frontend-specific variables

You can use the sample templates as a starting point:

- .env.example
- apps/api/.env.example
- apps/web/.env.local.example

Copy these to actual files and fill in values:

cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

### Required Environment Variables

Backend (apps/api/.env)

- NODE_ENV="development" | "production" | "test"
- PORT=4000
- DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"
- JWT_ACCESS_SECRET="your-access-token-secret"
- JWT_REFRESH_SECRET="your-refresh-token-secret"
- JWT_ACCESS_EXPIRES_IN="15m"
- JWT_REFRESH_EXPIRES_IN="7d"
- CORS_ORIGIN="http://localhost:3000"
- LOG_LEVEL="info" | "debug" | "error"
- BCRYPT_SALT_ROUNDS=10

Frontend (apps/web/.env.local)

- NEXT_PUBLIC_API_BASE_URL="http://localhost:4000"
- NEXT_PUBLIC_APP_NAME="Jira MVP"
- NEXT_PUBLIC_DEFAULT_PAGE_SIZE=20

Root (optional .env)

- SHARED_SOME_CONFIG=value

Adjust these values as needed for your local and production environments.

---

## Database Setup

This project uses Prisma with PostgreSQL.

### 1. Create the Database

Ensure PostgreSQL is running and create a database, for example:

- Database name: jira_mvp
- User: jira_user
- Password: yourpassword

Update DATABASE_URL in apps/api/.env accordingly, for example:

DATABASE_URL="postgresql://jira_user:yourpassword@localhost:5432/jira_mvp?schema=public"

### 2. Run Prisma Migrations

From the repository root:

pnpm prisma:migrate

If not using pnpm, check package.json for equivalent scripts, e.g.:

npm run prisma:migrate
or
yarn prisma:migrate

This script typically runs:

prisma migrate deploy

or

prisma migrate dev

depending on configuration. See package.json for details.

### 3. Seed the Database

Run the seed script to populate demo data:

pnpm prisma:seed

or

npm run prisma:seed
yarn prisma:seed

The seed will create:

- A few demo users (including an admin)
- Sample projects
- Example issues with labels and comments

After seeding, you can log in using one of the demo users (documented in seed script or .env.example comments).

---

## Running the Application in Development

The project can be run using a combined dev script or per-app dev servers.

### 1. Start Backend Dev Server

From the repository root:

pnpm dev:api

Common behavior:

- Starts Fastify/Express server on PORT (default: 4000)
- Watches for changes and restarts automatically (e.g. using ts-node-dev / nodemon)

If using npm/yarn, see package.json for equivalent:

npm run dev:api
yarn dev:api

API base URL (by default):

http://localhost:4000

### 2. Start Frontend Dev Server

In a separate terminal, from the repository root:

pnpm dev:web

or:

npm run dev:web
yarn dev:web

This starts the Next.js dev server on (by default):

http://localhost:3000

### 3. All-in-One Dev Command (optional)

If configured (using turborepo or npm-run-all), you can run:

pnpm dev

which concurrently starts both the API and Web apps.

Check package.json for the exact command configuration.

---

## Building for Production

In production, you will want to build both the backend and frontend and then run them with Node.js.

### 1. Build All

From the repository root:

pnpm build

This usually runs:

- pnpm build:api
- pnpm build:web

Backend build (apps/api):

- Transpiles TypeScript to JavaScript (e.g. to dist folder)
- Prepares for Node.js execution

Frontend build (apps/web):

- Runs next build
- Optimizes and bundles React app

### 2. Run Database Migrations in Production

Before starting the app in a new environment, ensure the database schema is up to date:

pnpm prisma:migrate

Make sure DATABASE_URL in apps/api/.env is set for the production database.

Optionally run seed in a staging environment (you may skip seed in production):

pnpm prisma:seed

### 3. Start Backend in Production

Assuming the build output is in apps/api/dist:

pnpm start:api

or:

npm run start:api
yarn start:api

This typically executes:

node dist/index.js

Ensure the correct PORT and environment variables are set on the host