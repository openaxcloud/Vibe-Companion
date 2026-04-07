# E-Commerce Platform Monorepo

A full-stack TypeScript e-commerce platform built as a monorepo with separate backend (API) and frontend (SPA) applications. The project includes user authentication, product catalog browsing, shopping cart, checkout flow, and an admin dashboard for store management.

---

## Table of Contents

1. Overview
2. Architecture
3. Tech Stack
4. Features
   - Authentication & Authorization
   - Product Catalog
   - Cart
   - Checkout
   - Orders
   - Admin Dashboard
5. Getting Started
   - Prerequisites
   - Repository Structure
   - Initial Setup
6. Backend
   - Overview
   - Environment Variables
   - Running the Backend
   - Build & Production
7. Frontend
   - Overview
   - Environment Variables
   - Running the Frontend
   - Build & Production
8. Development Workflow
9. Testing
10. Common Commands
11. Deployment Notes
12. Troubleshooting

---

## 1. Overview

This repository contains a production-ready e-commerce platform with:

- Secure authentication (registration, login, password reset, JWT-based sessions)
- Product catalog with search, filters, and pagination
- Shopping cart persisted per user/session
- Checkout flow with order creation and payment provider integration hooks
- Order history and details
- Admin dashboard for managing products, categories, users, and orders

The project is organized as a monorepo to keep backend and frontend codebases in sync and share types/configuration where appropriate.

---

## 2. Architecture

High-level architecture:

- Backend: Node.js/TypeScript REST API
  - Authentication and authorization
  - Product, category, user, and order management
  - Cart and checkout orchestration
  - Database integration via an ORM
  - Centralized logging and error handling
- Frontend: React/TypeScript SPA
  - Client-side routing
  - State management for auth, catalog, cart, and checkout
  - Responsive UI
  - Integration with backend API via HTTP

Logical layers:

- Domain layer
  - Core business entities: User, Product, Category, Cart, CartItem, Order, OrderItem
  - Business rules, validations, and service abstractions
- Data access layer (backend)
  - Repositories for each aggregate (UserRepository, ProductRepository, etc.)
  - Database adapter and migration layer
- API layer (backend)
  - REST controllers/routers
  - DTO validation and mapping
  - Authentication guard/middleware
- UI layer (frontend)
  - Feature-oriented structure: auth, catalog, cart, checkout, admin
  - Global providers for auth, API client, and state
- Integration layer
  - HTTP client with interceptors for auth tokens and error handling
  - Client-side and server-side environment configuration

---

## 3. Tech Stack

Backend:

- Node.js
- TypeScript
- Express (or similar HTTP framework)
- PostgreSQL (or other SQL database)
- ORM (e.g., Prisma / TypeORM)
- JSON Web Tokens (JWT) for auth
- Zod / Joi / Yup for request validation
- Winston / pino for logging

Frontend:

- React
- TypeScript
- React Router
- State management (e.g., React Query / Redux Toolkit / Zustand)
- Tailwind CSS / CSS Modules / styled-components (depending on implementation)
- Axios / fetch-based HTTP client

Tooling:

- Yarn / npm / pnpm for dependency management
- ESLint and Prettier
- Jest / Vitest and React Testing Library for tests
- Docker / Docker Compose (optional for deployment)

Note: The exact libraries may differ slightly based on the implementation, but the concepts and configuration described here will remain the same.

---

## 4. Features

### 4.1 Authentication & Authorization

- User registration with email and password
- Login with email and password
- Secure password hashing on the backend
- JWT-based authentication with refresh token support
- Protected routes on both backend and frontend
- Role-based authorization:
  - Customer: can browse catalog, manage cart, place orders, view their own orders
  - Admin: can additionally manage products, categories, and orders
- Password reset flow:
  - Request reset link (email provider integration hook)
  - Token-based password update endpoint

### 4.2 Product Catalog

- Product listing with:
  - Pagination
  - Search by keyword
  - Filter by category
  - Filter by price range
  - Sort options (e.g., price, popularity, newest)
- Product detail pages:
  - Images, title, description, price
  - Available stock
  - Related products (optional)
- Category listing and navigation

### 4.3 Cart

- Add products to cart from product list and detail pages
- Update quantities and remove items
- Cart persistence:
  - Authenticated users: cart stored in database and associated with user
  - Guests: cart stored in local storage (or cookies) with optional server sync
- Cart totals:
  - Line item subtotal per product
  - Cart subtotal, taxes (if implemented), and grand total

### 4.4 Checkout

- Checkout flow:
  - Shipping information
  - Billing information
  - Payment method selection (integration via provider hooks)
- Order creation:
  - Validation of stock availability
  - Transactional order creation (order + order items)
- Payment provider integration hooks:
  - Pluggable payment service interface on backend
  - Webhook handler endpoints (if enabled)
- Post-checkout:
  - Order confirmation page
  - Confirmation email integration hook

### 4.5 Orders

- Customer:
  - Order history (paginated list)
  - Order detail view with products, totals, and status
- Admin:
  - Order listing with filters by status and date
  - Order detail view with customer information and line items
  - Ability to update order status (e.g., pending, paid, shipped, completed, canceled)

### 4.6 Admin Dashboard

- Protected admin-only views
- Product management:
  - Create, read, update, delete (CRUD) for products
  - Manage product images, price, stock, categories
- Category management:
  - CRUD for categories
- User management (optional, depending on implementation level):
  - List users
  - View basic user details
  - Update roles (e.g., grant/revoke admin)
- Order management:
  - View and filter orders
  - Update status

---

## 5. Getting Started

### 5.1 Prerequisites

- Node.js (LTS version)
- Yarn or npm
- PostgreSQL (or other configured database)
- Git

Optional:

- Docker and Docker Compose (for containerized deployment)
- A configured SMTP / email provider and payment provider for production

### 5.2 Repository Structure

The repository is organized into the following main folders:

- /backend
  - src
  - prisma / migrations / orm-config
  - tests
- /frontend
  - src
  - public
  - tests
- /shared (optional)
  - Shared TypeScript types and utilities
- /config
  - Environment-specific configuration templates
  - Docker and deployment configs

Core idea:

- Each app (backend, frontend) is self-contained and can be started independently.
- Shared logic can be placed in /shared and consumed by both.

### 5.3 Initial Setup

1. Clone the repository:

   git clone https://github.com/your-org/your-repo.git
   cd your-repo

2. Install dependencies (top-level and per app if needed):

   Using Yarn workspaces (preferred):
   - yarn install

   Or install individually:
   - cd backend && yarn install
   - cd ../frontend && yarn install

3. Create environment files using the templates:
   - Copy /config/backend.env.example to /backend/.env
   - Copy /config/frontend.env.example to /frontend/.env

4. Configure environment variables (see sections below).

5. Set up the database and run migrations:

   cd backend
   yarn db:migrate

---

## 6. Backend

### 6.1 Backend Overview

The backend is a Node.js/TypeScript REST API that exposes endpoints for:

- Auth: /auth/register, /auth/login, /auth/refresh, /auth/logout, /auth/reset-password
- Users: /users/me, /users/:id (admin)
- Products: /products, /products/:id
- Categories: /categories, /categories/:id
- Cart: /cart, /cart/items
- Checkout: /checkout, /checkout/confirm
- Orders: /orders, /orders/:id
- Admin: /admin/products, /admin/orders, /admin/users

It uses an ORM to manage database access and migrations, and JWT tokens for authentication.

### 6.2 Backend Environment Variables

Create /backend/.env with at least the following variables:

- APP_ENV
  - Description: Application environment
  - Example: development | production | test

- APP_PORT
  - Description: Port the backend server listens on
  - Example: 4000

- APP_URL
  - Description: Public base URL of the backend API
  - Example: http://localhost:4000

- DATABASE_URL
  - Description: Connection string for the database
  - Example: postgres://user:password@localhost:5432/ecommerce

- JWT_ACCESS_SECRET
  - Description: Secret for