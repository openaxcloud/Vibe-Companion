# Memory Bank – Active Focus & Next Steps

## Current High‑Level Focus
- Use this Memory Bank to keep the e‑commerce marketplace vision and patterns consistent across future implementation prompts.
- Treat Stripe‑based checkout, authenticated cart, and order management dashboard as core pillars.

## Durable Assumptions to Apply by Default
- Marketplace semantics: support multiple sellers eventually, but admin‑managed catalog is acceptable early on.
- Cart is logically tied to authenticated users; guest carts may exist but are lower priority.
- Payments must be idempotent and reconciled via Stripe webhooks; order status depends on PaymentIntent status.

## Next Steps Checklist (for future work)
- [ ] Define concrete backend framework (e.g., Express + routing structure) while staying TypeScript‑first.
- [ ] Specify database choice and map the core domain models into schema.
- [ ] Detail auth strategy (JWT vs sessions) and route protection rules.
- [ ] Outline frontend route hierarchy and component structure for catalog, cart, checkout, and dashboard.
- [ ] Design end‑to‑end checkout sequence with Stripe (API calls, client steps, webhook handling).
- [ ] Extend Memory Bank as major decisions are locked in (DB, framework, auth flavor, deployment).
