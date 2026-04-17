# Technical Stack

## Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling and dev server
- **Redux Toolkit** + RTK Query for state management
- **React Router v6** for client-side routing
- **Tailwind CSS** for styling with dark mode support
- **React Hook Form** + Zod for form validation
- **Stripe Elements** for payment UI components

## Backend Stack
- **Node.js** with Express and TypeScript
- **PostgreSQL** with Prisma ORM
- **Redis** for session storage and caching
- **Stripe API** for payment processing
- **SendGrid** for email notifications
- **Multer** + AWS SDK for file uploads

## Key Dependencies
```json
"@stripe/stripe-js", "@reduxjs/toolkit", "prisma", "express-rate-limit", "bcryptjs", "jsonwebtoken", "zod", "nodemailer"
```

## Environment Variables
```
DATABASE_URL, REDIS_URL, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, JWT_SECRET, SENDGRID_API_KEY, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
```