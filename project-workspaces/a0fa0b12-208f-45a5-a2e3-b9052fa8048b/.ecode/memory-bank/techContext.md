# Tech Stack - E-Commerce Marketplace

## Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling with dark mode
- **React Query** for server state management
- **React Hook Form** with Zod validation
- **React Router** for navigation

## Backend Stack
- **Node.js** with Express and TypeScript
- **PostgreSQL** with Prisma ORM
- **Redis** for session storage and caching
- **Stripe SDK** for payment processing
- **SendGrid** for email notifications
- **Multer** for file uploads

## Environment Variables
```
DATABASE_URL, REDIS_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
SENDGRID_API_KEY, AWS_S3_BUCKET, JWT_SECRET, NODE_ENV
```

## Development Setup
- Docker Compose for local services
- ESLint + Prettier for code quality
- Husky for pre-commit hooks