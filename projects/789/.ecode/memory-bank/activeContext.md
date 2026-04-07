# Active Context – Focus & Next Steps

## Current Focus
- Define the **Memory Bank state model** and pure reducer for calculator operations.
- Set up the React + TypeScript project skeleton and wire the Memory Bank into a provider.
- Implement a minimal calculator UI that exercises all Memory Bank actions.

## Next Steps Checklist
- [ ] Initialize React + TypeScript project (Vite or CRA).
- [ ] Create `memoryBank.ts` with:
  - [ ] State interface (currentValue, pendingOperator, previousValue, history, error).
  - [ ] Typed action definitions and `memoryBankReducer`.
  - [ ] Public helper functions (input digit, decimal, operator, equals, clear).
- [ ] Implement `MemoryBankProvider` and `useMemoryBank` hook.
- [ ] Build `Calculator` UI with display and buttons wired to Memory Bank.
- [ ] Add history panel bound to Memory Bank history.
- [ ] Write unit tests for core reducer scenarios (add, subtract, multiply, divide, divide-by-zero).
- [ ] Polish UX (keyboard support, basic styling) if time allows.
