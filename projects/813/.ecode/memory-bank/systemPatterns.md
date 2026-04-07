# System & Architecture Patterns – Memory Bank: Calculator App

## Architecture Overview
- **Client-only SPA** built with **React + TypeScript**.
- UI composed of 3 main regions:
  - Display (current expression & result).
  - Keypad (digits, operators, control keys).
  - Memory Bank (recent calculations list).
- State handled via **React hooks**, with a dedicated **calculator state machine** pattern.

## Key Technical Decisions
- **Pure calculation engine**:
  - Implemented as isolated TypeScript module (`calculatorEngine.ts`).
  - Manages numeric operations, operator precedence, and error states (e.g., division by zero).
- **Memory Bank store**:
  - In-memory list synced to `localStorage` to persist across page reloads.
  - Limited to N entries (FIFO eviction policy).
- **Unidirectional data flow**:
  - Top-level `CalculatorApp` holds state → passes props to child components → children emit events via callbacks.

## Design Patterns
- **Container–Presenter pattern**:
  - Container components manage state and behavior.
  - Presentational components are stateless (displays, buttons, list items).
- **Command pattern (lightweight)** for keypad actions:
  - Each button maps to a **command** (digit input, operator input, clear, evaluate) handled centrally.
- **Repository-like abstraction** for Memory Bank:
  - `MemoryBankService` encapsulates read/write to `localStorage` and in-memory cache.
- **Error boundary** at app root to catch rendering errors and show a fallback screen.

## Data Model (Conceptual)
- `CalculationEntry`: `{ id, expression: string, result: string, createdAt: string }`.
- `CalculatorState`: `{ currentInput, previousValue, operator, lastResult, error }`.
- `MemoryBankState`: `{ entries: CalculationEntry[] }`.
