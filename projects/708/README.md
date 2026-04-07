# E-Commerce MVP – Full-Stack Application

A production-ready, full-stack e-commerce MVP that supports:

- Product catalog browsing
- User authentication and authorization
- Shopping cart and checkout flow
- Stripe-based payments
- Order creation and management
- Admin product and order management

This repository contains both the backend (API) and frontend (web client) in a single monorepo-style structure.

---

## Table of Contents

1. Tech Stack
2. Architecture Overview
3. Features
   - Authentication and Authorization
   - Product Catalog
   - Shopping Cart
   - Checkout and Payments (Stripe)
   - Orders and Order Management
   - Admin Capabilities
4. Project Structure
5. Getting Started
   - Prerequisites
   - Environment Variables
   - Installation
   - Running the Backend
   - Running the Frontend
6. Development Workflow
7. Production Build and Deployment
8. Testing
9. Common Issues and Troubleshooting
10. Security and Best Practices
11. Roadmap and Extensions
12. License

---

## 1. Tech Stack

Backend:
- Node.js
- TypeScript (if using TS backend)
- Express (or Nest/Fastify depending on implementation)
- PostgreSQL (or another SQL database)
- Prisma / TypeORM / Sequelize (ORM, depending on implementation)
- JWT-based authentication
- Stripe SDK for payments

Frontend:
- React (with hooks)
- TypeScript (if using TS frontend)
- Next.js or Vite/CRA (depending on implementation)
- React Query / SWR / RTK Query for data fetching (depending on implementation)
- React Router (if not using Next.js routing)
- Tailwind CSS / CSS Modules / Styled Components (depending on implementation)

DevOps and Tooling:
- dotenv for environment configuration
- ESLint and Prettier for linting and formatting
- Jest / Vitest / React Testing Library / Supertest for tests (depending on implementation)
- Docker (optional, for containerized deployment)

---

## 2. Architecture Overview

The application is split into two main services:

1. Backend API (e.g., `/backend` directory)
   - RESTful API built with Node.js and Express (or another HTTP framework).
   - Handles authentication, authorization, data persistence, and communication with Stripe.
   - Integrates with a relational database (e.g., PostgreSQL).
   - Exposes endpoints for:
     - Auth: register, login, logout, refresh tokens, get current user
     - Products: listing, search, filtering, and detail views
     - Cart: server-side cart (optional) or helper endpoints
     - Orders: create, list, detail (for customers and admins)
     - Payments: creating Stripe payment intents, handling webhooks

2. Frontend Web Client (e.g., `/frontend` directory)
   - React-based SPA or Next.js app.
   - Communicates with the backend via JSON over HTTPS.
   - Manages UI state: auth session, cart, checkout, order history.
   - Integrates with Stripe Client SDK (Stripe.js + Elements) for secure card data entry.

Communication:
- All frontend calls to the backend are authenticated using either:
  - HTTP-only cookies for session/JWT, or
  - Bearer tokens stored securely (recommended in memory).
- The backend uses standard REST endpoints with JSON payloads.

Deployment:
- Backend is deployable to any Node-compatible environment (e.g., Render, Railway, Heroku, AWS, GCP).
- Frontend is buildable as static assets or SSR (if using Next.js) and can be served by:
  - A static host (Vercel/Netlify/S3+CloudFront), or
  - The Node backend (optional, if configured).

---

## 3. Features

### 3.1 Authentication and Authorization

- User registration with email and password.
- Secure password hashing (e.g., bcrypt).
- Login with email and password.
- JWT-based session handling:
  - Access tokens
  - Optional refresh tokens
- Role-based access control:
  - Customer role for normal users.
  - Admin role for product and order management.
- Protected endpoints for:
  - Getting the current user profile.
  - Viewing order history.
  - Creating and managing products (admin only).
  - Viewing all orders (admin only).

### 3.2 Product Catalog

- Product listing with pagination.
- Product detail view.
- Core product fields:
  - id, name, description, price, images, stock, category, createdAt, updatedAt
- Optional features:
  - Category filters
  - Search by name/description
  - Sorting (e.g., price, newest)

### 3.3 Shopping Cart

- Client-side cart or server-side persisted cart.
- Add product to cart, remove from cart, update quantities.
- Cart summary with:
  - Subtotal
  - Taxes (optional / configurable)
  - Shipping (optional / configurable)
  - Total

### 3.4 Checkout and Payments (Stripe)

- Stripe integration for secure payments.
- Payment flow:
  1. User proceeds to checkout from the cart.
  2. Frontend calls backend to create a Stripe Payment Intent with the order amount.
  3. Backend returns client secret to frontend.
  4. Frontend uses Stripe.js + Elements to collect card details and confirm the payment.
  5. Stripe confirms the payment; backend receives confirmation via:
     - Direct confirmation from frontend after payment success, and/or
     - Stripe Webhook events for robust confirmation and reconciliation.
- Payment status stored with the order:
  - PENDING
  - PAID
  - FAILED
  - REFUNDED (optional)

### 3.5 Orders and Order Management

- Creation of orders upon successful payment (or pre-payment, depending on flow).
- Order fields:
  - id, userId, items (productId, name, quantity, unitPrice, lineTotal), totalAmount, status, paymentStatus, createdAt, updatedAt, stripePaymentIntentId
- Customer features:
  - View own order history.
  - View details of a specific order.
- Admin features:
  - View all orders.
  - Filter by status (NEW, PROCESSING, SHIPPED, COMPLETED, CANCELED).
  - Update order status (e.g., mark as shipped or completed).

### 3.6 Admin Capabilities

- Available only to admin users.
- Product management:
  - Create new products.
  - Edit existing products.
  - Soft-delete or archive products (optional).
- Order management:
  - View and search all orders.
  - Update order statuses.
  - Inspect payment status and details.

---

## 4. Project Structure

A typical structure for this repository:

.
├─ backend/
│  ├─ src/
│  │  ├─ app.ts / main.ts
│  │  ├─ server.ts
│  │  ├─ config/
│  │  │  └─ env.ts
│  │  ├─ modules/
│  │  │  ├─ auth/
│  │  │  ├─ users/
│  │  │  ├─ products/
│  │  │  ├─ orders/
│  │  │  └─ payments/
│  │  ├─ middlewares/
│  │  ├─ database/
│  │  │  ├─ prisma/ or entities/migrations
│  │  └─ utils/
│  ├─ tests/
│  ├─ package.json
│  └─ tsconfig.json (if TypeScript)
│
├─ frontend/
│  ├─ src/
│  │  ├─ pages/ or routes/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ api/
│  │  ├─ context/ or store/
│  │  └─ styles/
│  ├─ public/
│  ├─ package.json
│  └─ tsconfig.json (if TypeScript)
│
├─ .env.example
├─ package.json (optional root workspace)
└─ README.md

The exact paths and filenames may vary slightly but will follow similar concepts.

---

## 5. Getting Started

### 5.1 Prerequisites

- Node.js (LTS recommended, e.g., 18+)
- npm or yarn (choose one and use consistently)
- PostgreSQL (or the configured database)
- Stripe account and API keys

Optional:
- Docker and Docker Compose
- nvm for Node version management

### 5.2 Environment Variables

Create an `.env` file in the backend and frontend directories based on `.env.example`.

Backend `.env` (example keys; adjust to actual implementation):

NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ecommerce_mvp
JWT_SECRET=your_jwt_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:4000

Optional additional backend keys:
- LOG_LEVEL
- CORS_ORIGIN
- EMAIL_SMTP_*

Frontend `.env` (example keys):

VITE_API_BASE_URL=http://localhost:4000/api
VITE