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

**Backend**: Powered by Express 5.x, PostgreSQL (with Drizzle ORM), and WebSockets. Session management uses PostgreSQL-backed store (connect-pg-simple) — MemoryStore fallback has been removed; `DATABASE_URL` is required at startup. Critical early routes (workspace bootstrap, schema warming, agent chat) are registered directly in `server/index.ts` BEFORE `routes.ts` loads — they always win over any duplicate in routes.ts. **Route Architecture**: `server/routes.ts` is a slim ~300-line orchestrator that delegates HTTP routes to `MainRouter` from `server/routes/index.ts`. The MainRouter uses **resilient dynamic imports** — each of 93 modular routers loads independently via `safeImport()`, so a single failing router doesn't block the rest. Only 1 router currently fails (expo-snack, missing snack-sdk). **Express 5 Compatibility**: Wildcard routes use `{*paramName}` syntax (not bare `*`), optional params use `{/:param}` (not `:param?`). **Storage Proxy**: The `storage` export wraps `DatabaseStorage` in a Proxy that returns empty results for unimplemented methods — always use the exact method name (e.g. `getFilesByProject` not `getFiles`, `getWorkflowsByProject` not `getWorkflows`). Panel APIs include: Terminal (WebSocket PTY via node-pty), Git operations (real git commands via `/api/git/projects/:id/...`), Workflows, Preview WebSocket (`/ws/preview`), Packages (npm install/uninstall), Secrets/Env Vars (encrypted in DB via `projectEnvVars` table), Database (SQL execution via pg at `/api/database/project/:id/...`), Deployment (`/api/projects/:id/deployment/latest`), History/Checkpoints, Console log streaming (`/api/server/logs/ws` and `/api/runtime/logs/ws` with session auth), Agent tools, Workspaces, and File operations. Project listing uses `storage.getProjectsByUser()`. All WebSocket upgrade handlers require session authentication.

**Code Execution**: Features a multi-layered sandbox for secure code execution, including AST-based analysis, runtime policy wrappers, OS-level isolation (ulimit, nice, unshare), and resource limits (e.g., 10s timeout, 64MB memory). A worker pool manages concurrent executions with per-user rate limiting.

**Deployment Engine**: Supports four deployment types (Autoscale, Static, Reserved VM, Scheduled) with versioned rollbacks, build logs, configurable machine resources, deployment secrets, and custom domain management with Let's Encrypt SSL. A Process Manager (`server/processManager.ts`) handles process lifecycle, health checks, crash detection, and real-time log streaming.

**Authentication**: Session-based authentication using `express-session` and `bcrypt`. Session middleware is consolidated in `server/middleware/session-config.ts` (single source of truth for session store, secret, and cookie config). Auth endpoints are defined with a try/catch pattern in `routes.ts` that attempts to load the modular `auth.router.ts` first, falling back to inline endpoints. Supports OAuth 2.0 providers (GitHub, Google, Apple, X/Twitter) with CSRF validation. Includes user banning and login activity tracking. OAuth callback URLs use `getAppUrl()` which resolves to `https://e-code.ai` in production (filtering out any `replit.app` fallback). Session cookies use `COOKIE_DOMAIN=.e-code.ai` in production for subdomain sharing. XSS defense-in-depth is applied to AI chat markdown rendering via DOMPurify sanitization (code fences preserved).

**Production Domain**: `e-code.ai` — configured via `APP_DOMAIN` env var (production). Dev URLs: `{projectId}.dev.e-code.ai`. Email from: `noreply@e-code.ai`. Desktop app connects to `https://e-code.ai`.

**AI Integration**: Both `/api/agent/chat` and `/api/agent/chat/stream` endpoints in `server/index.ts` dynamically import `storage` from `./storage` to pass to `extractAndSaveCodeBlocks()` for DB file sync. Supports Anthropic Claude Sonnet, OpenAI GPT-4o, and Google Gemini Flash models. The AI agent offers various modes (Economy, Power, Turbo) with **usage-based token billing** — credits are deducted per-token using centralized pricing from `MODEL_TOKEN_PRICING` in `shared/schema.ts`. Overage billing via Stripe metered subscriptions kicks in when monthly included credits are exhausted (if payment method on file). Helper functions `calculateTokenCredits()` and `getProviderPricing()` centralize cost calculation. All AI routes use `storage.deductMonthlyCreditsFromRoute()` which automatically reports overage to Stripe. The AI agent includes tool-use capabilities for file operations, skill creation, downloadable file generation (PDF, DOCX, XLSX, PPTX, CSV), and web search (Tavily API with Google/Bing fallback). A message queue system allows users to manage follow-up messages during streaming. Modular AI agent services support DALL-E 3, NanoBanana (Stable Diffusion XL), Brave Image Search, and ElevenLabs TTS, each with fixed credit costs defined in `SERVICE_CREDIT_COSTS`.

**Project Structure**: Introduces a Multi-Artifact Architecture allowing projects to support various output formats (web-app, mobile-app, slides, video, 3D game, document, spreadsheet, design). Each artifact has its own configuration and entry point. Dedicated artifact types like Mobile App, Slides, and Video have specialized editors and AI tools. A Design Canvas provides an infinite visual board workspace with HTML mockups and annotations.

**Version Control**: Full Git integration using `isomorphic-git` for operations like init, add, commit, log, branch, checkout, diff, status, and blame. Includes GitHub synchronization (push, pull, clone) and a visual merge conflict resolution UI. Automatic git repo backups with gzip compression ensure disaster recovery. Per-file versioning provides historical snapshots and diff views.

**Collaboration**: Real-time collaborative editing via WebSocket using Yjs CRDT for conflict-free document synchronization, with user presence indicators and remote cursors. A project invite system enables sharing with configurable roles and invite links.

**Developer Tools**: Includes a customizable Keyboard Shortcuts system, a structured Console Panel with run history, an AI Plan Mode for generating structured task lists, and a comprehensive User Settings panel. Dependency Management features a package panel with registry search, import guessing, and version pinning. SSH Panel and Key Management allow users to add and manage SSH public keys for remote access.

**Storage and Database**: Each project receives its own PostgreSQL schema for data isolation. A Database Panel provides a table browser, SQL Runner, and masked credentials display. An App Storage v2 system offers bucket-based object storage with folder organization, access management, and quota enforcement.

**Key Features**:
- **Onboarding & Guided Tour**: Pre-login IDE feature showcase on the landing page (`IDEFeatureShowcase` component) lets visitors explore each IDE panel interactively before signing up. A post-login guided tour (`IDEGuidedTour` component with `useIDETour` hook) highlights 7 key IDE panels (File Explorer, Code Editor, Terminal, Preview, AI Agent, Deploy) using a spotlight overlay. Tour state is persisted in `localStorage` (`e-code-ide-tour-completed`). Users can replay the tour from Settings > Appearance > "Replay IDE Tour".
- **Workflows**: Multi-step build/run pipelines with configurable triggers and execution modes.
- **Monitoring**: Metrics collection (CPU, memory, load, requests) for deployed projects with configurable alerts.
- **Threads**: Code discussion threads with line number references.
- **Build in Parallel (Tasks)**: Kanban board for parallel task execution with AI plan integration.
- **Checkpoints**: Full project state snapshots with a visual timeline for rollback/roll-forward.
- **CLUI System**: Command Line UI for account management, global search, and workspace actions.
- **Replit Config System**: Full support for `.replit` and `replit.nix` configuration files.

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Nodemailer**: For sending emails (password resets, verification, invites).
- **Stripe**: For billing, subscriptions, and payment processing.
- **Anthropic Claude Sonnet, OpenAI GPT-4o, Google Gemini Flash**: AI model providers for chat, agent, and project generation.
- **Tavily API**: Primary web search for AI agent.
- **Brave Search API**: For web image search.
- **ElevenLabs**: For Text-to-Speech functionality.
- **DALL-E 3**: For AI image generation.
- **NanoBanana (Stable Diffusion XL)**: Fallback AI image generation.
- **GitHub API**: For Git integration (import, export, sync).
- **Figma API**: For AI-powered React component generation from design contexts.
- **Vercel, Bolt, Lovable**: Integrated import sources for projects.
- **Slack (via @slack/bolt)**: For automation triggers.
- **Telegram (via telegraf)**: For automation triggers.
- **node-cron**: For cron job scheduling in automations.
- **node-pty**: For real terminal emulation.
- **ws**: WebSocket library for real-time communication.
- **Yjs**: CRDT library for collaborative editing.
- **Helmet.js**: For enhancing security headers.
- **Acorn, Acorn-Walk**: For JavaScript AST analysis.
- **esbuild**: For TypeScript transpilation.
- **pdfkit, docx, exceljs, pptxgenjs**: For generating various document formats.