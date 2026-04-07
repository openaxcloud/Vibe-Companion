# Frontend Application (SPA)

This directory contains the frontend single-page application (SPA) built with React and TypeScript. It provides a modern, responsive, and accessible user interface for browsing products, managing the cart, and completing the checkout flow. It also includes an authenticated dashboard for administrative or user-specific views.

The app is designed as a client-side rendered SPA using React Router, with a focus on performance, clear state management, and a polished user experience including dark mode and responsive layouts.

## Main Features

- Full product browsing experience (catalog, product detail)
- Shopping cart with quantity management
- Multi-step checkout flow
- Dashboard for authenticated actions/insights
- Dark mode support (manual and/or system preference)
- Responsive design for mobile, tablet, and desktop
- Client-side routing with React Router
- TypeScript for type safety
- Modern build pipeline (e.g., Vite / CRA / Next SPA mode, depending on project setup)

> Note: The exact tech stack (Vite, Create React App, etc.) depends on the root project configuration. The commands described below assume a standard `npm` / `yarn` / `pnpm` workflow and a typical React + TypeScript setup.

---

## Project Structure (High-Level)

Key frontend directories and files (actual names may differ slightly by implementation):

- src/
  - main.tsx / index.tsx
    - App entry point, mounts the root React component to the DOM.
  - App.tsx
    - Defines the main layout and configures the global router.
  - routes/
    - catalog/
      - CatalogPage.tsx
    - product/
      - ProductDetailPage.tsx
    - cart/
      - CartPage.tsx
    - checkout/
      - CheckoutPage.tsx
    - dashboard/
      - DashboardPage.tsx
  - components/
    - Shared and reusable UI components (e.g., header, footer, buttons, cards, modals).
  - context/ or store/
    - Global state management for cart, user/session, theme, etc.
  - styles/ or theme/
    - Global styles, theme configuration (including dark mode), and responsive breakpoints.
  - utils/
    - Helper functions, API clients, and type definitions.

This structure is intended to keep pages, components, and domain-specific logic separated and organized.

---

## Main Pages

### 1. Catalog Page

Path example:
- / or /catalog

Purpose:
- Displays a list/grid of products.
- Supports searching, filtering, and sorting (if implemented).
- Allows navigation to individual product detail pages.

Key behaviors:
- Fetches product data from an API or mock data source.
- Renders product cards with basic information (name, price, thumbnail).
- Clicking a product navigates to the Product Detail page.

### 2. Product Detail Page

Path example:
- /products/:productId

Purpose:
- Shows detailed information about a single product, including:
  - Title, description, images
  - Price and availability
  - Additional metadata or specifications

Key behaviors:
- Fetches product details by ID.
- Allows the user to:
  - Select quantity and variations (size, color, etc., if applicable).
  - Add the product to the cart.
- May show related or recommended products (optional).

### 3. Cart Page

Path example:
- /cart

Purpose:
- Central place to view and manage items the user intends to purchase.

Key behaviors:
- Lists all products currently in the cart.
- Allows quantity adjustments and item removal.
- Displays subtotal, estimated taxes/shipping (if implemented), and total.
- Provides a clear CTA/button to proceed to Checkout.
- Handles empty cart experience gracefully (e.g., a link back to the catalog).

### 4. Checkout Page

Path example:
- /checkout

Purpose:
- Guides the user through completing an order.

Typical steps (implementation may vary):
1. Shipping information
2. Billing/payment details
3. Order review and confirmation

Key behaviors:
- Validates user input (addresses, payment fields, etc., depending on the scope).
- Shows order summary (products, totals) on each step.
- Submits order data to backend or mock endpoint.
- On success, may show a confirmation screen or redirect to a Thank You page.

### 5. Dashboard Page

Path example:
- /dashboard

Purpose:
- Authenticated section for admin or logged-in users.

Common features (depending on project scope):
- Overview metrics (sales, orders, user activity).
- List of recent orders or analytics.
- Links to manage products, inventory, or profile settings.

Key behaviors:
- Requires authentication (via JWT, session, or mock auth).
- May include role-based access control (e.g., admin vs. normal user).
- Pulls data from protected API endpoints where applicable.

---

## Dark Mode

The frontend supports dark mode for improved visual comfort, especially in low-light environments. The implementation generally follows one or more of these strategies:

- System preference:
  - Automatically matches the user’s operating system theme via the `prefers-color-scheme` media query.

- Manual toggle:
  - A UI control (e.g., icon or switch in the header or settings menu) allows users to switch between light and dark themes.
  - The preference is typically persisted (e.g., in `localStorage`) so the theme is restored on reload.

- Theming:
  - Uses a theme provider or CSS variables (custom properties) to define color palettes.
  - Updates class on the `html` or `body` element (e.g., `class="dark"`) to swap themes efficiently.

If you modify or extend dark mode:
- Keep contrast ratios accessible.
- Ensure that both light and dark themes are tested across all core pages.

---

## Responsive Design

The app is fully responsive and optimized for different screen sizes:

- Mobile (small viewports)
  - Stacked layouts
  - Simplified navigation (e.g., bottom nav or hamburger menu)
  - Collapsible filters and menus on the catalog page

- Tablet (medium viewports)
  - Two-column layouts where appropriate (e.g., product details next to images)
  - Side-by-side views on cart/checkout if space allows

- Desktop (large viewports)
  - Multi-column grids (product cards, dashboard widgets)
  - Persistent sidebar or top navigation
  - Richer tables or data visualizations (particularly in the dashboard)

Techniques:
- CSS grid and flexbox for layout
- Relative units (rem, %) and responsive breakpoints
- Mobile-first styles with media queries

When adding new pages or components:
- Test across small, medium, and large viewports.
- Ensure controls remain tappable and readable on touch devices.

---

## Getting Started

Prerequisites:
- Node.js (LTS version recommended)
- npm, yarn, or pnpm

From the project root or `frontend/` directory (depending on your repository layout):

1. Install dependencies:

   npm:
     npm install

   yarn:
     yarn install

   pnpm:
     pnpm install

2. Configure environment variables (if required):

   - Create a `.env` file in the `frontend/` directory (or at the project root if configured that way).
   - Typical variables might include:
     - `VITE_API_BASE_URL` or `REACT_APP_API_BASE_URL`
     - Any feature flags or analytics keys
   - Check `.env.example` if provided.

---

## Running the Development Server

To start the dev server with hot module reloading:

npm:
  npm run dev

yarn:
  yarn dev

pnpm:
  pnpm dev

Common defaults:
- The app usually runs at:
  - http://localhost:3000 or
  - http://localhost:5173
  depending on whether it’s CRA, Vite, or another tool.
- You can then open the app in your browser and navigate through:
  - Catalog: /
  - Product detail: /products/:id
  - Cart: /cart
  - Checkout: /checkout
  - Dashboard: /dashboard

If you have a separate backend/API:
- Ensure the backend is running and reachable via the configured `API_BASE_URL`.
- Adjust CORS or proxy settings as needed.

---

## Building for Production

To create an optimized production build:

npm:
  npm run build

yarn:
  yarn build

pnpm:
  pnpm build

This command:
- Compiles TypeScript
- Bundles JavaScript, CSS, and assets
- Performs optimizations such as minification and tree-shaking

The output is written to a `dist/` or `build/` directory (depending on the chosen tooling).

You can preview the production build locally (if supported):

npm:
  npm run preview

yarn:
  yarn preview

pnpm:
  pnpm preview

---

## Linting and Formatting

Most setups include scripts for linting and formatting to maintain code quality:

npm:
  npm run lint
  npm run format

yarn:
  yarn lint
  yarn format

pnpm:
  pnpm lint
  pnpm format

These may run tools like:
- ESLint (JavaScript/TypeScript linting)
- Prettier (code formatting)

Run these commands before committing changes to keep the codebase consistent.

---

## Testing

If tests are configured (recommended):

npm:
  npm test

yarn:
  yarn test

pnpm:
  pnpm test

This may use:
- Jest / Vitest for unit tests
- React Testing Library for component testing

Add tests for new pages and