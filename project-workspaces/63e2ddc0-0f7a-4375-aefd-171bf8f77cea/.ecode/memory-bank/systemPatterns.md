# System Architecture

## Architecture Overview
- **Frontend**: React SPA with TypeScript
- **State Management**: React Query + Zustand for local state
- **Routing**: React Router with protected admin routes
- **Styling**: Tailwind CSS with custom restaurant theme

## Key Technical Decisions
- Server-side rendering for SEO (Next.js)
- Real-time reservation updates via WebSocket
- Image optimization for menu photos
- Progressive Web App capabilities

## Design Patterns
- **Repository Pattern**: Data access abstraction
- **Observer Pattern**: Real-time reservation updates
- **Factory Pattern**: Menu item creation with variants
- **Strategy Pattern**: Different reservation validation rules

## Data Flow
User actions → React components → API calls → Database → Real-time updates → UI refresh