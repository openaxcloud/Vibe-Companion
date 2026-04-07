# Project Name

Modern web application integrating a TypeScript-based backend, a React frontend, and Stripe-powered payments. This README describes the project structure, technology stack, environment configuration, development workflow, build steps, and how to run Stripe test payments, as well as the key limitations of this MVP.

---

## Table of Contents

1. Overview
2. Tech Stack
3. Project Structure
4. Environment Configuration
   - Global Requirements
   - Backend .env
   - Frontend .env
   - Stripe Webhooks (optional)
5. Installation
6. Running in Development
   - Backend Dev Server
   - Frontend Dev Server
   - Concurrent Development (frontend + backend)
7. Building for Production
   - Backend Build
   - Frontend Build
   - Serving Production Build
8. Stripe Integration
   - Stripe Setup
   - Test Cards
   - Test Payment Flow
   - Webhook Testing (optional)
9. Testing
10. Common Issues & Troubleshooting
11. MVP Limitations and Future Improvements
12. License

---

## 1. Overview

This application is a minimal but production-oriented MVP that demonstrates:

- A strongly typed backend API in TypeScript (Node.js)
- A modern React frontend
- Secure environment-based configuration
- Stripe integration for test-mode payments

It is intended as a foundation you can extend into a full product, not as a feature-complete system.

---

## 2. Tech Stack

Backend:
- Node.js (LTS)
- TypeScript
- Express (or similar minimal HTTP framework)
- Stripe Node SDK
- dotenv for environment variables

Frontend:
- React
- TypeScript
- Vite or Create React App-style tooling (fast dev server + production build)
- Fetch or Axios for API calls

Tooling:
- npm or yarn for package management
- ESLint / Prettier (optional, but recommended)
- Stripe CLI (optional, for webhook testing)

---

## 3. Project Structure

The repository is organized as follows (exact naming may vary, but structure is similar):

- /backend
  - src/
    - index.ts                  Entry point for backend server
    - routes/
      - payments.ts             Stripe-related endpoints
      - health.ts               Healthcheck or status routes
    - config/
      - env.ts                  Centralized environment variable loading & validation
    - services/
      - stripeService.ts        Payment-related business logic
    - types/
      - global.d.ts             Shared backend types
  - package.json
  - tsconfig.json
  - .env.example               Example backend environment config

- /frontend
  - src/
    - main.tsx                 Frontend entry point
    - App.tsx                  Root React component
    - components/
      - PaymentForm.tsx        Stripe payment form & logic
      - Layout.tsx             Shared layout or shell
    - api/
      - client.ts              Thin API client for backend communication
    - config/
      - env.ts                 Frontend-safe environment access
  - index.html
  - package.json
  - tsconfig.json
  - vite.config.ts or similar
  - .env.example               Example frontend environment config

- /scripts (optional)
  - dev-all.sh / dev-all.bat   Helper to run frontend + backend together

- package.json (optional monorepo root, if using workspace setup)
- README.md (this file)

---

## 4. Environment Configuration

Correct environment configuration is required before running the application.

### 4.1 Global Requirements

Install the following globally or ensure they are available in your environment:

- Node.js (LTS version recommended, e.g., 18+)
- npm (bundled with Node.js) or yarn
- Stripe account with test-mode API keys

### 4.2 Backend .env

In the /backend directory:

1. Copy the example environment file:
   - cp .env.example .env

2. Edit .env to include your actual values. A typical backend .env file:

   NODE_ENV=development
   PORT=4000

   # Stripe Secret Key (Test Mode)
   STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXX

   # Optional: Stripe webhook secrets (if using webhooks)
   STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX

   # CORS / Frontend URL
   FRONTEND_URL=http://localhost:5173

Notes:
- STRIPE_SECRET_KEY must never be exposed on the frontend. Keep it in backend .env only.
- Ensure FRONTEND_URL matches the frontend dev server URL.

### 4.3 Frontend .env

In the /frontend directory:

1. Copy the example file:
   - cp .env.example .env

2. Edit .env with your values. For Vite-style setups (note the VITE_ prefix):

   VITE_API_BASE_URL=http://localhost:4000
   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXX

Notes:
- Use your Stripe publishable key for test mode (starts with pk_test_).
- The VITE_ prefix ensures the variables are exposed to the browser via the bundler.
- VITE_API_BASE_URL should point to your backend server.

### 4.4 Stripe Webhooks (optional)

If you plan to receive and test webhooks locally:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Log in via: stripe login
3. Forward events to your local backend:
   - stripe listen --forward-to localhost:4000/webhooks/stripe
4. Stripe CLI will show a signing secret (whsec_...). Put this in:
   - backend/.env as STRIPE_WEBHOOK_SECRET

Ensure your backend webhook route matches the URL you set in stripe listen.

---

## 5. Installation

From the repository root, install dependencies for both backend and frontend.

Option A: Manually (without workspaces):
- cd backend
- npm install
- cd ../frontend
- npm install

Option B: Using npm workspaces or a similar monorepo setup:
- At repository root:
  - npm install
  - This will install dependencies in both /backend and /frontend if configured as workspaces.

Check your root package.json to see if workspaces are configured. If not, use Option A.

---

## 6. Running in Development

You can run backend and frontend independently, or use a helper script to run both concurrently.

### 6.1 Backend Dev Server

From /backend:

1. Ensure .env is configured.
2. Run:
   - npm run dev

Typical behavior:
- Starts the server in watch mode (using ts-node-dev, nodemon, or similar).
- Listens on the port set in PORT (default 4000).

Verify:
- Visit http://localhost:4000/health or the configured health route.
- You should see a simple status JSON or message.

### 6.2 Frontend Dev Server

From /frontend:

1. Ensure .env is configured with VITE_STRIPE_PUBLISHABLE_KEY and VITE_API_BASE_URL.
2. Run:
   - npm run dev

Typical behavior:
- Starts the Vite (or CRA) dev server.
- Usually available at http://localhost:5173 (Vite default).

Verify:
- Open the URL in your browser.
- You should see the application UI load (e.g., a basic home page with a payment form).

### 6.3 Concurrent Development (frontend + backend)

If you want to run both servers with one command, there are several options:

Option A: Root-level script with concurrently (recommended for monorepo):
- At repository root, in package.json, you might have:
  - "scripts": {
      "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\""
    }
- Then run:
  - npm run dev

Option B: Shell script:
- From repository root, run:
  - ./scripts/dev-all.sh
- Or on Windows:
  - scripts/dev-all.bat

Check the repository for existing helpers. If none are present, use Option A.

---

## 7. Building for Production

The build process generates optimized artifacts for both backend and frontend.

### 7.1 Backend Build

From /backend:

- npm run build

Expected behavior:
- Compiles TypeScript from src/ into JavaScript in a dist/ directory.
- May copy static assets if configured.

To run the built backend:

- npm run start

This generally maps to:
- node dist/index.js

Ensure that in production you still configure a proper .env or equivalent environment variables.

### 7.2 Frontend Build

From /frontend:

- npm run build

Expected behavior:
- Produces a production-ready static bundle in dist/.
- Includes minified JS, CSS, and optimized assets.

To preview the production build locally (Vite example):

- npm run preview

Preview typically serves dist/ at http://localhost:4173 or similar.

### 7.3 Serving Production Build

For a deployment scenario:

1. Build backend and frontend:
   - cd backend && npm run build
   - cd ../frontend && npm run build

2. Choose how to serve frontend:
   - Option A: Serve frontend statically (e.g., from an S3 bucket or CDN).
   - Option B: Configure backend (Express) to serve the frontend dist/ directory as static files.

3. Ensure environment variables are correctly set on the server:
   - BACKEND: Use process environment (e.g., in a Node hosting environment).
   - FRONT