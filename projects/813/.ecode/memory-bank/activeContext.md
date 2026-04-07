# Active Context – Current Focus & Next Steps

## Current Focus
- Implement the **first working slice** of the calculator with a minimal but functional Memory Bank.
- Prioritize a **correct calculation engine** and **clean, testable state logic**.
- Basic, usable UI over visual polish.

## Immediate Next Steps (Checklist)
- [ ] Initialize project with Vite + React + TypeScript.
- [ ] Set up base structure (`components`, `core`, `state`).
- [ ] Implement `calculatorEngine` with tests for basic operations and edge cases.
- [ ] Create `useCalculator` hook to orchestrate input, operations, and evaluation.
- [ ] Build UI components: `Display`, `Keypad`, `MemoryBank` (static layout first).
- [ ] Wire components to state and actions (digits, operators, `=`, `C`, `AC`).
- [ ] Implement `memoryBankService` with localStorage sync and size limit.
- [ ] Connect Memory Bank UI to state: record, list, reuse, and clear entries.
- [ ] Add basic keyboard support for digits, operators, Enter, Backspace.
- [ ] Perform manual QA on desktop and mobile viewports; refine layout.
