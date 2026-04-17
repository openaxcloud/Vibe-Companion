# System Architecture - E-Commerce Marketplace

## Architecture Overview
- **Frontend**: React SPA with TypeScript, responsive design system
- **Backend**: Node.js/Express API with TypeScript
- **Database**: PostgreSQL with Redis caching
- **Payments**: Stripe API integration with webhooks
- **File Storage**: AWS S3 for product images
- **Email**: SendGrid for transactional emails

## Key Design Patterns
- **Repository Pattern**: Data access abstraction
- **Service Layer**: Business logic separation
- **Event-Driven**: Order status updates via events
- **CQRS**: Separate read/write models for products
- **State Management**: Redux Toolkit for cart/user state

## Security Considerations
- JWT authentication with refresh tokens
- Input validation and sanitization
- Rate limiting on API endpoints
- PCI compliance via Stripe