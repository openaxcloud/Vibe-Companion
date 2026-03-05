# Replit IDE Clone - Full-Screen IDE SaaS

## Overview
A full-screen responsive IDE SaaS platform (web/tablet/mobile). Users can write, save, and execute code with a dark-themed interface matching Replit's visual identity, AI coding agent, and real-time log streaming. VS Code-style layout with pixel-perfect Replit design language.

## Architecture
- **Frontend**: React + Vite + TailwindCSS v4, responsive design (desktop/tablet/mobile)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + WebSockets
- **Code Execution**: Local sandboxed `child_process.spawn` with security pattern blocking, 10s timeout, 64MB memory limit
- **Auth**: Session-based (express-session, bcrypt), `trust proxy` enabled for Replit
- **AI**: Dual model support — Anthropic Claude Sonnet (claude-sonnet-4-6) + OpenAI GPT-5.2, both via Replit AI Integrations
- **AI Agent**: Tool-use endpoint that can create/edit files directly in the project
- **Editor**: CodeMirror 6 via `@uiw/react-codemirror` with custom Replit syntax theme (replitTheme + replitHighlight)

## Database Schema (PostgreSQL)
- `users`: id, email, password (hashed), display_name
- `projects`: id, user_id, name, language, is_demo, is_published, updated_at
- `files`: id, project_id, filename, content, updated_at
- `runs`: id, project_id, user_id, status, language, code, stdout, stderr, exit_code, started_at, finished_at
- `workspaces`: id (uuid), project_id (unique), owner_user_id, created_at, last_seen_at, status_cache
- `workspace_sessions`: id (uuid), workspace_id, user_id, created_at, expires_at

## Key Features
- Email/password authentication with session cookies
- CRUD projects (create, list, duplicate, delete)
- **AI project generation**: Create projects from a text prompt (Dashboard "Create with AI" input)
- **VS Code-style IDE layout**: Activity bar on far left (Explorer, AI, Workspace, Settings icons)
- Full IDE layout: file explorer sidebar, multi-file tabs, auto-save, dirty indicators
- CodeMirror 6 editor with syntax highlighting (JS/TS/Python/HTML/CSS/JSON/Markdown)
- **AI coding agent**: Chat mode (ask questions) + Agent mode (create/edit files directly)
- **Model selection**: Choose between Claude Sonnet (Anthropic) and GPT-5.2 (OpenAI) — Agent mode uses Claude for tool capabilities
- **Apply-to-file**: Code blocks in AI chat have "Apply" buttons that insert code directly into the active file
- **Template starters**: Dashboard has 4 template cards (Web App, API Server, Dashboard, Game) that auto-generate projects
- Remote code execution (JavaScript, TypeScript, Python) via local sandbox
- Real-time logs via WebSocket in resizable terminal panel
- Console + Preview (iframe) + Shell (xterm.js) bottom tabs
- Run/Stop buttons with execution state indication
- Project settings dialog (rename, change language)
- Publish/share projects with toggle and shareable URL
- Public shared project view (read-only with code execution)
- Dark mode with Replit-accurate design tokens
- Public demo project (read-only)
- Rate limiting: 50 req/15min on auth, 100 req/min on API, 10 req/min on execution
- **Workspace live mode**: connect to runner.e-code.ai VPS for real cloud workspaces
- **Dual-mode file explorer**: Runner FS API when workspace running, DB fallback when stopped

## Design System
- **Replit orange logo**: SVG three-block mark (#F26522) used throughout (header, auth, empty state, footer, status bar)
- **Color tokens**: #0E1525 (bars/nav), #1C2333 (panels/editor), #2B3245 (borders/surface), #323B4F (hover), #0079F2 (accent blue), #0CCE6B (green run), #7C65CB (AI purple), #F26522 (Replit orange), #F5F9FC (text primary), #9DA2B0 (text secondary), #676D7E (text muted)
- **Fonts**: Plus Jakarta Sans (UI), JetBrains Mono (code/terminal)

## API Routes
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user
- `GET /api/projects` - List user projects
- `POST /api/projects` - Create project
- `POST /api/projects/generate` - AI-generate project from prompt (Claude)
- `GET /api/projects/:id` - Get project
- `PATCH /api/projects/:id` - Update project (name, language)
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/duplicate` - Duplicate project
- `GET /api/projects/:projectId/files` - List files
- `POST /api/projects/:projectId/files` - Create file
- `PATCH /api/files/:id` - Update file content or rename
- `DELETE /api/files/:id` - Delete file
- `POST /api/projects/:projectId/run` - Execute code
- `POST /api/projects/:id/publish` - Toggle publish status
- `GET /api/shared/:id` - Get published project (public, no auth)
- `GET /api/demo/project` - Get demo project
- `POST /api/demo/run` - Execute demo code
- `POST /api/ai/chat` - AI chat (Claude or GPT, streaming SSE, model selection)
- `POST /api/ai/agent` - AI agent with tool use (creates/edits files, Claude only)
- `GET /api/runner/status` - Check runner VPS health
- `POST /api/workspaces/:projectId` - Init/provision workspace
- `POST /api/workspaces/:projectId/start` - Start workspace
- `POST /api/workspaces/:projectId/stop` - Stop workspace
- `GET /api/workspaces/:projectId/status` - Get workspace status
- `GET /api/workspaces/:projectId/terminal-url` - Get terminal WebSocket URL
- `GET /api/workspaces/:projectId/preview-url` - Get live preview URL
- `GET /api/workspaces/:projectId/fs` - List runner FS directory
- `GET /api/workspaces/:projectId/fs/read` - Read file from runner FS
- `POST /api/workspaces/:projectId/fs/write` - Write file to runner FS
- `POST /api/workspaces/:projectId/fs/mkdir` - Create directory on runner FS
- `DELETE /api/workspaces/:projectId/fs/rm` - Delete file/dir on runner FS
- `POST /api/workspaces/:projectId/fs/rename` - Rename file/dir on runner FS

## WebSocket
- Path: `/ws?projectId=<id>` (noServer mode with manual upgrade handling to avoid conflicts with Vite HMR at `/vite-hmr`)
- Messages: `run_log` (real-time output), `run_status` (started/completed/failed)

## Important Files
- `shared/schema.ts` - Drizzle schema + Zod insert schemas
- `server/routes.ts` - All API routes (auth, projects, files, runs, publish, workspaces, AI, demo)
- `server/runnerClient.ts` - Runner VPS HTTP client
- `server/storage.ts` - IStorage interface + DatabaseStorage implementation
- `server/executor.ts` - Sandboxed code execution engine
- `server/index.ts` - Express setup
- `client/src/pages/Project.tsx` - Full IDE page (VS Code layout, activity bar, AI agent panel, editor, terminal)
- `client/src/pages/Dashboard.tsx` - Project list with AI prompt generation
- `client/src/pages/Auth.tsx` - Login/register page
- `client/src/pages/SharedProject.tsx` - Public shared project view
- `client/src/components/CodeEditor.tsx` - CodeMirror 6 wrapper with language detection
- `client/src/components/AIPanel.tsx` - AI agent panel with model selection, chat/agent modes, file operations
- `client/src/components/WorkspaceTerminal.tsx` - xterm.js terminal panel

## IDE Layout (Desktop — Replit Clone)
- **Activity Bar** (48px, far left): Explorer, AI Agent, Search, Git, Webview, Settings icons — active icon has left-2 border indicator (blue #0079F2, purple for AI)
- **AI Agent Panel** (45% width, toggleable): Split view like Replit Agent — chat/agent mode toggle, model selection (Claude/GPT), file operation indicators, apply-to-file code blocks
- **File Explorer** (240px, toggleable): file list with left blue accent on active file, create/rename/delete
- **Header Bar** (h-10): Left (Replit orange logo → breadcrumb → project name), Center (green Run pill button), Right (Invite + Publish + kebab menu)
- **Search Panel** (300px, toggleable via Ctrl+Shift+F): Full-text search across all project files with results showing filename, line number, and matching text
- **Editor** (center): CodeMirror 6 with tabs (active=bright bg, blue bottom accent) + resizable bottom panel (Console + Shell)
- **Webview Panel** (right side, ~40%, resizable): Live preview with URL bar, refresh, open-in-new-tab — Replit's signature side-by-side layout
- **Status Bar** (22px, bottom): workspace status dot, connection indicator, language name, Replit logo branding
- **Mobile**: bottom nav bar (Files/Editor/Terminal/Preview/AI) — single-pane navigation

## Tech Stack
- React 19, Wouter, TanStack Query
- Express 5, express-session, bcrypt, express-rate-limit
- Drizzle ORM, PostgreSQL
- Anthropic SDK + OpenAI SDK (via Replit AI Integrations)
- CodeMirror 6 (@uiw/react-codemirror + language packages + custom Replit theme)
- WebSocket (ws library)
- JetBrains Mono font, Plus Jakarta Sans font
