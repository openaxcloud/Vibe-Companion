# Active Context: Current Focus & Next Steps

## Current Focus: Initial Setup
- Establish a clean, minimal React + TypeScript codebase for Memory Bank.
- Implement local todo state with `localStorage` persistence.
- Build core UI components to support primary flows (add, complete, delete, filter).

## Implementation Priorities
1. **Scaffold Project**
   - Initialize Vite React + TS template
   - Configure TypeScript strict mode, ESLint, Prettier
2. **Define Core Types & Storage Key**
   - Create `Todo` type and constants for storage key
3. **Implement Persistence Layer**
   - `todoRepository` with `loadTodos`, `saveTodos`, and error handling
4. **Create Custom Hooks**
   - `useLocalStorage<T>` for generic storage access
   - `useTodos` wrapping todo state + actions
5. **Build UI Components**
   - `TodoInput` with add-on-Enter behavior
   - `TodoList` & `TodoItem` with complete, edit, delete
   - `FilterBar` with All/Active/Completed
6. **Wire Up App Shell**
   - Layout, basic styling, and responsiveness
7. **Basic Testing & Polishing**
   - Unit tests for `todoRepository` and `useTodos`
   - Manual UX pass: keyboard navigation, focus states

## Short-Term TODO Checklist
- [ ] Initialize React+TS project and repository
- [ ] Add base project structure (`components/`, `hooks/`, `services/`)
- [ ] Implement `Todo` model and local storage key
- [ ] Build and integrate `useTodos` with `App`
- [ ] Implement UI for add/complete/delete/edit/filter
- [ ] Add minimal responsive styles
- [ ] Test persistence across reloads
- [ ] Prepare build and deploy to chosen static host