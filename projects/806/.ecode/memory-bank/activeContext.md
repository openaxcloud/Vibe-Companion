# Active Context — Current Focus & Next Steps

## Current Focus
- Set up the project skeleton and core Memory Bank abstractions for the counter app.
- Implement a minimal vertical slice:
  - Display counter.
  - Increment/decrement/reset.
  - Save current value with a note into Memory Bank.
  - List saved memories (no restore logic yet).

## Next Steps Checklist
- [ ] Initialize React + TypeScript project (preferably with Vite).
- [ ] Create `CounterState` and `MemoryEntry` models.
- [ ] Implement `CounterContext` with increment/decrement/reset/setStep.
- [ ] Implement `MemoryRepository` interface and in-memory implementation.
- [ ] Implement `memoryBankService` using the repository.
- [ ] Create `MemoryBankContext` exposing memory operations and state.
- [ ] Build basic UI components: CounterDisplay, CounterControls, MemoryList.
- [ ] Wire components to contexts to complete the first vertical slice.
- [ ] Add restore-from-memory behavior and confirm state sync.
- [ ] Optionally add `localStorage`-backed repository and toggle via env.
