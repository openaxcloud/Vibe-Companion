# Tech Context – Memory Bank: Calculator App

## Tech Stack
- **Language**: TypeScript (strict mode where feasible).
- **Framework**: React (functional components + hooks).
- **Bundler/Dev Server**: Vite or Create React App (preferred: **Vite** for speed).
- **Styling**: CSS modules or simple utility classes (no heavy UI framework in v1).

## Project Structure (Proposed)
- `src/`
  - `components/`
    - `Display.tsx`
    - `Keypad.tsx`
    - `MemoryBank.tsx`
  - `core/`
    - `calculatorEngine.ts`
    - `memoryBankService.ts`
  - `state/`
    - `useCalculator.ts`
  - `App.tsx`
  - `main.tsx`

## Key Dependencies
- `react`, `react-dom` (core UI).
- `typescript` (static typing).
- `vite`, `@vitejs/plugin-react` (build + dev environment).
- Optional: `eslint`, `prettier` for linting and formatting.

## Environment & Configuration
- No backend; no secret environment variables needed.
- Optional env vars for build-time configuration (with sane defaults):
  - `VITE_MEMORY_BANK_SIZE` – max number of stored calculations (e.g., 10).
- Browsers: target **modern evergreen browsers** (Chrome, Edge, Firefox, Safari).

## Development Setup
- `npm install` or `yarn install`.
- `npm run dev` – start dev server.
- `npm run build` – production build.
- `npm run lint` / `npm run test` – if linting/tests are configured.
