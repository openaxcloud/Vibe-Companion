# System Architecture & Patterns – Memory Bank

1. **Overall Style:** Modular, service-oriented backend (monolith codebase) with a React SPA frontend; TypeScript end-to-end.
2. **App Layers:**
   - UI: React + routing + global state (cart, auth, filters)
   - API: REST/JSON (or minimal tRPC-like RPC) for products, cart, orders, auth
   - Data: Relational DB (e.g., Postgres) with an ORM (e.g., Prisma)
3. **Key Bounded Contexts:**
   - Identity & Access (users, roles, sessions)
   - Catalog (products, categories, inventory)
   - Commerce (cart, checkout, Stripe payments)
   - Orders (order lifecycle, status, history)
4. **Core Patterns to Remember:**
   - Clean separation: controller → service → repository
   - DTOs/validators at API boundaries (e.g., Zod / class-validator)
   - Stripe webhooks for payment confirmation and order state updates
   - Central error-handling and logging middleware
5. **State Management Patterns (Frontend):**
   - Auth + user profile in a global store (e.g., React Context or lightweight state lib)
   - Cart persisted in localStorage + synced with backend
   - URL-driven filters and sorting for product lists
6. **Security Patterns:**
   - JWT or session cookies for auth
   - Role-based access control for seller/admin APIs
   - Stripe keys only server-side; client uses Stripe.js + Payment Elements.
