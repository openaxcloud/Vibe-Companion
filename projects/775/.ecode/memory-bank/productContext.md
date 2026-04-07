# Product Context & UX Flows (Memory Bank)

1. **Problem Statement:**
   - Small/medium merchants need a simple marketplace to list products, accept secure payments, and manage orders without custom backend development.
2. **Target Users:**
   - Shoppers: browse, search, purchase products on mobile/desktop.
   - Store Admins: manage products, inventory, and orders.
3. **UX Goals:**
   - Frictionless browse → cart → checkout sequence
   - Minimal steps to pay; clear error handling at checkout
   - Dark mode support and responsive layouts for phones first
   - Low cognitive load for admins (clear order and stock views).
4. **Key Shopper Flows:**
   - **Browse & Discover:** Landing → catalog → search/filter → product detail.
   - **Cart & Checkout:** Add to cart → view cart → adjust quantities → checkout → enter shipping + payment → confirmation.
   - **Account Management:** Sign up/login → view orders → view order detail (status, items, totals).
5. **Key Admin Flows:**
   - **Product Management:** Login as admin → list products → create/edit product (title, description, price, images, category, attributes, stock) → save.
   - **Order Management:** View order list → filter by status/date → open order → update status (e.g., Pending → Shipped) → trigger notification.
   - **Inventory Tracking:** Adjust stock levels manually; inventory auto-decrement on paid orders.
6. **Notifications:**
   - Shopper: order placed, payment succeeded/failed, order shipped.
   - Admin: optional daily summary of new paid orders (stretch).
7. **User Experience Constraints:**
   - Support anonymous browsing; cart persists per device/session.
   - Require account for checkout and order history (for now).
   - Ensure all critical paths usable in both light and dark modes.
