# System Patterns: Calculator App – Memory Bank

## High-Level Architecture
- **Client-only SPA** built with React + TypeScript.
- Single main page with a **Calculator** feature module.
- Logic and presentation separated: pure calculation logic isolated from React components.

## Component Structure (Proposed)
- `<App>`: Root component; sets global layout and theme.
- `<Calculator>`: Manages calculator state and orchestrates subcomponents.
- `<Display>`: Shows current input, previous value, and operation.
- `<Keypad>`: Renders numeric, operation, and control buttons.
- `<Key>`: Reusable button component with styling and accessibility.

## State & Logic Patterns
- Use **React hooks** with a dedicated `useCalculator` hook containing state machine–like logic.
- Represent calculator state with a typed model: `{ currentValue, previousValue, operation, overwrite }`.
- Implement pure utility functions for operations: `calculate(nextDigit)`, `applyOperator`, etc.

## Design Patterns
- **Container–Presentational**: `<Calculator>` as container; `<Display>` and `<Keypad>` as dumb/presentational where possible.
- **Command pattern (lightweight)**: Map button presses / key events to semantic actions (`"DIGIT"`, `"OPERATOR"`, `"EQUALS"`, `"CLEAR"`).
- **Single Source of Truth**: Only one place holds the canonical calculator state; derived values computed as needed.

## Error & Edge Case Handling
- Centralized handling for invalid operations (e.g., divide by zero) in the calculation logic layer.
- Keep floating-point quirks controlled via formatting and rounding helpers.

## Testing Strategy
- Unit tests for pure calculation functions and state transitions.
- Component tests for `<Calculator>` interaction flows.
- Minimal E2E/interaction tests (e.g., via Playwright/Cypress) for core happy paths.
