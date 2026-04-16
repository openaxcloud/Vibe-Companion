# System Architecture

## Architecture Overview
**Pattern**: Modular monolith with clear domain boundaries
**Frontend**: React SPA with TypeScript, state management via Zustand
**Backend**: Node.js/Express API with PostgreSQL database
**Payments**: Stripe Connect for multi-vendor payouts

## Key Technical Decisions
- **Authentication**: JWT with refresh tokens, role-based access control
- **State Management**: Zustand for client state, React Query for server state
- **Database**: PostgreSQL with Prisma ORM for type safety
- **File Storage**: AWS S3 for product images with CDN
- **Email**: SendGrid for transactional notifications

## Design Patterns
- Repository pattern for data access layer
- Service layer for business logic encapsulation
- Event-driven architecture for order processing
- Middleware pattern for authentication and validation
- Observer pattern for inventory updates