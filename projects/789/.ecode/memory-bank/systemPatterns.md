# System & Pattern Overview – Memory Bank Calculator

## High-Level Architecture
- **React (view layer)** renders the calculator UI and subscribes to Memory Bank state.
- **Memory Bank module** encapsulates all calculator logic and state transitions.
- Communication pattern: **unidirectional data flow** – UI dispatches events → Memory Bank updates state → UI re-renders.

## Key Technical Decisions
- Implement Memory Bank as a **TypeScript module** using:
  - A pure reducer function (`memoryBankReducer`) for state transitions.
  - A thin **service/facade** exposing helper methods (e.g., `inputDigit`, `applyOperator`, `evaluate`, `clear`).
- Use **React Context + custom hook** to provide Memory Bank state and dispatch to components.
- All arithmetic logic and validation (e.g., divide-by-zero) live inside the Memory Bank, not the components.

## Design Patterns
- **Reducer pattern**: predictable updates driven by typed actions (`INPUT_DIGIT`, `SET_OPERATOR`, `EVALUATE`, `CLEAR`, etc.).
- **Facade pattern**: Memory Bank API hides internal state shape from the UI.
- **State machine flavor**: implicit states ("idle", "enteringFirst", "enteringSecond", "showingResult") guide transitions.
- **Single source of truth**: the Memory Bank is the only authority on calculator values and history.
