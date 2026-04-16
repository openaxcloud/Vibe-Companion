# Technical Stack

## Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **State**: React Context, Tanstack Query, Zustand for cart
- **Forms**: React Hook Form with Zod validation
- **Routing**: React Router v6 with protected routes

## Backend
- **Runtime**: Node.js with Express and TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for sessions and cart data
- **Queue**: Bull for email processing
- **Validation**: Zod schemas shared with frontend

## Key Dependencies
```bash
# Frontend: @stripe/stripe-js, @tanstack/react-query, tailwindcss
# Backend: stripe, prisma, nodemailer, express-rate-limit
```

## Environment Variables
```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
DATABASE_URL, REDIS_URL
JWT_SECRET, EMAIL_SERVICE_API_KEY
AWS_S3_BUCKET, AWS_ACCESS_KEY
```