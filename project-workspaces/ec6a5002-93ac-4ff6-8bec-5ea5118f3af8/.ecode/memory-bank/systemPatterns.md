# System Architecture Patterns

## Architecture Overview
- **Frontend**: React with TypeScript, component-based architecture
- **State Management**: Redux Toolkit for complex state, React Query for server state
- **Real-time**: WebSocket connections for live updates and collaboration
- **Drag & Drop**: React DnD library for Kanban board interactions

## Key Technical Decisions
- **Modular Design**: Feature-based folder structure (boards, sprints, tasks, users)
- **Event-Driven**: Action-based state updates for real-time synchronization
- **Optimistic Updates**: Immediate UI feedback with server reconciliation
- **Component Composition**: Reusable UI components with consistent design system

## Design Patterns
- **Container/Presenter**: Separate data logic from UI components
- **Observer Pattern**: Real-time updates via WebSocket subscriptions
- **Command Pattern**: Undo/redo functionality for task operations
- **Factory Pattern**: Dynamic workflow and board configuration