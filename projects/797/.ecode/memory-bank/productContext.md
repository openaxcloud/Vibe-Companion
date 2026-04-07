# Product & UX Context – Memory Bank

## Problem & Value
- Problem: Small merchants and niche sellers need a simple online marketplace to list products, accept secure payments, and manage orders without engineering expertise.
- Solution: A web marketplace where users can discover products, add to cart, and pay via Stripe; merchants/admins can manage catalog and orders from a dashboard.

## Target Users
- Shoppers: browse/search products, filter by attributes, checkout quickly and securely.
- Admins/Store managers: create/update products, track orders, manage fulfillment.
- (Optional future) Sellers: manage their own products and see performance metrics.

## UX Goals to Preserve
- Fast time‑to‑value: users can find a product and reach checkout in minimal steps.
- Clear, trustworthy payment experience integrated with Stripe (no confusion about security).
- Mobile‑first, responsive design; accessible components (WCAG‑aware).
- Predictable navigation: Home → Catalog → Product Detail → Cart → Checkout → Order Confirmation.

## Key User Flows to Remember
- Catalog browsing: landing page → search and filter products → view product detail.
- Cart management: add/update/remove items, persist cart across sessions where possible.
- Checkout: authenticate or continue as guest (if allowed), enter shipping + billing, Stripe payment, receive confirmation + email.
- User account: register/login, view past orders, track order status.
- Admin dashboard: login as admin, manage products (CRUD), review and update orders (status, tracking). 
