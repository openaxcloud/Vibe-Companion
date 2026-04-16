# System Architecture

## Architecture Overview
- **Frontend**: React SPA with TypeScript, state management via Context/Zustand
- **Backend**: Node.js/Express API with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Payments**: Stripe SDK integration
- **Auth**: JWT tokens with refresh mechanism

## Key Patterns
- **Repository Pattern**: Data access abstraction
- **Service Layer**: Business logic separation
- **Event-Driven**: Order status updates trigger email notifications
- **CQRS**: Separate read/write models for product catalog
- **Middleware Chain**: Auth, validation, error handling

## Design Decisions
- Server-side rendering for SEO-critical pages
- Optimistic UI updates for cart operations
- Debounced search with caching
- Progressive image loading