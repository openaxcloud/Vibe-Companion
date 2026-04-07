# Tech Context: Calculator App – Memory Bank

## Core Tech Stack
- **Language**: TypeScript (strict mode enabled).
- **Framework**: React (function components + hooks).
- **Build Tool**: Vite or Create React App (prefer Vite for speed).
- **Styling**: CSS Modules or a lightweight CSS framework (e.g., Tailwind or simple custom CSS).

## Project Structure (Proposed)
- `src/`
  - `main.tsx` – App bootstrap.
  - `App.tsx` – Root layout.
  - `features/calculator/`
    - `Calculator.tsx`
    - `Display.tsx`
    - `Keypad.tsx`
    - `hooks/useCalculator.ts`
    - `logic/calculatorLogic.ts` (pure functions)
  - `styles/` – Global and component styles.
  - `tests/` – Unit and component tests.

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- `@types/react`, `@types/react-dom`
- Dev/test: `vitest` or `jest`, `@testing-library/react`, `@testing-library/jest-dom`

## Environment & Configuration
- No external APIs needed; runs entirely in the browser.
- `.env` likely minimal; may only contain tooling-related vars (e.g., `VITE_APP_NAME` if desired).
- `tsconfig.json` for strict typing, JSX config, path aliases if needed.

## Development Setup
- Install dependencies: `npm install` or `yarn install`.
- Run dev server: `npm run dev`.
- Run tests: `npm test` or `npm run test` (depending on chosen runner).
- Build for production: `npm run build` → static assets for deployment.
