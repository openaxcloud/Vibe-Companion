# Backend Service README

This document describes the backend service, its API, configuration, and how to run it in development and production.

The backend exposes a RESTful JSON API for:

- User registration, authentication, and profile management
- Subscription management and Stripe-based billing
- Protected resources using JWT-based authentication
- Email-based flows (verification, password reset, notifications)
- Basic health and status checks

---

## Table of Contents

1. Overview
2. Tech Stack
3. Getting Started
4. Environment Variables
5. Database & Migrations
6. Running the Server
7. API Overview
   - Authentication
   - Users
   - Subscriptions & Billing
   - Health & Status
8. Error Handling
9. Logging
10. Security Considerations
11. Common Development Tasks

---

## 1. Overview

This backend is responsible for:

- Managing user accounts and credentials
- Issuing and validating JWT access and refresh tokens
- Orchestrating subscription and payment workflows via Stripe
- Sending transactional emails via a pluggable email provider
- Serving a versioned REST API suitable for a frontend client

All API responses are JSON. Authentication is performed via Bearer tokens in the `Authorization` header.

---

## 2. Tech Stack

- Runtime: Node.js (LTS recommended)
- Language: TypeScript (if applicable) or JavaScript (ES modules / CommonJS)
- Web Framework: Express (or similar HTTP framework)
- Database: PostgreSQL
- ORM / Query Builder: Prisma / TypeORM / Knex (depending on implementation)
- Auth: JWT (JSON Web Tokens)
- Payments: Stripe
- Email: Pluggable provider (e.g. SendGrid, Postmark, SES, SMTP)

---

## 3. Getting Started

1. Clone the repository

   git clone <REPO_URL>
   cd backend

2. Install dependencies

   npm install
   or
   yarn install
   or
   pnpm install

3. Create an environment file

   - Copy `.env.example` to `.env`
   - Fill in the required values (see "Environment Variables")

4. Ensure you have a PostgreSQL database available and reachable from your environment.

5. Run database migrations

   See "Database & Migrations" below.

6. Start the server

   See "Running the Server" below.

---

## 4. Environment Variables

The backend is configured via environment variables. Typically, you will have a `.env` file for local development and use your platform’s configuration mechanism for staging/production.

Below is a reference list of key environment variables.

Application

- NODE_ENV
  - Description: Current environment
  - Values: development | test | production
  - Example: NODE_ENV=development

- PORT
  - Description: HTTP port for the backend
  - Default: 3000
  - Example: PORT=3000

- APP_URL
  - Description: Public base URL of the backend (used in emails, redirects)
  - Example: APP_URL=https://api.example.com

Database

- DATABASE_URL
  - Description: Connection string for PostgreSQL
  - Example: DATABASE_URL=postgresql://user:password@localhost:5432/mydb?schema=public

If your ORM or DB library requires additional variables (for example using discrete fields instead of a single URL), you may also have:

- DB_HOST
- DB_PORT
- DB_USER
- DB_PASSWORD
- DB_NAME

JWT

- JWT_ACCESS_SECRET
  - Description: Secret key for signing access tokens
  - Required: Yes (must be a strong, random string)
  - Example: JWT_ACCESS_SECRET=super-long-random-string

- JWT_REFRESH_SECRET
  - Description: Secret key for signing refresh tokens
  - Required: Yes (must be a strong, random string)
  - Example: JWT_REFRESH_SECRET=another-super-long-random-string

- JWT_ACCESS_EXPIRES_IN
  - Description: Access token TTL
  - Example: JWT_ACCESS_EXPIRES_IN=15m

- JWT_REFRESH_EXPIRES_IN
  - Description: Refresh token TTL
  - Example: JWT_REFRESH_EXPIRES_IN=30d

Stripe

- STRIPE_SECRET_KEY
  - Description: Stripe secret API key
  - Required: Yes for billing features
  - Example: STRIPE_SECRET_KEY=sk_test_...

- STRIPE_WEBHOOK_SECRET
  - Description: Secret used to validate Stripe webhook signatures
  - Required: Yes if Stripe webhooks are enabled
  - Example: STRIPE_WEBHOOK_SECRET=whsec_...

- STRIPE_PRICE_ID
  - Description: Default price ID for subscription plans
  - Example: STRIPE_PRICE_ID=price_12345

Email Provider

Choose exactly one provider configuration, or ensure your code is configured for the provider you use.

Generic (SMTP)

- EMAIL_PROVIDER
  - Description: Identifier for the email provider implementation
  - Example: EMAIL_PROVIDER=smtp

- SMTP_HOST
  - Description: SMTP server hostname
  - Example: SMTP_HOST=smtp.mailgun.org

- SMTP_PORT
  - Description: SMTP port
  - Example: SMTP_PORT=587

- SMTP_SECURE
  - Description: Use TLS/SSL
  - Example: SMTP_SECURE=false

- SMTP_USER
  - Description: SMTP username
  - Example: SMTP_USER=postmaster@example.com

- SMTP_PASSWORD
  - Description: SMTP password
  - Example: SMTP_PASSWORD=super-secret-password

- EMAIL_FROM
  - Description: Default "from" address used in transactional emails
  - Example: EMAIL_FROM="Example App <no-reply@example.com>"

SendGrid (example alternative)

- EMAIL_PROVIDER=sendgrid
- SENDGRID_API_KEY=SG.xxxxxxxx

AWS SES (example alternative)

- EMAIL_PROVIDER=ses
- AWS_ACCESS_KEY_ID=...
- AWS_SECRET_ACCESS_KEY=...
- AWS_REGION=...

Misc

- FRONTEND_URL
  - Description: Public base URL of the frontend application
  - Example: FRONTEND_URL=https://app.example.com

- LOG_LEVEL
  - Description: Logging verbosity
  - Values: error | warn | info | debug
  - Example: LOG_LEVEL=info

---

## 5. Database & Migrations

The backend uses PostgreSQL as its persistent store and a migration tool to manage schema changes.

Configure your database

1. Ensure PostgreSQL is running and accessible.
2. Create a database for the backend.

   For example:

   createdb myapp_dev

3. Update your `DATABASE_URL` (or equivalent individual DB env variables) in `.env` to point to this database.

Running migrations

Depending on the tool used (Prisma, TypeORM, Knex, etc.), the commands may differ. Typical examples:

Prisma

- Generate Prisma client (if needed):

  npx prisma generate

- Run all pending migrations:

  npx prisma migrate deploy

- Create a new migration (development only):

  npx prisma migrate dev --name <migration_name>

TypeORM (CLI-based)

- Run migrations:

  npx typeorm migration:run

- Revert last migration:

  npx typeorm migration:revert

Knex

- Run migrations:

  npx knex migrate:latest

- Rollback:

  npx knex migrate:rollback

Refer to the actual scripts defined in `package.json`. Common patterns:

- npm run db:migrate
- npm run db:migrate:dev
- npm run db:seed

Check the root `package.json` for the exact migration scripts used.

---

## 6. Running the Server

Development

1. Ensure `.env` is configured.
2. Run migrations as needed.
3. Start the development server (with hot reload if supported):

   npm run dev
   or
   yarn dev

The server will typically start on `http://localhost:3000` (or the port defined in `PORT`).

Production

1. Ensure all environment variables are set (especially database, JWT, Stripe, email).
2. Run `npm run build` (if TypeScript or bundling is used).
3. Run migrations against the production database.
4. Start the server:

   npm start
   or
   node dist/server.js
   (depending on your build setup)

---

## 7. API Overview

All endpoints are versioned under `/api/v1` (unless configured differently). The exact paths may vary, but the following describes the typical structure.

Base URL

- Local: http://localhost:<PORT>/api/v1
- Production: https://api.example.com/api/v1

Content Type

- All requests and responses use JSON.
- Requests with a body must include:

  Content-Type: application/json

Authentication

- Authenticated endpoints require:

  Authorization: Bearer <access_token>

### 7.1 Authentication Endpoints

Route: POST /api/v1/auth/register

- Description: Create a new user account.
- Request body (example):

  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "name": "Jane Doe"
  }

- Response (example):

  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "Jane Doe"
    },
    "accessToken": "<jwt_token>",
    "refreshToken": "<jwt_refresh_token>"
  }

Route: POST /api/v1/auth/login

- Description: Authenticate an existing user.
- Request body:

  {
    "