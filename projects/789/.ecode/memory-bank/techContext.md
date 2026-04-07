# Tech Context – Memory Bank Calculator

## Stack
- **Language**: TypeScript
- **UI Framework**: React (functional components, hooks)
- **Build Tooling**: Vite or Create React App (TS template)
- **Styling**: Minimal CSS / CSS Modules / Tailwind (any small choice is fine)

## Core Modules
- `memoryBank.ts` – defines state types, reducer, and public API.
- `MemoryBankProvider.tsx` – React Context provider and custom `useMemoryBank()` hook.
- `Calculator.tsx` – top-level UI component wiring buttons to Memory Bank.
- `Display.tsx`, `Keypad.tsx`, `HistoryPanel.tsx` – presentational components.

## Key Dependencies
- `react`, `react-dom`
- `typescript`
- Dev tooling: `vite` or `react-scripts`, plus `@types/react` etc.
- Optional: `jest` / `vitest` for unit tests of Memory Bank logic.

## Environment & Configuration
- No external services or runtime secrets required.
- Standard `.env` only for build-time config if needed (e.g., `VITE_APP_ENV=dev`).
- TypeScript strict mode recommended for safer Memory Bank state handling.
