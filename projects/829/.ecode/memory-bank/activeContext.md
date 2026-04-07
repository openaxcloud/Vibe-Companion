# Active Context & Next Steps (Memory Bank)

## Current Focus
- Initial setup for a TypeScript React marketplace with a Node API and Stripe integration.
- Establish core domain models and basic end-to-end flow: product listing → cart → checkout → Stripe payment → order record.
- Define stable contracts (types, API shapes) before deep UI work.

## Immediate Next Steps (Checklist)
- [ ] Finalize front-end framework choice (pure React SPA vs Next-like SSR) and routing approach.
- [ ] Scaffold project structure for front-end (`src/components`, `src/pages`, `src/hooks`) and back-end (`src/domain`, `src/infrastructure`, `src/api`).
- [ ] Define core DB schema: `User`, `Product`, `ProductVariant` (optional), `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`.
- [ ] Implement basic auth (signup/login/logout, protected routes, session/JWT strategy).
- [ ] Implement read-only catalog API and UI (list, detail, search, filters).
- [ ] Implement server-side cart APIs and React hooks for cart management.
- [ ] Integrate Stripe: create PaymentIntents on checkout, handle webhooks, map to order states.
- [ ] Build minimal order management dashboard (list + detail + status update).
- [ ] Add error handling, loading states, and basic logging/monitoring.
- [ ] Document any new architectural or UX decisions back into this Memory Bank.
