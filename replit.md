# Vibe Platform - Mobile IDE SaaS Companion

## Overview
A mobile-first web application that serves as a companion IDE for a vibe coding platform. Users can write, save, and execute code remotely from their phones with a GitHub-dark themed interface.

## Architecture
- **Frontend**: React + Vite + TailwindCSS v4, mobile-first responsive design (max-w-md centered, phone bezel on desktop)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + WebSockets
- **Code Execution**: Local sandboxed `child_process.spawn` with security pattern blocking, 10s timeout, 64MB memory limit
- **Auth**: Session-based (express-session, bcrypt)

## Database Schema (PostgreSQL)
- `users`: id, email, password (hashed), display_name
- `projects`: id, user_id, name, language, is_demo, updated_at
- `files`: id, project_id, filename, content, updated_at
- `runs`: id, project_id, user_id, status, language, code, stdout, stderr, exit_code, started_at, finished_at

## Key Features
- Email/password authentication with session cookies
- CRUD projects (create, list, duplicate, delete)
- Multi-file editor with tabs, auto-save (2s debounce), dirty indicators
- File explorer sidebar (create, rename, delete files)
- Remote code execution (JavaScript, TypeScript, Python) via local sandbox
- Real-time logs via WebSocket in resizable terminal panel
- Run/Stop buttons with execution state indication
- Project settings dialog (rename, change language)
- Dark/light mode toggle
- Public demo project (read-only)
- Rate limiting: 20 req/15min on auth, 100 req/min on API, 10 req/min on execution
- GitHub-dark theme (#0d1117 bg, #161b22 panels, #30363d borders, #58a6ff accent)

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
- `PATCH /api/files/:id` - Update file content or rename (accepts {content} or {filename})
- `DELETE /api/files/:id` - Delete file
- `POST /api/projects/:projectId/run` - Execute code
- `GET /api/demo/project` - Get demo project
- `POST /api/demo/run` - Execute demo code

## WebSocket
- Path: `/ws?projectId=<id>`
- Messages: `run_log` (real-time output), `run_status` (started/completed/failed)

## Important Files
- `shared/schema.ts` - Drizzle schema + Zod insert schemas
- `server/routes.ts` - All API routes
- `server/storage.ts` - IStorage interface + DatabaseStorage implementation
- `server/executor.ts` - Sandboxed code execution engine
- `client/src/pages/Project.tsx` - IDE page (editor, tabs, sidebar, terminal)
- `client/src/pages/Dashboard.tsx` - Project list with search + quick actions
- `client/src/pages/Auth.tsx` - Login/register page
- `client/src/pages/Settings.tsx` - User settings
- `client/src/pages/DemoProject.tsx` - Read-only demo IDE
- `client/src/hooks/use-websocket.ts` - WebSocket hook for real-time logs
- `client/src/hooks/use-auth.ts` - Auth state management hook

## Tech Stack
- React 19, Wouter, TanStack Query, Framer Motion
- Express 5, express-session, bcrypt, express-rate-limit
- Drizzle ORM, PostgreSQL
- WebSocket (ws library)
- JetBrains Mono + Plus Jakarta Sans fonts
- Python 3.11 installed as system module
