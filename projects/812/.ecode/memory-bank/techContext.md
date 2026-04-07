# Tech Context

## Tech Stack
- **Language**: TypeScript (strict mode enabled).
- **Framework**: React (functional components + hooks).
- **Build Tooling**: Vite or Create React App (Vite preferred for speed).
- **Styling**: CSS modules or a minimal utility-first approach (e.g., simple custom CSS).

## Development Setup
- Node.js LTS and npm or pnpm.
- Scripts (example with Vite):
  - `dev`: Run local dev server with hot reload.
  - `build`: Production build.
  - `preview`: Preview production build.
  - `test`: Unit tests (if configured).

## Key Dependencies
- `react`, `react-dom`.
- `typescript` + `@types/react`, `@types/react-dom`.
- `vite` (or CRA) and associated plugins for React + TS.
- Optional: testing libraries (`vitest`/`jest`, `@testing-library/react`).

## Environment Variables
- Minimal usage since there is no backend.
- Optional env vars (for future expansion):
  - `VITE_APP_STORAGE_NAMESPACE` to prefix localStorage keys.
  - `VITE_APP_ENV` for environment-specific logging toggles.

## Project Structure (Proposed)
- `src/`
  - `main.tsx` (entry point)
  - `App.tsx` (root component)
  - `components/` (TaskList, TaskItem, TaskForm, FilterBar)
  - `hooks/` (`useTodos.ts`)
  - `storage/` (`localStorageClient.ts`)
  - `types/` (`todo.ts`)
  - `styles/` (global and component styles)
