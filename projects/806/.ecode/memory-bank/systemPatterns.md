# System Patterns — Memory Bank: Counter App

## Architecture Overview
- **Frontend-only SPA** built with React + TypeScript.
- **Layers**:
  - UI Layer: Presentational React components (CounterDisplay, Controls, MemoryList).
  - State Layer: React hooks + context for counter state and Memory Bank.
  - Persistence Layer: MemoryBank service using in-memory store with `localStorage` backing.

## Key Technical Decisions
- Use **React Context** + custom hooks for app-wide state (`CounterProvider`, `MemoryBankProvider`).
- Keep Memory Bank operations pure and typed through a dedicated service (`memoryBankService.ts`).
- Prefer functional updates (no class components) to keep state predictable.
- Use **localStorage** as optional persistence to demonstrate a pluggable storage backend.

## Design Patterns
- **Repository pattern** for Memory Bank storage:
  - Interface: `MemoryRepository` with `save`, `list`, `get`, `clear`.
  - Implementations: `InMemoryMemoryRepository`, `LocalStorageMemoryRepository` (wrapper around in-memory + browser storage).
- **Provider pattern** (via React Context):
  - `CounterContext` for current value and actions (`increment`, `decrement`, `reset`, `setStep`).
  - `MemoryBankContext` for memory entries and operations (`addMemory`, `restoreMemory`, `clearMemories`).
- **Command pattern-lite** for actions:
  - Encapsulate state changes as typed functions with a clear contract.
- **Modeling / DTOs**:
  - `CounterState`: `{ value: number; step: number }`.
  - `MemoryEntry`: `{ id: string; value: number; note?: string; createdAt: string }`.

## Error Handling & Edge Cases
- Gracefully handle corrupted `localStorage` data with fallback to empty memory list.
- Disallow restoring non-existent IDs and surface this safely in UI.
- Validate note length and trim whitespace before saving.
