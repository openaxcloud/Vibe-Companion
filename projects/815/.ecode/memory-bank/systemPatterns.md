# System Design & Patterns – Memory Bank

## Architecture Overview
- **Type:** Client-only SPA (no backend) with a clear separation between Memory Bank state and UI.
- **Layers:**
  - Presentation: React components for layout and interaction.
  - Domain: "Memory Bank" module managing todo entities and operations.
  - Infrastructure: Optional adapter for browser localStorage.

## Memory Bank Model
- `Memory` (todo) shape: `{ id: string; text: string; createdAt: string; }`.
- State: `MemoryBankState = Memory[]`.
- Core operations:
  - `addMemory(text: string): MemoryBankState`
  - `deleteMemory(id: string): MemoryBankState`

## Key Patterns
- **Container/Presenter:**
  - Container component owns Memory Bank state and passes props to presentational components.
- **Custom Hook:**
  - `useMemoryBank()` to encapsulate state logic, add/delete handlers, and (optionally) persistence.
- **Functional Updates:**
  - Use React state functional updates to avoid stale closures when adding/deleting.
- **Immutable State:**
  - Treat Memory Bank as an immutable collection; each operation returns a new array.

## Data Flow
- Unidirectional: input → handler (Memory Bank op) → state update → React re-render.
- No global store initially; exploration of context or external store left for later.

## Error & Edge Handling
- Ignore purely whitespace entries.
- Optionally trim text and cap length (e.g., 200 chars) for clarity.
