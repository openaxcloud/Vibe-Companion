# Product & UX Context – Memory Bank

## Problem Statement
- Need a **single marketplace** where users can browse products from multiple sellers, pay securely, and track orders.
- Admins require a **central dashboard** to manage catalog, orders, and basic seller info without engineering changes.

## Target Users
- **Shoppers:** Discover, compare, and purchase products quickly and safely.
- **Admins/Operators:** Manage inventory, pricing, orders, and customer issues.
- **Sellers (future):** Limited scope in MVP; admin-managed for now, with seller attribution.

## UX Goals
- **Fast discovery:** Effective search, filters, and clear product metadata.
- **Low-friction checkout:** Minimal steps from cart to payment; clear error handling.
- **Trust & clarity:** Prominent pricing, totals, and payment security indicators.
- **Dashboard clarity:** List, filter, and inspect orders with minimal navigation.

## Key User Flows (MVP)
1. **Browse & Discover**
   - Landing → Product listing → Use search/filters/sort → View product details.
2. **Cart & Checkout**
   - Add product → View cart → Adjust quantities/remove → Begin checkout → Enter shipping/contact → Stripe payment → Confirmation page.
3. **Authentication**
   - Sign up (email/password) → Email-based login → Logout → Password reset.
4. **Buyer Order Management**
   - Auth → My Orders → View order list → Open order detail (items, status, payment info snapshot).
5. **Admin Order Management**
   - Admin login → Orders dashboard → Search/filter by status/date/user → View order → Update status (e.g., Pending → Shipped → Completed) → Record manual notes.
6. **Admin Catalog Management** (basic)
   - Admin login → Products dashboard → Create/edit product (title, description, images, price, stock, category, seller).
