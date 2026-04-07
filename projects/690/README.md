# Project README

This document provides high-level instructions for setting up and running the MVP, including installing dependencies, configuring environment variables, running database migrations, starting the API and web applications, and seeding sample data.

The instructions assume basic familiarity with Node.js, npm or yarn, Git, Docker (optional), and a relational database (e.g., PostgreSQL).

---

## 1. Prerequisites

Before you begin, ensure that you have the following installed:

- Node.js (v18 or later recommended)
- npm (v9 or later) or yarn (v1.x / v3.x)
- Git
- PostgreSQL (v13 or later) or compatible DB
- Docker and Docker Compose (optional but recommended for local db)
- A modern web browser (Chrome, Firefox, Safari, Edge)

Confirm versions:

- node -v
- npm -v
- psql --version (if using PostgreSQL)
- docker --version (if using Docker)

---

## 2. Project Structure (High-Level)

The repository is structured as a monorepo with separate API and web applications:

- /api          → Backend API service (Node.js / TypeScript)
- /web          → Frontend web application (React or similar)
- /prisma       → Database schema and migrations (if using Prisma)
- /scripts      → Helper scripts (migrations, seeding, etc.)
- .env          → Root environment variables (optional)
- package.json  → Workspace-level configuration

Note: Exact paths may vary slightly based on the implementation, but the concepts remain the same.

---

## 3. Cloning the Repository

1. Clone the repository:

   git clone https://github.com/your-org/your-repo.git
   cd your-repo

2. Optionally, check out a specific branch or tag:

   git checkout main
   # or
   git checkout mvp-initial

---

## 4. Installing Dependencies

The project is set up to install dependencies for both API and web from the root using workspaces.

From the project root:

Using npm:

- npm install

Using yarn:

- yarn install

This will:

- Install root-level tooling dependencies
- Install API dependencies under /api
- Install web dependencies under /web

If you prefer to install individually:

- cd api && npm install
- cd ../web && npm install

---

## 5. Environment Configuration

The application uses environment variables for database connections, auth secrets, and other configuration. At a minimum, you’ll need:

- API environment variables
- Web environment variables
- (Optional) root-level variables or a shared .env

### 5.1 Root .env (Optional)

Create a .env file at the root if you want to centralize shared values:

- cp .env.example .env

Fill in any shared values used across services. If the project does not provide .env.example at the root, skip this step.

### 5.2 API Environment (.env in /api)

1. Navigate to the API directory:

   cd api

2. Create a local environment file:

   cp .env.example .env

3. Open .env in a text editor and set values similar to:

   NODE_ENV=development
   PORT=4000

   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public

   JWT_SECRET=your-secure-random-secret
   JWT_EXPIRES_IN=1d

   CORS_ORIGIN=http://localhost:3000

   LOG_LEVEL=info

Notes:

- Replace USER, PASSWORD, HOST, PORT, DB_NAME with your actual database details.
- If using Docker, HOST may be db or localhost depending on your compose setup.
- Use a strong JWT_SECRET in production.

### 5.3 Web Environment (.env in /web)

1. Navigate to the web directory:

   cd web

2. Create a local environment file:

   cp .env.example .env

3. Update the variables, for example:

   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   NEXT_PUBLIC_ENV=development

   # Any other public config values used by the web app

Notes:

- NEXT_PUBLIC_* variables (for Next.js) or REACT_APP_* (for CRA) are exposed to the browser.
- Ensure the API base URL matches the API PORT and host.

---

## 6. Database Setup

You can run the database locally (installed directly) or via Docker.

### 6.1 Option A: Local PostgreSQL

1. Create a database:

   psql -U postgres

   CREATE DATABASE your_db_name;
   \q

2. Ensure that DATABASE_URL in /api/.env points to this database.

Example:

- DATABASE_URL=postgresql://postgres:password@localhost:5432/your_db_name?schema=public

3. Confirm connectivity using psql or your preferred GUI tool.

### 6.2 Option B: Docker + Docker Compose

If the repo includes a docker-compose.yml at the root:

1. From the project root, run:

   docker compose up -d
   # or, depending on your Docker version:
   docker-compose up -d

2. Inspect the compose file for:

   - DB service name (e.g., db)
   - Default user/password/db
   - Exposed port (e.g., 5432:5432)

3. Set DATABASE_URL in /api/.env using the Docker service config, e.g.:

   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/your_db_name?schema=public

If the DB host is a container name (like db), you might use:

   DATABASE_URL=postgresql://postgres:postgres@db:5432/your_db_name?schema=public

Note: For tools running on your host machine, use localhost; for services inside Docker, use the container name.

---

## 7. Running Database Migrations

The MVP uses a migration tool (e.g., Prisma Migrate, Knex, or TypeORM). The high-level steps are similar regardless of the tool.

Assuming Prisma is used:

1. Navigate to the API directory:

   cd api

2. Ensure .env is configured and the database exists.

3. Run migrations:

   Using npm:
   - npm run migrate

   Or if defined as a Prisma-specific script:
   - npx prisma migrate dev

This will:

- Apply all pending migrations to the target database
- Generate the client (if Prisma)

If you are using a different tool, use the corresponding script defined in /api/package.json.

Common script names you might see:

- npm run db:migrate
- npm run migrate:dev
- npm run migrate:prod

Check /api/package.json for exact command names.

---

## 8. Seeding Sample Data

The project includes a seed script to populate the database with sample data for local development.

1. After migrations complete, run the seed script:

   cd api

   Using npm:
   - npm run seed

   Using yarn:
   - yarn seed

This typically:

- Creates sample users (e.g., admin, test user)
- Inserts sample domain entities used by the MVP
- Sets up test data for quick UI verification

Check /api/package.json for the actual script name if seed is not available. Common alternatives:

- npm run db:seed
- npm run seed:dev

Note: Running the seed script multiple times may either:

- Be idempotent (safe to run repeatedly), or
- Duplicate data, depending on implementation

If duplicates appear, you may need to:

- Drop and recreate the DB, then rerun migrations and seeding, or
- Use a reset command if available, e.g., npm run db:reset

---

## 9. Starting the API Server

Once dependencies, environment variables, database migrations, and seeding are done, you can start the API.

From the /api directory:

- npm run dev      # for development with hot reload
- npm run start    # for production build (after build step)
- npm run build    # build the production bundle

Typical development steps:

1. cd api
2. npm run dev

By default, the API will listen on the PORT specified in /api/.env (e.g., 4000).

Verify it is running by visiting:

- http://localhost:4000/health  (or a similar health/status endpoint)
- http://localhost:4000/api/... (for actual API routes)

If using a tool like Postman or curl, you can send a simple request:

- curl http://localhost:4000/health

---

## 10. Starting the Web Application

With the API running, start the web app.

From the /web directory:

- npm run dev      # development mode
- npm run build    # production build
- npm run start    # start production server (after build)

Typical development steps:

1. cd web
2. npm run dev

By default:

- Next.js-based app: http://localhost:3000
- CRA/Vite app: usually http://localhost:3000 or http://localhost:5173, depending on dev server config

Ensure that:

- NEXT_PUBLIC_API_BASE_URL (or equivalent) in /web/.env points to the running API (e.g., http://localhost:4000).

Open the app in a browser:

- http://localhost:3000

---

## 11. Running the Full Stack from the Root

If the root package.json defines workspace scripts, you can run both API and web via:

- npm run dev: