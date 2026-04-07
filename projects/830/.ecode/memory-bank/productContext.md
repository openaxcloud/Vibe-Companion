# Product & UX Context – Memory Bank

## Problem Statement
- Need a robust, extensible marketplace where users can discover products, purchase with Stripe, and track orders.
- Need clear flows that are easy to implement, test, and iterate on.

## Target Users
- Shoppers: browse/search products, manage cart, checkout, view order history.
- Admins/Merchants: manage products, prices, inventory, and view orders.

## UX Goals
- Fast product discovery via search, filters (category, price, rating), and sorting.
- Minimal-friction cart and checkout with clear progress steps.
- Trustworthy payments via recognizable Stripe UI patterns.
- Clear post-purchase visibility: order status, receipts, and history.

## Key User Flows to Preserve in Memory Bank
- Anonymous → registered user: browsing, adding to cart, sign up/login, cart persistence.
- Catalog: search, filter, pagination, product detail view.
- Cart: add/remove/update quantities, apply constraints (stock, min/max).
- Checkout: shipping info, billing info, payment via Stripe, confirmation.
- Orders: list, detail view, status updates (pending, paid, shipped).
- Admin: product CRUD, basic inventory management, order overview.
