# System Architecture

## Architecture Overview
**Frontend**: React SPA with TypeScript, responsive design system
**Backend**: Node.js/Express API with TypeScript
**Database**: PostgreSQL with Redis for caching/sessions
**Payments**: Stripe Connect for multi-vendor payouts
**Storage**: AWS S3 for product images
**Email**: SendGrid for transactional notifications

## Key Design Patterns
- **Repository Pattern**: Data access abstraction for products, orders, users
- **Strategy Pattern**: Payment processing, notification delivery
- **Observer Pattern**: Order status changes trigger email notifications
- **Factory Pattern**: Email template generation based on order events

## Technical Decisions
- **State Management**: Redux Toolkit for complex cart/checkout state
- **Authentication**: JWT with refresh tokens, role-based access control
- **API Design**: RESTful with GraphQL for complex product queries
- **Caching Strategy**: Redis for session data, product catalog caching
- **Real-time Updates**: WebSocket connections for order status updates

## Security Considerations
- PCI DSS compliance through Stripe
- Input validation and sanitization
- Rate limiting on API endpoints
- HTTPS enforcement