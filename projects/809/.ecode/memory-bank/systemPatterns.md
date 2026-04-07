# System Architecture & Patterns – Memory Bank

## High-Level Architecture
- Client: TypeScript React SPA for marketplace UI, cart, checkout, and dashboards.
- Backend (abstracted here): REST/GraphQL API providing products, cart operations, auth, and order endpoints.
- Payments: Stripe integration via backend (server-side secrets) and Stripe.js/Elements in frontend.

## Core Modules (Frontend View)
- Catalog: product listing, search input, filters, pagination; stateless UI + data from API.
- Product Detail: single product view, add-to-cart actions.
- Cart: local or server-backed cart state synced to backend.
- Checkout: shipping/billing info forms, Stripe payment form, order review.
- Auth: signup, login, token handling, protected routes.
- Orders: order history and detail views for shoppers; dashboard for admins.

## State & Data Patterns
- Global app state via React Query/Zustand/Redux (decision recorded here when chosen).
- Normalized entities: Product, CartItem, Order, User, PaymentIntent references.
- Derived state for UI (e.g., cart totals, filter chips) computed client-side.

## Integration & Error Patterns
- Stripe: create PaymentIntent via backend → confirm payment client-side → listen for webhooks backend-side (order finalization).
- Use optimistic UI only where safe (e.g., cart item quantity changes) and document rollback rules.
- Centralized error handling: network errors, 4xx business errors, Stripe payment failures.

## Architectural Decisions to Track
- Auth token strategy (cookies vs. local storage, refresh flow).
- Cart implementation (guest vs. authenticated vs. hybrid cart merging).
- Order lifecycle states and how they map across frontend, backend, and Stripe.
- Access control patterns for admin/vendor dashboard routes.
