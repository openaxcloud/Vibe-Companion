# Active Context & Next Steps

## Current Focus
- Establish a clean, strongly-typed Memory Bank for todo items.
- Implement minimal UI to add and delete items against this Memory Bank.
- Keep architecture simple but obviously extensible (edit, persistence, filters later).

## Implementation Checklist
- [ ] Initialize React + TypeScript project (e.g., Vite template).
- [ ] Define `Memory` and state types in `memoryTypes.ts`.
- [ ] Implement `useMemoryBank` hook:
  - [ ] Hold an array of `Memory`.
  - [ ] Implement `addMemory(text)` with validation and id generation.
  - [ ] Implement `deleteMemory(id)`.
- [ ] Build `MemoryInput` component:
  - [ ] Controlled input field and Add button.
  - [ ] Call `addMemory` on submit/Enter.
- [ ] Build `MemoryList` & `MemoryItem` components:
  - [ ] Render memories with keys.
  - [ ] Wire delete button to `deleteMemory`.
- [ ] Assemble `App.tsx` to use `useMemoryBank` and render components.
- [ ] Add minimal styling and basic accessibility (labels, focus states).
- [ ] (Optional) Implement `memoryStorage.ts` to sync Memory Bank with localStorage.
