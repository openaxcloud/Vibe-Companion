# Memory Bank – System Architecture & Patterns

## Architectural Style
- Full‑stack TypeScript app with React on the client and a TypeScript backend (framework can be assumed Node/Express or similar if unspecified).
- Likely API pattern: RESTful JSON endpoints for products, cart, auth, orders, and Stripe webhooks.

## Core Domain Models (to reuse consistently)
- User (Buyer/Seller/Admin roles).
- Product (id, title, description, price, images, category, inventory).
- Cart (user‑scoped, cart items with product ref, quantity, price snapshot).
- Order (line items, totals, user, status: pending → paid → fulfilled/cancelled).
- Payment (Stripe PaymentIntent id, status, amount, currency, mapping to Order).

## Key Design Patterns & Decisions
- Authentication: session/JWT‑based auth with protected routes for cart, checkout, and admin dashboard.
- Stripe integration: server creates PaymentIntent; client uses Stripe JS/Elements or Checkout Session; server receives webhook to finalize order status.
- Catalog & search: server‑side pagination and filtering; client maintains filter/search state and syncs via query params.
- Cart behavior: cart persisted server‑side for authenticated users; local storage may mirror state for UX but backend is source of truth.
- Order lifecycle: create provisional order at checkout start or on successful payment, then update via Stripe webhook.

## Non‑Functional Baselines
- Emphasis on correctness of payments and order state over advanced performance optimizations.
- Clear separation between public buyer API and restricted admin/seller endpoints.
