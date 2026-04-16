# System Architecture

## Architecture Overview
- **Frontend**: React SPA with TypeScript, responsive design system
- **Backend**: Node.js/Express API with TypeScript
- **Database**: PostgreSQL with Redis caching layer
- **Payments**: Stripe integration with webhook handling
- **Storage**: AWS S3 for product images and documents

## Key Patterns
- **Component Architecture**: Atomic design with reusable UI components
- **State Management**: React Context + useReducer for cart, Tanstack Query for server state
- **Authentication**: JWT tokens with refresh token rotation
- **Payment Flow**: Stripe Elements with server-side confirmation
- **Real-time Updates**: WebSocket connections for inventory and order status

## Design Decisions
- TypeScript for type safety across full stack
- Modular monolith architecture for initial deployment
- Event-driven order processing with email queues
- Optimistic UI updates with rollback handling