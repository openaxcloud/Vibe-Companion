# Tech Stack

## Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Query** for server state
- **React Hook Form** for form management
- **Zustand** for client state

## Backend
- **Node.js/Express** with TypeScript
- **Prisma** ORM with PostgreSQL
- **Stripe SDK** for payments
- **Nodemailer** for email notifications
- **JWT** for authentication
- **Zod** for validation

## Key Dependencies
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
npm install @tanstack/react-query zustand
npm install prisma @prisma/client
```

## Environment Variables
```
STRIPE_SECRET_KEY=sk_...
STRIPE_PUBLISHABLE_KEY=pk_...
DATABASE_URL=postgresql://...
JWT_SECRET=...
EMAIL_SERVICE_API_KEY=...
```