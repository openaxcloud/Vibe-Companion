# Build an intelligent AI chatbot with — Project Guidelines

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
- `vite.config.ts` — Build/tool configuration
- `public/`
  - `index.html`
- `src/`
  - `App.tsx`
  - `index.css`
  - `main.tsx`
  - `components/ChatMessage.tsx`
  - `components/Sidebar.tsx`
  - `lib/api.ts`
  - `pages/ChatPage.tsx`

## Dependencies & Frameworks
<!-- AUTO-GENERATED: Detected from project files -->
- Tailwind CSS
- Node.js (npm/yarn)
- Vite
- `axios`
- `date-fns`
- `jspdf`
- `lucide-react`
- `openai`
- `react`
- `react-dom`
- `react-markdown`
- `react-router-dom`
- `rehype-raw`
- `remark-gfm`
- `uuid`
- `@types/jspdf`
- `@types/react`
- `@types/react-dom`

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
_Last auto-updated: 2026-04-15T05:07:59.590Z_
