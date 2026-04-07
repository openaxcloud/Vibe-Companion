# Product & UX Context – Memory Bank

1. **Problem Statement:** Provide a simple yet robust marketplace where users can discover products from multiple sellers, purchase via secure Stripe checkout, and track orders; sellers can manage inventory and orders.
2. **Target Users:**
   - Buyers: browse, search, filter, purchase, track orders
   - Sellers: list products, manage stock and pricing, see orders
   - Admins: moderate catalog, users, and orders
3. **Key UX Goals:**
   - Fast product discovery (search + filters, responsive UI)
   - Clear, low-friction checkout with real-time validation
   - Transparent order status and history
   - Simple but capable seller/admin dashboards
4. **Core User Flows to Preserve in Memory:**
   - **Buyer:** sign up/login → browse/search → view product → add to cart → review cart → checkout (shipping + payment via Stripe) → order confirmation → view order history.
   - **Seller:** auth → create/edit products (title, description, price, images, stock, category, tags) → monitor orders → update order status (e.g., processing, shipped).
   - **Admin:** auth → manage users → moderate products → view global orders.
5. **Constraints / Assumptions:**
   - Initial market: single region / currency
   - Desktop-first with responsive design
   - Email/Password auth (plus optional OAuth later).
