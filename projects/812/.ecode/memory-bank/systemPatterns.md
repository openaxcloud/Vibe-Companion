# System Patterns & Architecture

## High-Level Architecture
- Single-page React application written in TypeScript.
- Component-based UI with a top-level `App` component orchestrating state and rendering.
- Local persistence using `localStorage` as a simple client-side data store.

## Key Technical Decisions
- **State Management**: Use React hooks (`useState`, `useEffect`) plus custom hooks (e.g., `useTodos`) to encapsulate todo logic.
- **Data Model**:
  - `Todo`: `{ id: string; title: string; description?: string; completed: boolean; createdAt: string; }`.
- **Persistence**:
  - Serialize todos array to JSON in `localStorage` on every write.
  - Hydrate initial state from `localStorage` on app load.

## Design Patterns
- **Container/Presentational Split**:
  - Container components handle state & side effects (e.g., `TodoAppContainer`).
  - Presentational components for rendering lists, items, inputs.
- **Custom Hook Pattern**:
  - `useTodos` encapsulates CRUD operations, filtering logic, and persistence.
- **Module Boundaries**:
  - `components/` for UI components.
  - `hooks/` for reusable logic.
  - `types/` for shared TypeScript interfaces.
  - `storage/` for localStorage utilities.

## Extensibility Considerations
- Easy to swap localStorage with an API client later by isolating data-access functions.
- Filtering logic kept pure to support future routing-based filters or search.
