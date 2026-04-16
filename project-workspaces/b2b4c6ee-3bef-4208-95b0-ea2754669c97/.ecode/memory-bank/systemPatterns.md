# System Architecture

## Architecture Overview
- **Frontend**: React SPA with TypeScript, responsive design system
- **Backend**: Node.js/Express API with TypeScript
- **Database**: PostgreSQL with Redis caching layer
- **Payments**: Stripe Connect for multi-vendor payouts
- **File Storage**: AWS S3 for product images
- **Email**: SendGrid for transactional notifications

## Key Design Patterns
- **Repository Pattern**: Data access abstraction
- **Event-Driven Architecture**: Order processing and notifications
- **CQRS**: Separate read/write models for product catalog
- **State Management**: Redux Toolkit for complex UI state
- **Component Composition**: Reusable UI components with theme support

## Security Considerations
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Input validation and sanitization
- Stripe webhook signature verification
- Rate limiting on API endpoints