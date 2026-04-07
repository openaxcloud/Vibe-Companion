# Tech Context & Setup

## Tech Stack
- **Language:** TypeScript
- **Framework:** React (functional components, hooks)
- **Build Tool:** Vite (or Create React App alternative) for quick dev environment.
- **Styling:** Minimal CSS modules or a single CSS file; no heavy UI framework required.

## Project Structure (Proposed)
- `src/`
  - `main.tsx` – App entry.
  - `App.tsx` – Layout and wiring of Memory Bank.
  - `components/`
    - `MemoryInput.tsx` – Input & add button.
    - `MemoryList.tsx` – List rendering.
    - `MemoryItem.tsx` – Single todo with delete.
  - `memory/`
    - `memoryTypes.ts` – Types for Memory entities.
    - `useMemoryBank.ts` – Custom hook for Memory Bank logic.
    - `memoryStorage.ts` – Optional localStorage adapter.
  - `styles/` – Global or modular styles.

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- `vite` + React plugin (if using Vite)
- Dev tooling: ESLint + Prettier (optional but recommended).

## Environment & Configuration
- No backend URL or API keys needed in initial build.
- `.env` file currently unnecessary; may add flags later, e.g.:
  - `VITE_USE_LOCAL_STORAGE=true` to toggle persistence.

## Local Development
- Install: `npm install`
- Run dev server: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
