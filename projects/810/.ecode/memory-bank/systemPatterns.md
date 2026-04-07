# System & Architecture Patterns: Memory Bank

## Architecture Overview
- **Type**: Single Page Application (SPA)
- **Layers**:
  - UI layer: React components (App, TodoList, TodoItem, Filters, Header/Footer)
  - State layer: React state + custom hooks
  - Persistence layer: Browser `localStorage` via a small repository module

## State Management Pattern
- Use React hooks (`useState`, `useEffect`) for MVP
- Centralized todo state in top-level `App` or `TodoProvider`
- Custom hook `useTodos` encapsulates:
  - In-memory state (list of todos, filter)
  - CRUD operations
  - Sync with `localStorage`

## Data Model
- `Todo`:
  - `id: string` (UUID)
  - `text: string`
  - `completed: boolean`
  - `createdAt: string` (ISO timestamp)
  - `updatedAt?: string`

## Key Technical Decisions
- **Persistence**: Local storage instead of backend DB to keep Memory Bank fully client-side.
- **Routing**: Single route for MVP; optional hash-based filter in URL later.
- **Styling**: Lightweight CSS-in-JS or module CSS; prioritize simplicity and readability.
- **Error Handling**: Graceful fallback if local storage is unavailable (in-memory only with user notice).

## Design Patterns Used
- **Container/Presentational components**: Separate business logic from UI rendering.
- **Repository pattern** for Todo persistence (abstracts `localStorage` access).
- **Custom hooks** for reuse of stateful logic (`useLocalStorage`, `useTodos`).
- **Immutable updates** to state for predictability and easier debugging.

## Extensibility Considerations
- Easy to swap `localStorage` repository with API client later.
- Room to introduce React Query or Redux if state grows.
- Components structured to accept props for theming and variants.