# Product & UX Context – Memory Bank

1. **Problem Statement:** Build a modern web marketplace where users can discover products, add them to a cart, and securely pay via Stripe, while admins manage products and orders.
2. **Primary Users:**
   - Shoppers: browse, search, filter, purchase, and track orders.
   - Store Admin/Owner: manage catalog and fulfill orders.
3. **Secondary Users:**
   - Guest visitors: browse catalog and potentially add items to cart before sign-up.
4. **Target UX Qualities:**
   - Fast discovery: search + filters + clear product details.
   - Low-friction checkout: minimal steps, clear error handling, saved addresses/payment where possible.
   - Transparency: order status and email confirmations.
5. **Key Shopper Flows:**
   - Browse catalog → apply filters and sorting → view product details → add to cart.
   - Review cart → update quantities/remove → proceed to checkout.
   - Authenticate (login/register or continue as allowed) → enter shipping details → Stripe payment → order confirmation screen + email.
   - View order history → view order detail and status.
6. **Key Admin Flows:**
   - Login as admin → view orders dashboard (status, payment state, timestamps).
   - Update order status (e.g., Pending → Shipped → Completed).
   - Manage products (create, update, archive), including price, stock, and images.
7. **UX Constraints/Assumptions to Remember:**
   - Mobile-first responsive design.
   - Clear, consistent error and loading states.
   - Stripe-hosted or Stripe Elements checkout to reduce PCI scope.
