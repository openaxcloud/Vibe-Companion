# System Architecture

## Architecture Overview
- **Frontend**: React SPA with TypeScript, responsive design system
- **Backend**: Node.js/Express API with TypeScript
- **Database**: PostgreSQL with Redis caching
- **Payments**: Stripe Connect for multi-vendor payouts
- **File Storage**: AWS S3 for product images
- **Email**: SendGrid for transactional notifications

## Key Patterns
- **Repository Pattern**: Data access abstraction
- **Event-Driven Architecture**: Order status updates, inventory changes
- **CQRS**: Separate read/write models for product catalog
- **State Management**: Redux Toolkit for complex cart/checkout state
- **Component Composition**: Reusable UI components with design tokens

## Security
- JWT authentication with refresh tokens
- Stripe webhook signature verification
- Input validation and sanitization