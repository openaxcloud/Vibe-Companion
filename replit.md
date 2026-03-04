# Vibe Platform - Full-Screen IDE SaaS

## Overview
A full-screen responsive IDE SaaS platform (web/tablet/mobile). Users can write, save, and execute code with a GitHub-dark themed interface, AI coding assistant, and real-time log streaming.

## Architecture
- **Frontend**: React + Vite + TailwindCSS v4, responsive design (desktop/tablet/mobile)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + WebSockets
- **Code Execution**: Local sandboxed `child_process.spawn` with security pattern blocking, 10s timeout, 64MB memory limit
- **Auth**: Session-based (express-session, bcrypt), `trust proxy` enabled for Replit
- **AI**: OpenAI via Replit AI Integrations (`gpt-5-mini`), streaming SSE responses

## Database Schema (PostgreSQL)
- `users`: id, email, password (hashed), display_name
- `projects`: id, user_id, name, language, is_demo, updated_at
- `files`: id, project_id, filename, content, updated_at
- `runs`: id, project_id, user_id, status, language, code, stdout, stderr, exit_code, started_at, finished_at

## Key Features
- Email/password authentication with session cookies
- CRUD projects (create, list, duplicate, delete)
- Full IDE layout: file explorer sidebar, multi-file tabs, auto-save, dirty indicators
- AI coding assistant panel (OpenAI streaming, file context injection)
- Remote code execution (JavaScript, TypeScript, Python) via local sandbox
- Real-time logs via WebSocket in resizable terminal panel
- Console + Preview (iframe) bottom tabs
- Run/Stop buttons with execution state indication
- Project settings dialog (rename, change language)
- Dark mode with GitHub-dark theme
- Public demo project (read-only)
- Rate limiting: 50 req/15min on auth, 100 req/min on API, 10 req/min on execution

## API Routes
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `PATCH /api/projects/:id` - Update project (name, language)
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/duplicate` - Duplicate project
- `GET /api/projects/:projectId/files` - List files
- `POST /api/projects/:projectId/files` - Create file
- `PATCH /api/files/:id` - Update file content or rename
- `DELETE /api/files/:id` - Delete file
- `POST /api/projects/:projectId/run` - Execute code
- `GET /api/demo/project` - Get demo project
- `POST /api/demo/run` - Execute demo code
- `POST /api/ai/chat` - AI assistant (streaming SSE)

## WebSocket
- Path: `/ws?projectId=<id>`
- Messages: `run_log` (real-time output), `run_status` (started/completed/failed)

## Important Files
- `shared/schema.ts` - Drizzle schema + Zod insert schemas
- `server/routes.ts` - All API routes (auth, projects, files, runs, AI, demo)
- `server/storage.ts` - IStorage interface + DatabaseStorage implementation
- `server/executor.ts` - Sandboxed code execution engine
- `server/index.ts` - Express setup (trust proxy, middleware)
- `client/src/pages/Project.tsx` - Full IDE page (editor, tabs, sidebar, terminal, preview, AI toggle)
- `client/src/pages/Dashboard.tsx` - Project list with search + quick actions
- `client/src/pages/Auth.tsx` - Login/register page (full-screen centered)
- `client/src/pages/Settings.tsx` - User settings
- `client/src/pages/DemoProject.tsx` - Read-only demo IDE
- `client/src/components/AIPanel.tsx` - AI chat panel with streaming + code blocks
- `client/src/hooks/use-websocket.ts` - WebSocket hook for real-time logs
- `client/src/hooks/use-auth.ts` - Auth state management hook
- `client/src/lib/queryClient.ts` - API request helper with JSON error parsing
- `client/src/lib/auth.ts` - Auth API functions

## Tech Stack
- React 19, Wouter, TanStack Query
- Express 5, express-session, bcrypt, express-rate-limit
- Drizzle ORM, PostgreSQL
- OpenAI SDK (via Replit AI Integrations)
- WebSocket (ws library)
- JetBrains Mono font for code editor
- GitHub-dark theme (#0d1117 bg, #161b22 panels, #30363d borders, #58a6ff accent)
- Python 3.11 installed as system module

## IDE Layout (Desktop)
- Top bar: back, sidebar toggle, project name, run/stop, AI toggle, settings menu
- Left sidebar (220-260px, collapsible): file explorer with create/rename/delete
- Center: code editor with tabs + bottom panel (console/preview, resizable)
- Right panel (300-340px, toggleable): AI assistant chat
- Mobile: sidebar and AI panel as overlays
