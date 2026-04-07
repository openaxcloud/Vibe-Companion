# Active Context – Current Focus & Next Steps

## Current Focus
- Implement a **minimal, working Memory Bank counter** with clean TypeScript types and React components.
- Keep logic simple and well-structured to serve as a base for future enhancements (e.g., labels for memories, timestamps).

## Immediate Next Steps (Checklist)
- [ ] Initialize React + TypeScript app (Vite or CRA).
- [ ] Configure TypeScript with strict type checking.
- [ ] Define domain types & logic in `domain/memoryBank.ts`:
  - [ ] State shape: `{ counter: number; memories: number[] }`
  - [ ] Pure functions for increment, decrement, save, recall, clear.
- [ ] Implement `useMemoryBank` hook using `useReducer`.
- [ ] Build UI components:
  - [ ] `CounterDisplay` (read-only value).
  - [ ] `CounterControls` (+ / – buttons wired to hook actions).
  - [ ] `MemoryControls` (Save, Clear).
  - [ ] `MemoryList` (list of values with recall buttons).
- [ ] Wire everything in `App.tsx` and verify core flows.
- [ ] Add basic CSS for layout and responsive design.
- [ ] Optionally add localStorage persistence for state.
