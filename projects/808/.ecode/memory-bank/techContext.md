# Tech Stack & Development Context

## Frontend Stack
- Language: TypeScript.
- Framework: React (SPA, hooks-based).
- State Management: React Query or Redux Toolkit (for server state + cache), plus React Context for UI state.
- Routing: React Router.
- Styling: CSS-in-JS or utility CSS (e.g., Tailwind) for rapid layout.

## Real-Time Layer
- WebSocket client (native browser WebSocket or library wrapper).
- Event abstraction: custom event bus module (subscribe/publish, auto-reconnect).

## Build & Tooling
- Bundler: Vite or Webpack.
- Linting/Formatting: ESLint, Prettier.
- Testing: Jest + React Testing Library for components and hooks.

## Key Dependencies (likely)
- axios or fetch wrapper for REST API calls.
- date-fns/dayjs for timestamps.
- File upload helper (e.g., browser APIs + custom service client).

## Environment Variables (examples)
- `VITE_API_BASE_URL` – REST API endpoint.
- `VITE_WS_URL` – WebSocket server URL.
- `VITE_FILE_UPLOAD_URL` – file upload endpoint/presign service.
- `VITE_SENTRY_DSN` – (optional) error tracking.
