# Technical Context – Memory Bank

## Tech Stack
- Language: TypeScript end-to-end (frontend + backend).
- Frontend: React (SPA), React Router for routing.
- Data fetching: React Query or equivalent (decision to be locked in here).
- Styling: CSS-in-JS or utility-first CSS (e.g., Tailwind); document chosen system.
- Payments: Stripe.js + React Stripe Elements.

## Project Structure (Frontend)
- `/src/app`: app shell, routing, layout components.
- `/src/features/catalog`: listing, filters, product detail.
- `/src/features/cart`: cart state, cart page, mini-cart components.
- `/src/features/checkout`: checkout wizard, payment forms.
- `/src/features/auth`: login, signup, session utilities.
- `/src/features/orders`: order history, order detail, admin dashboard views.
- `/src/shared`: UI components, hooks, utilities, types.

## Key Dependencies (Frontend)
- `react`, `react-dom`, `react-router-dom`.
- `typescript`, build tooling (Vite/Next/Webpack; decision recorded here).
- `@tanstack/react-query` (or chosen data lib) for server state.
- `@stripe/stripe-js`, `@stripe/react-stripe-js`.

## Environment Variables (Examples)
- `VITE_API_BASE_URL` – URL for backend API.
- `VITE_STRIPE_PUBLISHABLE_KEY` – public Stripe key.
- Backend (documented here as contract):
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
  - `JWT_SECRET` / session config.

## Dev Setup Notes
- Node LTS version and package manager (e.g., pnpm/yarn/npm) recorded here.
- Standard scripts: `dev`, `build`, `test`, `lint`, `typecheck`.
- Document local Stripe testing strategy (test keys, CLI tunnel for webhooks).
