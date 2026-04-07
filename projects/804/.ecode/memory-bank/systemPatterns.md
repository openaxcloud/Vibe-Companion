# Memory Bank – System Patterns & Architecture

## High-Level Architecture
- Full-stack TypeScript app with React frontend and a TypeScript backend (Node-based).
- API layer exposes resources: auth, products, cart, checkout, orders, admin operations.
- Stripe integration for payment intent creation, confirmation, and webhook-based updates.

## Key Patterns to Remember
- Layered architecture: presentation (React) → API/controllers → services → data access.
- Domain-driven modules: `auth`, `catalog`, `cart`, `checkout`, `orders`, `admin`.
- Use DTOs/types shared between frontend and backend to reduce drift.
- Repository pattern for database access to abstract ORM/driver.

## Security & Auth Decisions
- JWT or session-based auth (decide early and record here).
- Role-based access control: shopper vs admin, enforced in API and UI routing.
- All Stripe interactions handled server-side; client uses ephemeral keys/intents.

## Resilience & Observability
- Centralized error handling in backend; consistent error shapes to frontend.
- Logging and basic metrics hooks (especially around payments and orders).

## Extensibility Considerations
- Make product and order models extensible with metadata fields.
- Design cart and pricing logic so discount/shipping plugins can be added later.
