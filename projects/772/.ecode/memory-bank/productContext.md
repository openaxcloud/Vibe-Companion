# Product & Context – Memory Bank Focus

1. **Problem Statement:** Build a scalable, user-friendly marketplace where buyers can discover products, manage carts, pay via Stripe, and receive order updates; sellers/admins manage inventory and orders efficiently.
2. **Target Users:**
   - Shoppers (browsing, searching, filtering, purchasing).
   - Admins/Operators (manage catalog, inventory, orders, refunds).
3. **Key UX Goals to Remember:**
   - Fast product discovery (search + filters, responsive UI).
   - Frictionless checkout (guest vs authenticated, card payments via Stripe).
   - Clear order status and notifications via email.
   - Consistent, accessible dark/light modes across mobile and desktop.
4. **Core User Flows to Anchor Memory:**
   - **Browse & Search:** Landing → search/filter → product detail.
   - **Cart & Checkout:** Add to cart → review → authenticate (if needed) → checkout with Stripe → confirmation + email.
   - **Account & Orders:** Sign up / sign in → view orders → track status.
   - **Admin Operations:** Login → view orders dashboard → adjust status → update inventory.
5. **Constraints & Expectations:**
   - Built with TypeScript and React on the front end; full-stack solution (backend tech to be decided/recorded).
   - Stripe integration for secure payments (no storing raw card data).
   - Needs responsive layout and persistent theme preference (dark mode primary).
6. **What Memory Should Prioritize:**
   - Canonical user journeys and edge cases (e.g., stock changes during checkout).
   - Business rules (inventory decrements, refund behavior, order states).
   - UX decisions impacting tech (e.g., guest checkout policy, filter behavior).

