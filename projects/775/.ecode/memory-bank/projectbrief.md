# Project Brief: E‑Commerce Marketplace (Memory Bank Overview)

1. **Project Name:** Full-Stack E‑Commerce Marketplace (Stripe + React + TypeScript)
2. **Mission:** Provide a modern, mobile-first marketplace supporting secure payments, rich product discovery, and basic operations (orders, inventory, notifications).
3. **Core Features (MVP):**
   - Product catalog with categories, search, and filters
   - Shopping cart and guided checkout flow
   - Stripe payment integration (Cards + test modes)
   - User authentication (sign up / login / password reset)
   - Order creation, history, and basic order status updates
   - Inventory tracking (stock levels per SKU)
   - Admin/order management dashboard
   - Email notifications for key order events
   - Mobile-responsive UI with dark/light mode toggle
4. **Non‑Goals (for now):**
   - Marketplace payouts/escrow between multiple vendors
   - Complex promotions, coupons, or loyalty programs
   - Advanced analytics, reporting, or recommendation engines
5. **Quality Goals:**
   - Reliable checkout and payment flows (no orphan orders)
   - Accessible UI (keyboard + screen-reader friendly)
   - Predictable performance for small-to-mid catalogs (up to ~10k products)
   - Clear separation of concerns between frontend, backend, and infra.
6. **Scope for Initial Build:**
   - Single-region deployment
   - Single currency (e.g., USD) and locale
   - One admin role with basic CRUD for products and orders.
7. **Success Criteria:**
   - Users can discover products, place paid orders, and receive confirmation emails
   - Admins can manage products, stock, and order statuses without DB access.
