# Build a full-stack e-commerce marketplac — Project Guidelines

## Overview
This is a Typescript project managed in E-Code IDE. This file (`ecode.md`) provides
project-specific context to the AI assistant and serves as living documentation.
It is automatically updated when the AI agent makes significant changes.

## Technology
- **Language**: Typescript
- **Entry point**: `index.ts`

## Coding Standards
- Define explicit types for function parameters and return values
- Use interfaces for object shapes, type aliases for unions/intersections
- Prefer const assertions for literal types
- Use strict TypeScript configuration
- Avoid `any` — use `unknown` when the type is truly unknown

## Patterns & Conventions
- Use generics for reusable type-safe utilities
- Define shared types in a dedicated types file
- Use discriminated unions for state management
- Leverage TypeScript's type narrowing with guards

## Project Structure
<!-- AUTO-GENERATED: The AI agent updates this section automatically after changes -->
- `index.ts`
- `package.json` — Node.js dependencies and scripts
- `backend/`
  - `tsconfig.json`
  - `src/index.ts`
  - `src/controllers/auth.controller.ts`
  - `src/controllers/orders.controller.ts`
  - `src/controllers/products.controller.ts`
  - `src/controllers/stripe.controller.ts`
  - `src/middleware/auth.middleware.ts`
  - `src/middleware/error.middleware.ts`
  - _...and 9 more files_
- `frontend/`
  - `index.html`
  - `package.json`
  - `postcss.config.js`
  - `tailwind.config.js`
  - `tsconfig.json`
  - `tsconfig.node.json`
  - `vite.config.ts`
  - `src/App.tsx`
  - _...and 20 more files_

## Dependencies & Frameworks
<!-- AUTO-GENERATED: Detected from project files -->
- Vite
- TypeScript
- Node.js (npm/yarn)
- Tailwind CSS
- `bcryptjs`
- `cors`
- `dotenv`
- `express`
- `jsonwebtoken`
- `nodemailer`
- `pg`
- `stripe`
- `@types/bcryptjs`
- `@types/cors`
- `@types/express`
- `@types/jsonwebtoken`
- `@types/node`
- `@types/nodemailer`
- `@types/pg`

## Communication Preferences
- Provide complete, working code when making changes
- Explain significant design decisions
- Suggest improvements when appropriate
- Use the project's established patterns and naming conventions

## User Preferences
<!-- Add your preferences below — the AI will follow them in all interactions -->
<!-- Examples:
- Always use TypeScript strict mode
- Prefer Tailwind CSS for styling
- Use functional components with hooks
- Write tests for new features
- Use dark mode for UI designs
-->

## Project Context
Add any project-specific notes, API keys to reference, deployment targets,
or domain knowledge the AI should be aware of when assisting you.

---
_Last auto-updated: 2026-04-17T08:47:37.684Z_
