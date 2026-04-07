# System Architecture & Patterns

## High-Level Architecture
- **UI Layer**: React function components for layout and interaction.
- **State & Domain Logic**: A Memory Bank domain model (counter + memory list) managed via React hooks.
- **Persistence Layer**: In-memory state with optional localStorage sync.

## Key Components
- `<App>`: Top-level layout and orchestration.
- `<CounterDisplay>`: Shows current counter value.
- `<CounterControls>`: Plus and minus buttons.
- `<MemoryControls>`: Save and clear actions.
- `<MemoryList>`: Renders list of saved values with recall buttons.

## State Management Pattern
- Use **React useReducer** or **useState** for local state:
  - `counter: number`
  - `memories: number[]`
- Events/actions: `INCREMENT`, `DECREMENT`, `SAVE_MEMORY`, `RECALL_MEMORY`, `CLEAR_MEMORIES`.

## Design Patterns & Decisions
- **Container/Presentational pattern**:
  - Container handles state & domain logic.
  - Presentational components are pure and typed via props.
- **Domain-first logic**: Extract pure functions (e.g., `increment`, `saveMemory`, `clearMemories`) for easy testing.
- **Side-effect isolation**: Optional localStorage reads/writes inside a dedicated hook, e.g., `useMemoryBankStorage`.
- **Type-safety**: Strong types for state, actions, and components using TypeScript interfaces and discriminated unions.
