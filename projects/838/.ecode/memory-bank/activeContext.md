# Active Context – Memory Bank

## Current Focus: Initial Setup & Foundations
- Define core domain models: User, Product, Category, Cart, CartItem, Order, OrderItem, Payment.
- Decide and lock in auth strategy (JWT vs cookie session) and associated middleware.
- Draft initial DB schema and migrations for core tables.
- Scaffold backend API endpoints skeletons (no heavy logic yet).
- Scaffold React app with routing and basic layout/shell.

## Next Steps Checklist
- [ ] Confirm architecture decisions and update Memory Bank if anything changes (auth, ORM choice).
- [ ] Implement auth flow: sign up, login, logout, protected routes on backend and frontend.
- [ ] Implement product listing endpoints + React catalog pages with search & filter UI.
- [ ] Implement server‑side cart model and frontend cart state sync.
- [ ] Integrate Stripe: create PaymentIntent from cart, handle success/failure, implement webhooks.
- [ ] Create order creation pipeline tying cart, payment, and order records.
- [ ] Build user account pages: profile, order history, order detail.
- [ ] Build basic admin dashboard: view orders, change status, view product inventory.
- [ ] Add validation, error handling, logging, and basic tests for critical flows.
