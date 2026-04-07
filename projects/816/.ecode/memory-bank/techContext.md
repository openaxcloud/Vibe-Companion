# Tech Context & Development Setup

## Tech Stack
- Language: TypeScript
- UI Library: React (with hooks)
- Build Tool: Vite (React + TS template) or Create React App (TS)
- Styling: CSS Modules or Tailwind CSS (pick one and stay consistent)
- Testing: Jest + React Testing Library (unit and component tests)

## Project Structure (proposed)
- `src/`
  - `components/` – UI components (TodoList, TodoItem, TodoInput, Layout)
  - `context/` – `TodoContext`, `TodoProvider`
  - `hooks/` – `useTodos`, `useFilteredTodos`
  - `storage/` – `todoStorage.ts` localStorage wrapper
  - `types/` – shared TypeScript interfaces (Todo, Filter)
  - `App.tsx`, `main.tsx`

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- `vite` or `react-scripts` depending on bootstrap choice
- Optional: `classnames` for conditional styling, `zod` for runtime validation

## Environment & Config
- Minimal env usage for this phase; no secrets required
- Optional env vars (future-friendly):
  - `VITE_APP_STORAGE_KEY` – key prefix for localStorage

## Dev Setup
- Node.js LTS installed
- `npm install` or `pnpm install`
- `npm run dev` – start dev server
- `npm run build` – production build
- `npm test` – run test suite
