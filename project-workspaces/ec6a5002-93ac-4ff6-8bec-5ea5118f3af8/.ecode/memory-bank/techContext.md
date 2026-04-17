# Technical Context

## Tech Stack
- **Frontend**: React 18, TypeScript 5.x, Vite
- **State Management**: Redux Toolkit, React Query
- **UI Framework**: Material-UI or Ant Design
- **Drag & Drop**: @dnd-kit/core for modern DnD
- **Charts**: Recharts for Gantt and analytics
- **Real-time**: Socket.io-client
- **Routing**: React Router v6
- **Forms**: React Hook Form with Zod validation

## Development Setup
```bash
npm create vite@latest projectflow -- --template react-ts
npm install @reduxjs/toolkit react-redux @tanstack/react-query
npm install @dnd-kit/core @dnd-kit/sortable
```

## Key Dependencies
- `@dnd-kit/core` - Modern drag and drop
- `recharts` - Gantt chart visualization
- `socket.io-client` - Real-time updates
- `date-fns` - Date manipulation for sprints

## Environment Variables
- `VITE_API_URL` - Backend API endpoint
- `VITE_WS_URL` - WebSocket server URL