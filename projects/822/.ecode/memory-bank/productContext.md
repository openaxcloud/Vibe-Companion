# Product & UX Context (Memory Bank)

## Problem Statement
- Need a scalable marketplace to list products from multiple vendors, allow users to discover items, purchase via Stripe, and manage orders.
- Must deliver a frictionless experience from discovery to completed payment and order tracking.

## Target Users
- Shoppers: browse/search products, manage cart, checkout, track orders.
- Vendors/Admins: manage product catalog, inventory, pricing, and orders.

## UX Goals
- Fast, relevant product discovery (search + filters).
- Clear, low-friction checkout with Stripe (minimal surprises at payment).
- Transparent order history and status updates.
- Mobile-friendly responsive UI.

## Key User Flows to Remember
- Anonymous → Register/Login → Persist cart across sessions.
- Catalog browsing → Search by keyword → Filter by category/price/other facets → View product details.
- Add to cart → Edit quantities/remove items → Proceed to checkout → Enter shipping/billing → Pay via Stripe → Order confirmation.
- User dashboard → View past orders → View order details/status → (Optional) reorder.
- Admin/vendor dashboard → CRUD products → View and update order statuses.
