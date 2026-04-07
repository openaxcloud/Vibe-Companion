# Active Context & Next Steps

## Current Focus
- Initial application setup and foundation for the todo feature.
- Establish a clear React + TypeScript structure with a simple but extensible data model.
- Implement local storage persistence via a small abstraction layer.

## Immediate Next Steps (Checklist)
- [ ] Initialize project with Vite (React + TypeScript template).
- [ ] Configure TypeScript strict mode and basic linting (ESLint + simple rules).
- [ ] Define `Todo` type and shared interfaces in `types/todo.ts`.
- [ ] Implement `useTodos` hook with in-memory CRUD and filtering.
- [ ] Add `localStorage` persistence helper and integrate into `useTodos`.
- [ ] Create core UI components: TaskForm, TaskList, TaskItem, FilterBar.
- [ ] Wire components in `App.tsx` to support main flows (add, toggle, edit, delete, filter).
- [ ] Add minimal responsive styling for desktop and mobile.
- [ ] Manually test flows across modern browsers.
- [ ] Document any emerging patterns or constraints back into this Memory Bank.
