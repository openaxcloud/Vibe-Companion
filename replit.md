# Replit IDE Clone - Full-Screen IDE SaaS

## Overview
A full-screen responsive IDE SaaS platform (web/tablet/mobile). Users can write, save, and execute code with a dark-themed interface matching Replit's visual identity, AI coding agent, and real-time log streaming. VS Code-style layout with pixel-perfect Replit design language.

## Architecture
- **Frontend**: React + Vite + TailwindCSS v4, responsive design (desktop/tablet/mobile)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM) + WebSockets
- **Sessions**: PostgreSQL-backed via `connect-pg-simple` (table: `user_sessions`)
- **Code Execution**: Local sandboxed `child_process.spawn` with security pattern blocking, 10s timeout, 64MB memory limit
- **Auth**: Session-based (express-session, bcrypt), `trust proxy` enabled for Replit
- **AI**: Triple model support — Anthropic Claude Sonnet (claude-sonnet-4-6) + OpenAI GPT-4o + Google Gemini Flash (gemini-2.5-flash), all via Replit AI Integrations
- **AI Agent**: Tool-use endpoint that can create/edit files directly in the project
- **Editor**: CodeMirror 6 via `@uiw/react-codemirror` with custom Replit syntax theme (replitTheme + replitHighlight)

## Database Schema (PostgreSQL)
- `users`: id, email, password (hashed), display_name
- `projects`: id, user_id (indexed), name, language, is_demo, is_published, updated_at
- `files`: id, project_id (indexed), filename, content, updated_at
- `runs`: id, project_id (indexed), user_id (indexed), status, language, code, stdout, stderr, exit_code, started_at, finished_at
- `workspaces`: id (uuid), project_id (unique), owner_user_id, created_at, last_seen_at, status_cache
- `workspace_sessions`: id (uuid), workspace_id, user_id, created_at, expires_at
- `user_sessions`: PostgreSQL session store (auto-created by connect-pg-simple)

## Key Features
- Email/password authentication with persistent PostgreSQL-backed sessions
- CRUD projects (create, list, duplicate, delete)
- **AI project generation**: Create projects from a text prompt (Dashboard "Create with AI" input)
- **VS Code-style IDE layout**: Activity bar on far left with tooltips (Explorer, Search, AI, Git, Deployments, Preview, Settings icons)
- **Smooth panel transitions**: Sidebar, terminal, and preview panels animate open/close with CSS transitions
- **Nested file tree**: Files with paths like `src/components/App.tsx` display in proper folder hierarchy with expand/collapse
- **File tree context menu**: Right-click for Open, Rename, Duplicate, Delete, Copy Path; folders get New File/New Folder
- **Tab context menu**: Right-click tabs for Close, Close Others, Close All, Close to Right, Copy Path
- **Tab drag reorder**: Drag and drop tabs to reorder; scroll arrows when tabs overflow
- Full IDE layout: file explorer sidebar, multi-file tabs, auto-save, dirty indicators
- **Breadcrumbs**: Path segments above editor (src > components > App.tsx) with clickable segments
- **Command Palette** (Cmd+K): Searchable command overlay with file switching and action shortcuts
- CodeMirror 6 editor with Replit-accurate syntax theme (red keywords, green strings, teal functions, orange numbers)
- **File type icons**: Colorful language-specific badges (JS yellow, TS blue, PY green, etc.) in tree and tabs
- **AI coding agent**: Chat mode (ask questions) + Agent mode (create/edit files directly)
- **Model selection**: Choose between Claude Sonnet (Anthropic), GPT-4o (OpenAI, default), and Gemini Flash (Google) — all three work in chat, agent, AND project generation modes
- **Markdown rendering in AI chat**: Bold, italic, inline code, links, headers, bullet/numbered lists
- **AI model badges**: Each AI response shows which model generated it (Claude/GPT)
- **Character count**: Shows character count while typing in AI input
- **Apply-to-file**: Code blocks in AI chat have "Apply" buttons that insert code directly into the active file
- **Template starters**: Dashboard has horizontal scrolling template cards with arrow buttons
- **Dashboard search**: Real-time project search in dashboard header
- **Notifications**: Bell icon with badge count in dashboard header
- **Credits indicator**: "Free" plan badge near profile in dashboard
- **Welcome/Onboarding states**: New project shows welcome with quick-start actions; no-files-open shows recent file list
- **Mobile dashboard navigation**: Hamburger menu slides in sidebar; mobile search expands from icon
- **Social login placeholders**: GitHub/Google buttons show "coming soon" toasts
- Remote code execution (JavaScript, TypeScript, Python) via local sandbox with esbuild TypeScript transpilation
- Real-time logs via WebSocket in resizable terminal panel
- Console + Preview (iframe) + Shell (xterm.js) bottom tabs
- Run/Stop buttons with execution state indication
- **Deployments panel**: Sidebar panel showing publish status, URL, deployment history
- **Settings panel**: In-sidebar settings with theme toggle, font size, tab size, word wrap controls
- Project settings dialog (rename, change language)
- Publish/share projects with toggle and shareable URL
- Public shared project view (read-only with code execution)
- Dark mode with Replit-accurate design tokens
- Public demo project (read-only)
- **Skeleton loading states**: Full IDE skeleton, file tree skeletons, dashboard card skeletons
- **HTML Preview**: Local HTML preview via srcdoc iframe when runner is offline — auto-combines HTML + linked CSS/JS from project files, auto-refreshes on save
- **Run UX**: Run button auto-opens terminal, shows run separator with timestamp, displays exit code on completion
- **File creation flow**: New files from AI agent or manual creation auto-open in tab, expand parent folders, and show file explorer
- **Dashboard empty states**: Progress animation during AI generation, error panel with retry, "Create New Repl" card, improved empty states with CTAs
- **Security**: Path traversal prevention on all file endpoints, agent loop limit (10 iterations max), sandbox="allow-scripts" on preview iframes
- **WebSocket heartbeat**: Server-side ping/pong every 30s, client-side auto-reconnect with exponential backoff
- Rate limiting: 50 req/15min on auth, 100 req/min on API, 10 req/min on execution
- **Workspace live mode**: connect to runner.e-code.ai VPS for real cloud workspaces
- **Dual-mode file explorer**: Runner FS API when workspace running, DB fallback when stopped

## Keyboard Shortcuts
- Cmd+S: Save current file
- Cmd+K / Cmd+Shift+P: Command palette
- Cmd+B: Toggle sidebar
- Cmd+J: Toggle terminal
- Cmd+\: Toggle preview panel
- Cmd+Shift+F: Search across files
- Cmd+Enter / F5: Run project

## Design System
- **Replit orange logo**: SVG three-block mark (#F26522) used throughout (header, auth, empty state, footer, status bar)
- **Syntax theme**: Keywords #FF6166 (red), Strings #0CCE6B (green), Functions #56B6C2 (teal), Numbers #FF9940 (orange), Types #FFCB6B (yellow), Comments #676D7E (muted italic), Default text #CFD7E6
- **Color tokens**: #0E1525 (bars/nav), #1C2333 (panels/editor), #2B3245 (borders/surface), #323B4F (hover), #0079F2 (accent blue), #0CCE6B (green run), #7C65CB (AI purple), #F26522 (Replit orange), #F5F9FC (text primary), #9DA2B0 (text secondary), #676D7E (text muted)
- **Fonts**: IBM Plex Sans (UI), IBM Plex Mono / JetBrains Mono (code/terminal)

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
- `shared/schema.ts` - Drizzle schema + Zod insert schemas (indexed columns)
- `server/routes.ts` - All API routes (auth, projects, files, runs, publish, workspaces, AI, demo)
- `server/runnerClient.ts` - Runner VPS HTTP client
- `server/storage.ts` - IStorage interface + DatabaseStorage implementation
- `server/executor.ts` - Sandboxed code execution engine
- `server/index.ts` - Express setup
- `client/src/pages/Project.tsx` - Full IDE page (VS Code layout, activity bar, AI agent panel, editor, terminal, command palette, deployments panel)
- `client/src/pages/Dashboard.tsx` - Project list with AI prompt generation, skeleton loading
- `client/src/pages/Auth.tsx` - Login/register page
- `client/src/pages/Settings.tsx` - Account settings (profile, password, danger zone)
- `client/src/pages/SharedProject.tsx` - Public shared project view
- `client/src/components/CodeEditor.tsx` - CodeMirror 6 wrapper with Replit syntax theme + cursor tracking
- `client/src/components/AIPanel.tsx` - AI agent panel with markdown rendering, model selection, chat/agent modes
- `client/src/components/CommandPalette.tsx` - Cmd+K command palette with file switching and actions
- `client/src/components/WorkspaceTerminal.tsx` - xterm.js terminal panel

## IDE Layout (Desktop — Replit Clone)
- **Activity Bar** (48px, far left): Explorer, Search, AI Agent, Git (with dirty badge), Deployments, Preview, Settings — active icon has left-2 border indicator (blue #0079F2, purple for AI)
- **AI Agent Panel** (45% width, toggleable): Chat/agent mode toggle, model selection (Claude/GPT), rich markdown rendering, file operation indicators, apply-to-file code blocks
- **File Explorer** (240px, toggleable): Nested folder tree with expand/collapse, colored file type icons, create/rename/delete
- **Header Bar** (h-11/44px): Left (Replit orange logo → chevron → project name), Center (green Run pill button), Right (Invite + Publish + kebab menu)
- **Breadcrumbs**: Path segments between tab bar and editor (src > components > App.tsx)
- **Search Panel** (300px, toggleable via Ctrl+Shift+F): Full-text search across all project files
- **Editor** (center): CodeMirror 6 with tabs + Replit syntax theme + cursor position tracking
- **Deployments Panel**: Publish status, URL, history, custom domain placeholder
- **Settings Panel**: Theme toggle, editor font size/tab size/word wrap controls, about section
- **Webview Panel** (right side, ~40%, resizable): Live preview with URL bar, refresh, open-in-new-tab
- **Bottom Panel** (resizable): Console + Shell tabs with xterm.js terminal
- **Status Bar** (h-6, bottom): git branch "main", workspace status, WS indicator, problems count, language picker, cursor Ln/Col, tab size, encoding, Prettier, Replit logo
- **Mobile**: bottom nav bar (Files/Editor/Terminal/Preview/AI) — single-pane navigation

## Tech Stack
- React 19, Wouter, TanStack Query
- Express 5, express-session, connect-pg-simple, bcrypt, express-rate-limit
- Drizzle ORM, PostgreSQL
- Anthropic SDK + OpenAI SDK + Google GenAI SDK (via Replit AI Integrations)
- CodeMirror 6 (@uiw/react-codemirror + language packages + custom Replit theme)
- WebSocket (ws library)
- IBM Plex Sans / IBM Plex Mono / JetBrains Mono fonts
