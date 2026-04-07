# Tech Context — Memory Bank: Counter App

## Tech Stack
- **Language:** TypeScript
- **UI Library:** React (using functional components and hooks)
- **Tooling:** Vite or Create React App (Vite recommended for speed)
- **Styling:** Minimal CSS modules or a simple utility-based stylesheet (no heavy UI framework required)

## Project Structure (proposed)
- `src/`
  - `components/`
    - `CounterDisplay.tsx`
    - `CounterControls.tsx`
    - `MemoryList.tsx`
    - `MemoryEntryItem.tsx`
  - `context/`
    - `CounterContext.tsx`
    - `MemoryBankContext.tsx`
  - `services/`
    - `memoryBankService.ts`
    - `memoryRepository.ts`
  - `models/`
    - `counter.ts`
    - `memory.ts`
  - `App.tsx`
  - `main.tsx`

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- `vite` (or `react-scripts` if CRA)
- Dev dependencies: `@types/react`, `@types/react-dom`, ESLint + Prettier (optional but recommended)

## Environment & Configuration
- No required runtime env vars for initial version.
- Optional env var for toggling persistence backend:
  - `VITE_MEMORY_STORAGE_MODE = "inmemory" | "localstorage"` (used by `memoryBankService` to select repository).

## Development Setup
- `npm install` or `yarn install` to fetch dependencies.
- `npm run dev` to start local dev server.
- `npm run build` to produce production build.
- `npm run lint` (if configured) to enforce code quality.
