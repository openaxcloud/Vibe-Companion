# Vibe Platform - Mobile Companion App

## Overview
A mobile-first web application that serves as a companion to a vibe coding platform. Users can write, save, and execute code remotely from their phones.

## Architecture
- **Frontend**: React + Vite + TailwindCSS v4, mobile-first responsive design (max-w-md centered)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + WebSockets
- **Code Execution**: Piston API (external sandbox - no local execution)
- **Auth**: Session-based (express-session, bcrypt)

## Database Schema (PostgreSQL)
- `users`: id, email, password (hashed), display_name
- `projects`: id, user_id, name, language, is_demo, updated_at
- `files`: id, project_id, filename, content, updated_at
- `runs`: id, project_id, user_id, status, language, code, stdout, stderr, exit_code, started_at, finished_at

## Key Features
- Email/password authentication with session cookies
- CRUD projects (create, list, duplicate, delete)
- Multi-file editor with auto-save
- Remote code execution (JavaScript, TypeScript, Python) via Piston API
- Real-time logs via WebSocket
- Dark/light mode toggle
- Public demo project (read-only)
- Rate limiting on auth and execution endpoints

## API Routes
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/duplicate` - Duplicate project
- `GET /api/projects/:projectId/files` - List files
- `POST /api/projects/:projectId/files` - Create file
- `PATCH /api/files/:id` - Update file content
- `DELETE /api/files/:id` - Delete file
- `POST /api/projects/:projectId/run` - Execute code
- `GET /api/demo/project` - Get demo project
- `POST /api/demo/run` - Execute demo code

## WebSocket
- Path: `/ws?projectId=<id>`
- Messages: `run_log` (real-time output), `run_status` (started/completed/failed)

## Tech Stack
- React 19, Wouter, TanStack Query, Framer Motion
- Express 5, express-session, bcrypt, express-rate-limit
- Drizzle ORM, PostgreSQL
- WebSocket (ws library)
- Piston API for sandboxed code execution
