# E-Code IDE - Full-Screen IDE SaaS

## Overview
E-Code IDE is a full-screen, responsive IDE SaaS platform accessible via web, tablet, and mobile. It allows users to write, save, and execute code within a VS Code-style layout, offering both light and dark themes. The platform integrates an AI coding agent and provides real-time log streaming.

The project's vision is to deliver a comprehensive, pixel-perfect development environment that supports individual developers and teams. Key capabilities include a multi-layered sandboxed code execution environment, robust deployment features with custom domains and SSL, real-time collaborative editing, and an advanced AI assistant with multi-model support and diverse tool use. E-Code aims to be a leading platform for rapid application development, offering a rich ecosystem for various project types including web, mobile, slides, and even 3D games, alongside extensive dependency and project management tools.

## User Preferences
- **Communication Style**: I prefer clear and concise communication.
- **Workflow**: I want iterative development with clear steps.
- **Interaction**: Ask before making major changes or irreversible decisions.
- **AI Agent Behavior**: I want the AI to be helpful but not intrusive, providing suggestions and completing tasks when requested, but allowing me to maintain control over the codebase.

## System Architecture
**Frontend**: Built with React, Vite, and TailwindCSS v4, featuring a responsive design for desktop, tablet, and mobile. The UI adheres to a pixel-perfect design language inspired by VS Code, including a customizable theme system with 6 global color channels and 19 syntax token colors dynamically applied via CSS variables. Key UI elements include an activity bar, file explorer, multi-file tabs, a resizable bottom panel with console and shell, a split preview panel, and a command palette.

**Backend**: Powered by Express.js (v5), PostgreSQL (with Drizzle ORM), and WebSockets. Session management is PostgreSQL-backed. 107 modular routers loaded via `MainRouter` in `server/routes/index.ts` with safe-import wrappers.

**Route Architecture**: Routes are split into two systems:
1. **Legacy routes** (`server/routes/legacy-*.ts`): ~74 routes from original codebase
2. **Modular routers** (`server/routes/*.router.ts`): 107 routers loaded via `MainRouter` with `safeImport` pattern

**Code Execution**: Features a multi-layered sandbox for secure code execution, including AST-based analysis, runtime policy wrappers, OS-level isolation (ulimit, nice, unshare), and resource limits (e.g., 10s timeout, 64MB memory). A worker pool manages concurrent executions with per-user rate limiting.

**Deployment Engine**: Unified Deploy panel (merged from separate Deploy + Publishing tabs). Supports four deployment types (Autoscale, Static, Reserved VM, Scheduled) with versioned rollbacks, build logs, configurable machine resources, deployment secrets, and custom domain management with Let's Encrypt SSL. Progress tracking uses real polling of `GET /api/projects/:id/publish/status` (maps backend statuses: pending → building → deploying → active). QR code for mobile access shown on overview when deployed. A Process Manager (`server/processManager.ts`) handles process lifecycle, health checks, crash detection, and real-time log streaming. The `buildProject` method in `deployment-manager.ts` copies project files from the DB to `/tmp/deployments/{id}/`, runs `npm install` and build commands, then `deployProject` detects the serve directory (dist/build/public/root) and registers a static route via Express at `/deployed/deploy-{projectId}/`. Deployed files are served by a catch-all route in `server/index.ts`.

**Workspace Path Convention**: All IDE panels use a single canonical workspace directory: `project-workspaces/{projectId}/` (relative to cwd). This is critical for panel isolation — terminal, preview, git, packages, AI agent, debugger, deployment, and all other services all operate in the same directory per project. The shared helper is `getProjectWorkspacePath(projectId)` in `server/utils/project-fs-sync.ts`. Static HTML projects (no framework) use `npx serve` for preview.

**Authentication**: Session-based authentication using `express-session` and `bcrypt`. Session cookie name is `connect.sid` (express-session default). Supports OAuth 2.0 providers (GitHub, Google, Apple, X/Twitter) with CSRF validation. Includes user banning and login activity tracking. OAuth callback URLs use `getAppUrl()` which resolves to `https://e-code.ai` in production (filtering out any `replit.app` fallback). Session cookies use `COOKIE_DOMAIN=.e-code.ai` in production for subdomain sharing.

**Production Domain**: `e-code.ai` — configured via `APP_DOMAIN` env var (production). Dev URLs: `{projectId}.dev.e-code.ai`. Email from: `noreply@e-code.ai`. Desktop app connects to `https://e-code.ai`.

**Rate Limiting**: Global API rate limit is 600 req/min (polling endpoints like `/poll`, `/preview/status`, `/deployment/latest` are excluded). AI endpoints: 60 req/min. AI generation: 15 req/min. Auth: 50 per 15 min. Configured in `server/routes.ts`.

**AI Integration**: Multi-agent provider architecture supporting four backends:
1. **Built-in E-Code AI** — Anthropic Claude Sonnet, OpenAI GPT-4.1/o4-mini/o3, Google Gemini Flash with MCP tool-use
2. **Claude Agent SDK** — Full Anthropic Agent SDK integration via `server/services/claude-agent-service.ts`. Creates sandboxed sessions per project/user, streams events (file creates, command execution, assistant messages) to all IDE panels via WebSocket broadcast. Routes at `/api/projects/:id/agent/{session,message,stream,archive,status}`. Env vars: `CLAUDE_AGENT_ID`, `CLAUDE_ENVIRONMENT_ID`, `CLAUDE_VAULT_ID`, `ANTHROPIC_API_KEY`. Frontend hook: `client/src/hooks/use-claude-agent.ts`.
3. **OpenHands** (MIT, 70k+ stars) — Autonomous AI software engineer via REST API integration (`server/integrations/openhands-client.ts`, routes at `/api/openhands/*`)
4. **Goose** (Apache 2.0, Block/Linux Foundation) — AI agent via REST API integration (`server/integrations/goose-client.ts`, routes at `/api/goose/*`)
Unified provider status at `/api/agent-providers/status`. Provider selection persisted in `localStorage("ai-agent-provider")`. Each external provider supports health checks, session management, streaming events, and configuration (server URL, API key, model). The built-in agent offers various modes (Economy, Power, Turbo) with **usage-based token billing** — credits deducted per-token from `MODEL_TOKEN_PRICING` in `shared/schema.ts`. Modular AI agent services support DALL-E 3, NanoBanana (Stable Diffusion XL), Brave Image Search, and ElevenLabs TTS.

**Code Editor**: Dual-engine editor with toggle in the status bar:
1. **Monaco Editor** (default) — VS Code's editor engine via `@monaco-editor/react`. Full IntelliSense, TypeScript/JSX support, bracket colorization, sticky scroll, minimap. Component at `client/src/components/editor/MonacoCodeEditor.tsx`.
2. **CodeMirror 6** — Lightweight alternative with Yjs collaboration, git blame, AI completions. Component at `client/src/components/CodeEditor.tsx`.
Editor engine preference stored in `localStorage("editor-engine")`. Toggle available in status bar and via `EditorEngineToggle` component.

**Project Structure**: Introduces a Multi-Artifact Architecture allowing projects to support various output formats (web-app, mobile-app, slides, video, 3D game, document, spreadsheet, design). Each artifact has its own configuration and entry point. Dedicated artifact types like Mobile App, Slides, and Video have specialized editors and AI tools. A Design Canvas provides an infinite visual board workspace with HTML mockups and annotations.

**Version Control**: Full Git integration using `isomorphic-git` for operations like init, add, commit, log, branch, checkout, diff, status, and blame. Includes GitHub synchronization (push, pull, clone) and a visual merge conflict resolution UI. Automatic git repo backups with gzip compression ensure disaster recovery. Per-file versioning provides historical snapshots and diff views.

**Collaboration**: Real-time collaborative editing via WebSocket using Yjs CRDT for conflict-free document synchronization, with user presence indicators and remote cursors. A project invite system enables sharing with configurable roles and invite links.

**Developer Tools**: Includes a customizable Keyboard Shortcuts system, a structured Console Panel with run history, an AI Plan Mode for generating structured task lists, and a comprehensive User Settings panel. Dependency Management features a package panel with registry search, import guessing, and version pinning. SSH Panel and Key Management allow users to add and manage SSH public keys for remote access.

**Storage and Database**: Every project automatically gets its own PostgreSQL schema (`proj_{projectId}`) on creation via `autoProvisionProjectDatabase()` in `server/utils/project-db-provision.ts`. The `DATABASE_URL` and `PGSCHEMA` are stored as encrypted project env vars. The Database Panel shows "Tables (0)" with a SQL Runner link when empty (not "No database"). Legacy `ensureProjectSchema` in `legacy-database-viewer.ts` lazy-creates schemas for older projects. An App Storage v2 system offers bucket-based object storage with folder organization, access management, and quota enforcement.

**Key Features**:
- **Workflows**: Multi-step build/run pipelines with configurable triggers and execution modes. System workflows (Development, Build, Test, Preview) and custom workflows execute commands via `child_process.spawn` in the project workspace (`project-workspaces/{projectId}/`). The execute-command endpoint at `POST /api/projects/:id/workflows/execute-command` materializes files, spawns the command with a sandboxed env (no host secrets), and streams output via WebSocket `workflow_log`/`workflow_status` messages. Long-running commands (dev/serve/watch) return immediately; short-lived commands wait for completion. Stop via `POST /api/projects/:id/workflows/stop-command`.
- **Monitoring**: Metrics collection (CPU, memory, load, requests) for deployed projects with configurable alerts.
- **Threads**: Code discussion threads with line number references.
- **Build in Parallel (Tasks)**: Kanban board for parallel task execution with AI plan integration.
- **Checkpoints**: Full project state snapshots with a visual timeline for rollback/roll-forward.
- **CLUI System**: Command Line UI for account management, global search, and workspace actions.
- **Replit Config System**: Full support for `.replit` and `replit.nix` configuration files.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Nodemailer**: For sending emails (password resets, verification, invites).
- **Stripe**: Payment processing and subscription management via managed webhooks.
- **OAuth Providers**: GitHub, Google, Apple, X/Twitter for social auth.
- **AI Providers**: OpenAI (via Replit ModelFarm), Anthropic Claude, Google Gemini, xAI Grok, Moonshot AI — with automatic ModelFarm fallback on provider failure. OpenHands cloud API (OPENHANDS_API_KEY).
- **SendGrid**: Email service (production).
- **Redis**: Caching layer (optional, falls back to in-memory).

## Important Technical Notes
- **Express 5**: Wildcard routes use `/{*path}` not `*`. `req.path` is always `/` in wildcard routes — use `req.originalUrl`.
- **Build**: `rm -rf dist && npx vite build` to rebuild frontend after ANY client/shared file changes. Vite `manualChunks` splits ALL `node_modules` into a single `vendor` chunk. `esbuild.minifyIdentifiers: false` prevents TDZ errors caused by Rollup's module concatenation reordering `const` declarations. Whitespace/syntax still minified. `detectLanguage()` utility lives in `client/src/lib/detect-language.ts` (NOT in `CodeEditor.tsx`). Server: `PORT=5000 NODE_ENV=development node --import tsx/esm server/index.ts`. Server logs build timestamp and stale detection on startup. `/api/build-info` endpoint returns `{ buildTime, isStale, newestSource, hasManifest }`. Browser console logs build timestamp on mount. Vite uses `build.manifest: true` and hashed filenames `[name]-[hash].js` for cache busting. HTML served with `no-cache`; hashed assets with `1y immutable`.
- **Schema**: `shared/schema.ts` (~3700 lines) contains all Drizzle table definitions and Zod schemas. ~100+ tables.
- **Storage exports**: `server/storage.ts` exports `storage`, `getStorage()`, and `sessionStore`.
- **AI Agent System Prompt**: Agent prompt in `legacy-ai-assistant.ts` (~line 2538) instructs AI to build production-ready, beautifully designed apps. Includes mandatory architecture rules (React+Vite+Tailwind for non-trivial apps), comprehensive design system (dark mode, glassmorphism, typography, animations, responsive), and strict completeness requirements. Output quality is a top priority — apps must look like premium SaaS products.
- **AI Helper Utilities**: Shared AI functions (validateAIMessages, sanitizeAIFilename, resolveTopAgentMode, etc.) live in `server/routes/ai-helpers.ts` and are imported by legacy route files.
- **Preview route**: Working path is `/api/preview/projects/:id/preview/`. Legacy `legacy-ai-assistant.ts` has catch-all routes at `/api/preview/:projectId/{*path}` that skip `projectId === 'projects'` to allow the modular preview router to handle the `/projects/` prefix. The preview router (`server/routes/preview.ts`) uses its own `requireAuth` middleware (session + passport compatible) and `ensureProjectAccess` (checks `project.userId || project.ownerId`). File schema uses `f.filename` — use `fname(f)` helper.
- **Route loading order**: `server/routes.ts` `registerRoutes()` loads legacy routes first (including `legacy-ai-assistant.ts` catch-all proxy routes), then `MainRouter` from `server/routes/index.ts` last. Legacy routes can intercept modular router paths.
- **Terminal/Shell unification**: The "Terminal" tab in `UnifiedIDELayout.tsx` now renders `ShellPanel` (not the defunct `ReplitTerminalPanel`). The tab label displays "Shell" for consistency. Both desktop and mobile paths are unified.
- **AI Mode**: All providers use managed mode (platform API keys). No BYOK popup. `credentialModes` hardcoded as configured in `AIPanel.tsx`.
- **WebSocket Paths**: Project WebSocket uses `/ws/project?projectId=...` (NOT bare `/ws` which is blocked by Replit proxy). Collab uses `/ws/collab`, terminal uses `/ws/terminal`. The CentralUpgradeDispatcher handles `/ws/project` with self-auth (handler does its own session middleware). Polling fallback at `/api/projects/:id/poll` after 3 WS failures.
- **Secrets/Env Vars**: Two DB systems exist: (1) `project_env_vars` + `account_env_vars` + `account_env_var_links` tables (old, with `encrypt()`/`decrypt()` from `server/encryption.ts`), (2) `environment_variables` table (newer, with `RealSecretManagementService` for encryption, `isSecret` boolean). Both systems are merged via `fetchAllProjectSecrets()` in `server/utils/secrets.ts` and injected into all runtimes: terminal, code execution, preview, and debug-run. SecretsPanel UI (`client/src/components/editor/SecretsPanel.tsx`) has App Secrets and Account Secrets tabs. Account secrets are shared across projects via linking. Routes in `server/routes/secrets.router.ts` (project IDs are UUID strings, never parseInt).
- **Extensions System**: Extensions marketplace at `GET /api/extensions/marketplace`. Install: `POST /api/extensions/:projectId/install`. Uninstall: `POST /api/extensions/:projectId/uninstall`. Extensions install npm packages to `project-workspaces/{projectId}/`. Prettier extension: auto-formats on save (server-side via `prettier --write` in the save handler of `legacy-files.ts`), manual format via `POST /api/extensions/:projectId/format`. ESLint extension: lint via `POST /api/extensions/:projectId/lint` (async, called from frontend after save). ESLint v9 uses flat config (`eslint.config.mjs`) with `@eslint/js`. Config files are created both on disk and in the project's DB file tree. Format button visible in editor toolbar (`data-testid="button-format-document"`). Lint diagnostics displayed below toolbar with severity icons and line/column info.
- **Known non-blocking warnings**: SSH server (`ssh2.Server` constructor), Stripe webhooks (need `STRIPE_WEBHOOK_SECRET`), fuzzy search SQL syntax.
- **GitHub remote**: `origin` = `https://github.com/openaxcloud/Vibe-Companion`.
- **Auth flow**: Frontend uses `/api/login`, `/api/register`, `/api/logout`, `/api/me`. Auth router mounted at `/api` with Passport local strategy. Session regeneration on login sets both `req.user` (Passport) and `req.session.userId` (legacy). CSRF exempt for login/register endpoints.
- **Auth credentials (dev)**: Login `avi@snatchbot.me` / `password123`. Must send `X-Forwarded-Proto: https` for session cookie.

## Database Schema
Over 100 PostgreSQL tables managed via Drizzle ORM in `shared/schema.ts`. Key table groups:
- **Core**: users, projects, files, deployments, checkpoints
- **AI**: agent_messages, agent_sessions, agent_plans, ai_token_usage, ai_usage_metering, tool_executions
- **Collaboration**: collaboration_sessions, session_participants, collaboration_messages
- **Community**: community_posts, community_comments, community_categories, challenges
- **Billing**: stripe_customers, subscriptions, pay_as_you_go_queue, usage_ledger, usage_events
- **Infrastructure**: runner_workspaces, deployment_metrics, scaling_policies, monitoring_events
