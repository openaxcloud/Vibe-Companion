# Technical Stack

## Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for responsive design system
- **Zustand** for state management
- **React Query** for server state and caching
- **React Hook Form** for form handling

## Backend
- **Node.js/Express** with TypeScript
- **PostgreSQL** with Prisma ORM
- **Stripe API** for payments and Connect for vendors
- **SendGrid** for email notifications
- **JWT** for authentication

## Environment Variables
```
DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
SENDGRID_API_KEY, AWS_S3_BUCKET, REDIS_URL
```

## Development Setup
- Docker Compose for local PostgreSQL and Redis
- Stripe CLI for webhook testing
- ESLint/Prettier for code quality