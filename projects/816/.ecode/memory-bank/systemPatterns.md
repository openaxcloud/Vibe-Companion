# System Patterns & Architecture

## High-Level Architecture
- Single-page application (SPA) using React + TypeScript
- No backend in initial phase; data persisted in browser `localStorage`
- Component-driven UI with a single root `<App>` managing routing-free views

## State Management
- Local component state lifted to a central `TodoProvider` using React Context
- `useReducer` for predictable state transitions (add, update, toggle, delete, setFilter)
- `useEffect` for reading/writing todos to `localStorage`

## Core Design Patterns
- **Container–Presentational**: separate stateful containers (e.g., `TodoProvider`, `TodoApp`) from stateless UI components (`TodoList`, `TodoItem`, `TodoInput`)
- **Repository-like abstraction** for persistence: `todoStorage` module wraps `localStorage` access (future-ready for server API swap)
- **Hook-based composition**: custom hooks (`useTodos`, `useFilteredTodos`) encapsulate business logic

## Error Handling & Resilience
- Graceful fallback if `localStorage` is unavailable (in-memory store)
- Defensive parsing and validation for stored JSON

## Extensibility Considerations
- Todo model designed with optional fields to support later features (tags, due dates)
- Context and reducer pattern can later support multi-list or multi-entity Memory Bank modules
