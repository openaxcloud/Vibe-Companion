# System Patterns – Memory Bank

## Architecture Overview to Remember
- Full-stack TypeScript application with React frontend.
- Backend (TypeScript) exposes REST/GraphQL APIs for products, cart, auth, and orders.
- Stripe integration via backend server; webhooks handle payment events and update orders.
- Likely data model: Users, Products, Orders, OrderItems, Carts/CartItems, possibly Stores/Vendors.

## Key Technical Decisions
- Use TypeScript end-to-end for type safety and shared types between frontend and backend where practical.
- React for SPA/MPA UI with client-side routing; state management for cart and auth (e.g., React Query/Redux/Zustand – to be decided and then saved).
- Backend handles all sensitive operations (Stripe secret keys, webhooks, role checks).
- Authentication implemented via tokens/sessions and enforced on protected routes and dashboard.

## Design Patterns & Conventions
- Layered backend: routes/controllers → services → repositories/models → data store.
- DTOs for API requests/responses; avoid leaking internal models directly.
- Use domain terms consistently: Product, Cart, Order, PaymentIntent, etc.
- Clearly separate buyer-facing flows from admin/dashboard endpoints and UIs.

## Memory Bank Use
- Once specific choices are made (e.g., REST vs GraphQL, chosen state manager, DB type), store them here.
- Capture recurring patterns (e.g., how validation is done, error handling strategy) to keep the codebase coherent.