# Tech Context & Setup: Memory Bank

## Tech Stack
- Language: **TypeScript**
- UI Library: **React** (with functional components & hooks)
- Bundler/Dev Tooling: **Vite** (or Create React App if preferred)
- Styling: CSS Modules or simple utility classes (e.g., minimal Tailwind) – MVP assumes CSS Modules

## Project Structure (proposed)
- `src/`
  - `main.tsx` – React entry
  - `App.tsx` – Root component
  - `components/`
    - `TodoInput.tsx`
    - `TodoList.tsx`
    - `TodoItem.tsx`
    - `FilterBar.tsx`
  - `hooks/`
    - `useTodos.ts`
    - `useLocalStorage.ts`
  - `services/`
    - `todoRepository.ts` (localStorage abstraction)
  - `types/`
    - `todo.ts` (Todo interface)
  - `styles/` – global and module CSS

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- `vite`, `@vitejs/plugin-react` (if using Vite)
- Dev tooling: `eslint`, `prettier` (recommended), `vitest`/`jest` for tests

## Local Development
- Commands (Vite-based example):
  - `npm install`
  - `npm run dev` – start dev server
  - `npm run build` – production build
  - `npm run preview` – preview production build
  - `npm test` – run unit tests (if configured)

## Environment Variables
- For MVP, no external services needed; `.env` usage is minimal.
- Optional variables:
  - `VITE_APP_NAME=Memory Bank`
  - `VITE_STORAGE_KEY=memory-bank-todos`

## Build & Deployment
- Output: Static assets (HTML, JS, CSS)
- Hosting: Any static host (Vercel, Netlify, GitHub Pages, S3+CloudFront)
- CI (optional): GitHub Actions to run lint/test/build on push.