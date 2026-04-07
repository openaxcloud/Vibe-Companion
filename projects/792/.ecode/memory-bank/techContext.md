# Tech Context & Development Setup

## Tech Stack
- **Language**: TypeScript
- **Framework**: React (functional components, hooks)
- **Build Tool**: Vite or Create React App (TS template)
- **Styling**: Minimal CSS (module or simple global stylesheet)
- **Testing**: Jest + React Testing Library (optional but recommended)

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- `@types/react`, `@types/react-dom`
- `vite` + `@vitejs/plugin-react` (if using Vite) or CRA equivalents

## Project Structure (suggested)
- `src/`
  - `main.tsx` – React entry point
  - `App.tsx` – Main layout & state container
  - `components/`
    - `CounterDisplay.tsx`
    - `CounterControls.tsx`
    - `MemoryControls.tsx`
    - `MemoryList.tsx`
  - `domain/`
    - `memoryBank.ts` (pure functions & types)
  - `hooks/`
    - `useMemoryBank.ts` (state & reducer)

## Env & Config
- No required environment variables for initial version.
- Optional: `VITE_STORAGE_KEY` if customizing localStorage key.
- TypeScript config tuned for strict mode: `"strict": true`.

## Dev Setup
- `npm install`
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm run test` – run tests (if configured)
