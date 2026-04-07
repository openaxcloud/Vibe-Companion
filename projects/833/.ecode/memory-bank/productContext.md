# Product Context – Memory Bank Focus

1. **Problem Statement:**
   - Building a full-stack TypeScript marketplace is complex (catalog, auth, checkout, Stripe, orders).
   - Decisions are scattered across tickets, chats, and code comments, causing rework and inconsistencies.
   - The Memory Bank gives a single structured place to capture and query product and UX decisions.
2. **Target Users (of the Marketplace):**
   - Shoppers: browse/search products, manage cart, pay via Stripe, track orders.
   - Admins/Operators: manage products, view/fulfill orders, handle refunds/issues.
   - (Optional later) Vendors: manage their own products and see sales.
3. **Target Users (of the Memory Bank):**
   - Developers, tech leads, and product managers working on this marketplace repo.
   - QA and support teams needing to understand expected behaviors.
4. **UX Goals (Marketplace):**
   - Fast, intuitive product discovery (search + filters).
   - Frictionless checkout (minimal steps, clear Stripe handoff and error handling).
   - Clear order status visibility (pending, paid, shipped, refunded).
5. **UX Goals (Memory Bank):
   - Low-friction authoring: simple markdown, predictable folder/naming patterns.
   - Task-centric retrieval: “Show all notes about checkout errors” or “Stripe webhooks logic.”
   - Minimal duplication between docs; link entries instead of repeating.
6. **Key User Flows to Capture in Memory Bank:**
   - Browse/search/filter catalog; edge cases (no results, pagination).
   - Add to cart, update quantities, persist cart across sessions.
   - Checkout with Stripe (payment intent lifecycle, 3DS, failure flows).
   - User registration/login, password reset, and account management.
   - Order creation, payment confirmation, fulfillment updates, refunds.
7. **How Memory Bank Supports UX:**
   - Each flow has a canonical description, acceptance criteria, and known constraints.
   - UX and technical edge cases recorded once and referenced across tickets.
