# Tech Context – Stack & Setup Memory

1. **Primary Stack:**
   - **Language:** TypeScript end‑to‑end.
   - **Frontend:** React (SPA) with modern tooling (likely Vite or Next.js if SSR is later chosen).
   - **Backend:** TypeScript‑compatible runtime/framework (e.g., Node.js with Express/Nest/Fastify – exact choice to be decided and stored when chosen).
2. **Frontend Tech Details to Track:**
   - Routing strategy for catalog, product details, cart, checkout, dashboard.
   - Chosen state management (React Context, Redux Toolkit, React Query, etc.).
   - UI library/design system (e.g., MUI, Chakra, Tailwind) once selected.
3. **Backend Tech Details to Track:**
   - Web framework choice and folder structure.
   - ORM / DB library (e.g., Prisma, TypeORM, Drizzle) and DB engine (e.g., Postgres).
   - Auth implementation (JWT, session‑based, OAuth provider if any).
4. **Key External Dependencies:**
   - Stripe SDKs (frontend + backend).
   - Auth helper libraries (e.g., bcrypt, JWT, or Auth provider SDK).
   - HTTP client/fetch wrappers on frontend.
5. **Environment Variables to Remember (names, not values):
   - STRIPE_PUBLIC_KEY
   - STRIPE_SECRET_KEY
   - STRIPE_WEBHOOK_SECRET
   - DATABASE_URL
   - SESSION_SECRET / JWT_SECRET
   - APP_BASE_URL / FRONTEND_URL / BACKEND_URL
6. **Dev Experience & Tooling:**
   - Package manager (npm/pnpm/yarn) decision.
   - Linting/formatting setup (ESLint, Prettier, TypeScript config).
   - Testing tools: unit (Jest/Vitest), component (React Testing Library), API tests.
7. **Deployment Context (to refine later):**
   - Hosting targets for frontend and backend.
   - Strategy for running Stripe webhooks and background jobs.
