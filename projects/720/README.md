# Full-Stack Application – Server & Client

This repository contains a full-stack TypeScript application with a Node.js/Express API (server) and a React (Vite) SPA (client). It is structured as a monorepo to keep the backend and frontend codebases aligned and easy to manage.

---

## Table of Contents

1. Project Structure
2. Tech Stack
3. Requirements
4. Getting Started
   - Clone & Install
   - Environment Configuration
   - Running in Development
5. Available Scripts
   - Root Scripts
   - Server Scripts
   - Client Scripts
6. Environments & Configuration
   - Root
   - Server
   - Client
7. Architecture Overview
   - Server Architecture
   - Client Architecture
   - Data Flow
8. Build & Deployment
9. Testing
10. Coding Standards & Conventions
11. Troubleshooting
12. FAQ

---

## 1. Project Structure

The repository is organized as a simple monorepo with `server` and `client` workspaces:

- / (root)
  - package.json
  - pnpm-lock.yaml / yarn.lock / package-lock.json
  - tsconfig.base.json (optional, if shared TS config is used)
  - .editorconfig
  - .eslintrc.cjs / .eslintrc.js
  - .prettierrc
  - .gitignore
  - /server
    - package.json
    - tsconfig.json
    - src/
      - index.ts (entry point)
      - app.ts (Express app)
      - config/
      - routes/
      - controllers/
      - services/
      - middlewares/
      - models/
      - utils/
      - types/
    - tests/
  - /client
    - package.json
    - tsconfig.json
    - tsconfig.app.json
    - vite.config.ts
    - index.html
    - src/
      - main.tsx
      - App.tsx
      - routes/
      - components/
      - pages/
      - hooks/
      - services/ (API client, data fetching)
      - store/ (state management if used)
      - styles/
      - types/
    - tests/

Some file names or directories may differ slightly depending on exact implementation, but the high-level separation (server vs client and layers inside each) remains the same.

---

## 2. Tech Stack

Server:
- Runtime: Node.js (LTS)
- Language: TypeScript
- Framework: Express
- HTTP: REST-style endpoints (JSON)
- Validation: Zod / Joi / class-validator (depending on implementation)
- Database (if used): PostgreSQL / MySQL / MongoDB (via an ORM/ODM like Prisma, TypeORM, or Mongoose)
- Auth (if applicable): JWT-based auth or session-based auth
- Tooling:
  - Nodemon / ts-node-dev (development)
  - ts-node / compiled JS (production)
  - ESLint, Prettier
  - Jest / Vitest / Mocha + Chai (tests)

Client:
- Framework: React
- Tooling: Vite (bundler/dev server)
- Language: TypeScript
- Router: React Router
- State Management: React Query / Redux Toolkit / Zustand (depending on implementation)
- Styling: CSS Modules / Tailwind CSS / Styled Components / plain CSS
- HTTP: Fetch API or Axios for server communication
- Testing: Vitest / Jest + React Testing Library
- Linting/Formatting: ESLint, Prettier

Monorepo/Tooling:
- Package manager: pnpm / yarn / npm (depending on actual configuration)
- Shared configs via root TS, ESLint, Prettier config files

---

## 3. Requirements

System requirements:
- Node.js: LTS (>= 18.x recommended)
- Package manager: pnpm (recommended) or yarn or npm
- Git

Optional:
- Docker & Docker Compose (for containerized deployment)
- A running database instance if the server uses a database

---

## 4. Getting Started

### 4.1 Clone & Install

1. Clone the repository:

   git clone https://github.com/your-org/your-repo.git
   cd your-repo

2. Install dependencies.

   If using pnpm:

   pnpm install

   If using yarn:

   yarn install

   If using npm:

   npm install

This will install dependencies for the root and all workspaces (server and client) if workspaces are configured in the root package.json.

---

### 4.2 Environment Configuration

You must configure environment variables separately for the server and client.

Root-level .env is optional and not automatically loaded by both sides unless specifically wired.

#### 4.2.1 Server environment

In server directory:

1. Copy the sample environment file if present:

   cd server
   cp .env.example .env

2. Open server/.env and set values:

   PORT=4000
   NODE_ENV=development
   LOG_LEVEL=info

   # Database (if used)
   DATABASE_URL=postgresql://user:password@localhost:5432/dbname

   # JWT / Auth (if used)
   JWT_SECRET=change_me
   JWT_EXPIRES_IN=1d

   # CORS
   CORS_ORIGIN=http://localhost:5173

Adjust according to your setup.

#### 4.2.2 Client environment

In client directory:

1. Copy the sample environment file if present:

   cd client
   cp .env.example .env

2. Open client/.env and set values. With Vite, variables must start with VITE_:

   VITE_API_BASE_URL=http://localhost:4000/api
   VITE_APP_ENV=development

These variables are injected at build time and are safe to expose on the client (no secrets).

---

### 4.3 Running in Development

From the root, you can run the server and client simultaneously, or each individually.

#### 4.3.1 Run both (concurrently)

If the root package.json includes a dev script like:

- Using pnpm:

  pnpm dev

- Using yarn:

  yarn dev

- Using npm:

  npm run dev

This typically runs:
- Server on http://localhost:4000
- Client on http://localhost:5173

#### 4.3.2 Run server only

From root:

- pnpm server:dev
- yarn server:dev
- npm run server:dev

Or from /server:

- pnpm dev
- yarn dev
- npm run dev

Default server URL: http://localhost:4000

#### 4.3.3 Run client only

From root:

- pnpm client:dev
- yarn client:dev
- npm run client:dev

Or from /client:

- pnpm dev
- yarn dev
- npm run dev

Default client URL: http://localhost:5173

---

## 5. Available Scripts

The exact script names may differ slightly, but the following is the typical layout.

### 5.1 Root Scripts

Located in /package.json:

- dev
  Run both server and client in development mode concurrently.

- build
  Build server and client.

- lint
  Run linting across all workspaces.

- test
  Run tests across all workspaces (if configured).

- format
  Format codebase using Prettier.

- server:dev
  Run server dev script.

- server:build
  Build server.

- server:test
  Run server tests.

- client:dev
  Run client dev script.

- client:build
  Build client.

- client:test
  Run client tests.

Run these using pnpm, yarn, or npm, e.g.:

pnpm dev
pnpm build

---

### 5.2 Server Scripts

Located in /server/package.json:

- dev
  Starts the server in development mode with nodemon/ts-node-dev (auto-restart on file changes).

- build
  Compiles TypeScript to JavaScript into a dist/ directory.

- start
  Runs the compiled server from dist/ (used in production).

- test
  Runs server tests.

- lint
  Lints server code.

- typecheck
  Runs TypeScript type checking without emitting code.

Example usage:

cd server
pnpm dev
pnpm build
pnpm start

---

### 5.3 Client Scripts

Located in /client/package.json:

- dev
  Starts Vite dev server for React client.

- build
  Builds the production bundle.

- preview
  Serves the production build locally for preview.

- test
  Runs client tests (unit/integration).

- lint
  Lints client code.

- typecheck
  Type-checks client TypeScript code.

Example usage:

cd client
pnpm dev
pnpm build
pnpm preview

---

## 6. Environments & Configuration

### 6.1 Root Configuration

Common configuration files:

- tsconfig.base.json
  Shared base TypeScript config for server and client (path aliases, strictness).

- .eslintrc.cjs / .eslintrc.js
  Root ESLint configuration with overrides per workspace.

- .prettierrc
  Prettier configuration for code formatting.

- .editorconfig
  Ensures consistent editor settings across IDEs.

---

### 6.2 Server Configuration

Server uses:

- server/tsconfig.json
  Extends ts