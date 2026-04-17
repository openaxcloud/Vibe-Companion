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
- `postcss.config.js` — Build/tool configuration
- `tailwind.config.js` — Build/tool configuration
- `tsconfig.json` — TypeScript configuration
- `tsconfig.node.json`
- `vite.config.ts` — Build/tool configuration
- `public/`
  - `index.html`
- `server/`
  - `package.json`
  - `tsconfig.json`
  - `src/index.ts`
  - `src/config/db.ts`
  - `src/controllers/authController.ts`
  - `src/controllers/cartController.ts`
  - `src/controllers/orderController.ts`
  - `src/controllers/productController.ts`
  - _...and 14 more files_
- `src/`
  - `App.tsx`
  - `index.css`
  - `main.tsx`
  - `vite-env.d.ts`
  - `components/AuthForm.tsx`
  - `components/CartItem.tsx`
  - `components/Footer.tsx`
  - `components/Header.tsx`
  - _...and 21 more files_

## Dependencies & Frameworks
<!-- AUTO-GENERATED: Detected from project files -->
- TypeScript
- Node.js (npm/yarn)
- Vite
- Tailwind CSS
- `@heroicons/react`
- `@stripe/react-stripe-js`
- `@stripe/stripe-js`
- `axios`
- `lucide-react`
- `react`
- `react-dom`
- `react-hook-form`
- `react-query`
- `react-router-dom`
- `zod`
- `@types/react`
- `@types/react-dom`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`

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
_Last auto-updated: 2026-04-17T05:12:59.926Z_
