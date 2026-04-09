# rest-express

## Overview

This is a React Application built with modern web technologies. It provides a full-stack development experience with React ^18.3.1 with TypeScript on the frontend and Express.js on the backend.

## System Architecture

### Frontend Architecture

- **Framework**: React ^18.3.1 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Theme System**: Custom theme provider with light/dark mode support

### Backend Architecture

- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Database Provider**: Neon serverless PostgreSQL
- **External APIs**: OpenAI API for AI features, Stripe for payments, SendGrid for email, AWS S3 for storage, Passport.js for authentication
- **Session Management**: connect-pg-simple for PostgreSQL session storage

### Database Schema

- Schema validation using Drizzle-Zod for type-safe operations
- See `shared/schema.ts` for complete table definitions

## Key Conventions

1. Use TypeScript strict mode for all new files
2. Prefer functional components with hooks over class components
3. Use Tailwind CSS utility classes for styling; use shadcn/ui components where available
4. Always include TypeScript types for function parameters and return values
5. Handle errors gracefully with try-catch and user-friendly messages
6. Use environment variables for all secrets and configuration

## Scripts

- `npm run dev`: NODE_ENV=development tsx server/index.ts
- `npm run build`: vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
- `npm run start`: NODE_ENV=production node dist/index.js
- `npm run check`: tsc
- `npm run db:push`: drizzle-kit push

## Development Workflow

- This file (`ecode.md`) is automatically read by the E-Code AI Agent on every conversation
- Edit this file to customize the Agent's behavior, coding style, and project understanding
- The Agent will update this file when it makes significant architectural changes
- Delete this file and start a new conversation to regenerate it from scratch
