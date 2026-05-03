# Shell Panel — Replit Parity Audit

**Date:** 2026-05-03  
**Reference:** https://docs.replit.com/core-concepts/project-editor/editor-and-tools/shell  
**Canonical transport:** `/api/terminal/ws` (PTY WebSocket, `server/terminal/pty-terminal-service.ts`)  
**Canonical frontend:** `WorkspaceTerminal` (xterm.js, `client/src/components/WorkspaceTerminal.tsx`)

---

## Decision: Canonical Stack

| Layer | Winner | Rationale |
|---|---|---|
| Frontend terminal renderer | `WorkspaceTerminal` (xterm.js, `@xterm/xterm`) | Full PTY emulation, SearchAddon, FitAddon, WebLinksAddon, resize, theme support |
| Shell UI chrome (desktop) | `ReplitDesktopShell` (wraps WorkspaceTerminal) | Multi-tab, search, clear, restart, generate, fullscreen |
| Shell UI chrome (mobile) | `ReplitMobileShell` (wraps WorkspaceTerminal) | Sheet menu (clear/restart/find/close), touch-friendly tab picker |
| Responsive wrapper | `ResponsiveShell` | Switches Desktop/Mobile at 768 px breakpoint |
| IDE panel | `ShellPanel` / `ReplitTerminalPanel` | Thin wrappers around WorkspaceTerminal used in IDE layout |
| WebSocket transport | `/api/terminal/ws` (plain WS, `PTYTerminalService`) | PTY-native, Redis-backed, registered via central upgrade dispatcher |
| Legacy / retired (frontend) | Standalone `AdvancedTerminal`, standalone `ReplitTerminal` | Both converted to thin wrappers around WorkspaceTerminal — no raw xterm/WS |
| Legacy (backend) — DISABLED | `/shell` WS, `/ws/terminal`, `/terminal` | Return HTTP 410 Gone via central dispatcher; REST routes preserved |

---

## Feature-by-Feature Audit

### Core Connection & PTY

| Feature | Status | Notes |
|---|---|---|
| Opens a real PTY within ~1 s | **Match** | `createLocalSession` / `createDockerSession` in `pty-terminal-service.ts` |
| xterm.js rendering (ANSI, cursor, scrollback) | **Match** | `@xterm/xterm` in `WorkspaceTerminal.tsx` with `DARK_THEME` / `LIGHT_THEME` |
| Clickable URLs in output | **Match** | `WebLinksAddon` |
| Terminal resize follows panel | **Match** | `ResizeObserver` + `FitAddon.fit()` + `{type:"resize"}` WS message |
| Garbled output on resize prevented | **Match** | `FitAddon.fit()` on `ResizeObserver` and `window.resize` |
| Copy (Ctrl+C / Ctrl+Shift+C) | **Match** | Native xterm.js clipboard behavior |
| Paste (Ctrl+Shift+V) | **Match** | Native xterm.js; `terminal.paste()` via clipboard API |
| rightClickSelectsWord | **Gap (minor)** | Not enabled in `WorkspaceTerminal` defaults; low impact |
| Command history (up/down arrows) | **Match** | PTY bash handles natively |
| In-terminal search | **Match** | `SearchAddon` wired in `WorkspaceTerminal.tsx`; exposed via `WorkspaceTerminalHandle.searchNext/Previous/clearSearch` |
| Bell on activity | **Match** | `bellStyle: shellBell ? "sound" : "none"` |
| Connection status indicator | **Match** | `onConnectionChange` callback propagates `ws.onopen`/`ws.onclose` → `isConnected` state in `ReplitDesktopShell` |

### Multi-Tab & Session Management

| Feature | Status | Notes |
|---|---|---|
| Multiple shell tabs | **Fixed** | `ReplitDesktopShell` creates per-tab `sessionId`; first tab always uses `"default"` |
| Each tab is an independent PTY | **Fixed** | `pty-terminal-service.ts`: session map key is now `${projectId}:${sessionId}` |
| Agent commands always land in active shell | **Fixed** | `executeInSession(projectId, cmd)` looks up `${projectId}:default` — matches first tab's sessionId |
| Tab rename | **Fixed** | Settings dropdown → Rename Tab via `window.prompt` |
| Tab close (×) | **Match** | Desktop and mobile both close individual tabs |
| Session persists across page reload | **Match** | Redis `outputSnapshot` replayed on reconnect |
| Reconnect indicator | **Match** | `WorkspaceTerminal` writes amber `[Session reconnected]` banner on resume |
| Idle session reap (30 s) | **Match** | `handleDisconnect` 30 s `setTimeout` → `cleanupSession` |
| Max concurrent sessions | **Match** | `maxSessions` env-configurable, default 500 (`TERMINAL_MAX_SESSIONS`) |

### Toolbar CTAs

| Button | Status | Notes |
|---|---|---|
| New tab (+) | **Match** | Creates unique `sessionId`, spawns new PTY |
| Close tab (×) | **Match** | Closes tab; WS cleaned up by idle reaper |
| Rename tab | **Fixed** | `window.prompt` rename via Settings dropdown |
| Clear terminal | **Fixed** | `xterm.clear()` + `POST /api/shell/clear` clears server-side commandHistory + outputBuffer and re-checkpoints to Redis (desktop and mobile) |
| Restart session | **Fixed** | Calls `sendRaw({ type: "restart" })` → server kills + respawns PTY; toast confirms |
| Paste | **Fixed** | Clipboard button → `WorkspaceTerminalHandle.paste()` → `navigator.clipboard.readText()` → `xterm.paste()` |
| Copy selection | **Match** | `window.getSelection()` → `navigator.clipboard.writeText` |
| Search (Ctrl+F) | **Fixed** | `SearchAddon.findNext/findPrevious` wired through `WorkspaceTerminalHandle` |
| Download log | **Fixed** | `GET /api/shell/log/:projectId/:sessionId` returns live outputSnapshot (8 KiB, raw PTY) or Redis checkpoint; Download button in toolbar triggers browser file download |
| Font size | **Fixed** | `fontSize` prop → `termRef.current.options.fontSize = fontSizeProp` (typed xterm API, no `as any`) |
| Fullscreen | **Match** | `isFullscreen` → `fixed inset-0 z-50` |
| Generate command (AI) | **Match** | Calls `/api/shell/generate-command`; inserts result via `sendRaw({ type: "input" })` |
| Reconnect | **Fixed** | Reconnect button → `WorkspaceTerminalHandle.reconnect()` → resets retry counter + calls `connect(url)` |
| Help | **Fixed** | Links to Replit Shell docs URL |
| Auto-reconnect (3 retries × 3 s) | **Match** | `WorkspaceTerminal` retry loop |
| Font size persistence | **Fixed** | Selection saved to `localStorage` key `shell:fontSize`, restored on mount |

### Transport & Protocol

| Feature | Status | Notes |
|---|---|---|
| Canonical endpoint: `/api/terminal/ws` | **Match** | Priority 30 in `centralUpgradeDispatcher` |
| Cookie session auth | **Match** | `ecode.sid` parsed in `handleConnection` |
| JWT token auth fallback | **Match** | `?token=` / `Authorization: Bearer` |
| Unauthenticated rejection (all environments) | **Fixed** | `ws.close(1008, "Authentication required")` — enforced regardless of environment |
| Per-project authorization — all ID formats | **Fixed** | Non-numeric projectId → 1008 "Invalid project". Missing project → 1008 "Project not found". Wrong owner → 1008 "Access denied". Auth error → 1011. |
| Input size cap (1 MB) | **Match** | `MAX_MESSAGE_SIZE = 1024 * 1024` |
| Ping/pong keepalive | **Match** | `{ type: "ping" }` → `{ type: "pong" }` |
| Structured close codes | **Match** | 1008 (auth/quota), 1011 (internal), 1000 (clean) |
| `restart` message type | **Fixed** | New: `{ type: "restart" }` → `cleanupSession` + respawn |
| `close_session` message type | **Fixed** | New: `{ type: "close_session" }` → immediate `cleanupSession` |
| Legacy `/shell` WS endpoint | **Fixed** | Returns HTTP 410 Gone via central dispatcher; REST routes preserved |
| Legacy `/ws/terminal` endpoint | **Fixed** | Returns HTTP 410 Gone via central dispatcher; httpServer fallback removed |

### Redis Session Persistence

| Feature | Status | Notes |
|---|---|---|
| Scrollback bounded (circular buffer 10 000) | **Match** | `CircularBuffer(10000)` |
| Output snapshot persisted to Redis on cleanup | **Match** | `cleanupSession` → `redisSessionManager.saveSession(outputSnapshot)` |
| Snapshot replayed on reconnect | **Match** | `handleConnection` sends `{ type: "history" }` from Redis snapshot |
| Redis key includes sessionId | **Fixed** | Key is now `terminal-${projectId}:${sessionId}` — tabs don't overwrite each other |
| Session TTL 24 h | **Match** | `SESSION_TTL_SECONDS = 86400` |
| Redis unavailable → graceful degradation | **Match** | `isAvailable()` guard; runs without persistence if Redis is down |

### Agent ↔ Shell Integration

| Feature | Status | Notes |
|---|---|---|
| Agent commands injected into active session | **Fixed** | `executeInSession(projectId, cmd)` resolves to `${projectId}:default` (first tab) |
| User can see agent output in terminal | **Match** | Same PTY session; all output appears in tab 1 |
| Separate labeled "Agent" tab | **Fixed** | First tab permanently labeled "Agent" with Sparkles icon; pinned (cannot be closed); sessionId "default" matches `executeInSession()` routing |

### Security & Hardening

| Feature | Status | Notes |
|---|---|---|
| Docker container isolation (production) | **Match** | `--cap-drop ALL --security-opt no-new-privileges --read-only --memory 512m --cpus 1.0` |
| Replit VM: local PTY allowed | **Match** | `getAllowInsecureLocalPty()` returns true on Replit VM (OS-level container isolation); auth still enforced |
| tmpfs for /tmp | **Match** | `--tmpfs /tmp:rw,nosuid,size=128m` |
| Input size cap | **Match** | 1 MB message limit |
| Output backpressure | **Match** | `CircularBuffer` bounded at 10 000 chunks |
| Idle session reap | **Match** | 30 s → `cleanupSession` |
| Max sessions cap | **Match** | `maxSessions = 500` (env-configurable via `TERMINAL_MAX_SESSIONS`) |
| Escape sequence sanitation | **Known minor gap** | xterm.js VT parser is safe for display; raw shell injection via untrusted output is a known limitation of all terminal emulators |

### Mobile

| Feature | Status | Notes |
|---|---|---|
| Mobile shell uses real xterm.js PTY | **Fixed** | `ReplitMobileShell` now wraps `WorkspaceTerminal` instead of fake div |
| Touch scrolling | **Match** | Inherited from xterm.js |
| Mobile tab picker (dropdown) | **Match** | `DropdownMenu` tab list |
| Mobile find / search | **Fixed** | SearchAddon wired via `WorkspaceTerminalHandle` |
| Mobile Clear Shell | **Fixed** | Sheet menu → `xterm.clear()` + `POST /api/shell/clear` persists buffer reset server-side |
| Mobile Restart Shell | **Fixed** | Sheet menu → `sendRaw({ type: "restart" })` |
| Mobile history navigation (↑/↓) | **Fixed** | `replace_line` custom message removed; arrow keys send standard ANSI `\x1B[A` / `\x1B[B` which PTY bash/readline handles natively |
| Sheet (bottom drawer) menu | **Match** | `Sheet` component |

---

## Known Intentional Differences / Gaps

| Gap | Severity | Tracked |
|---|---|---|
| rightClickSelectsWord not enabled | Low | No |
| Escape sequence sanitation | Low | No |
| Load test requires auth cookie in CI (follow-up) | Low | Follow-up #172 |

---

## Load Test Results

Target: ≥ 95% of concurrent PTY sessions PTY-ready (type:"ready" received), max event-loop lag < 500 ms.  
Script: `scripts/load-test-terminal.mjs`  
Auth: auto-login (admin@test.com) → session cookie (`ecode.sid`) passed to all 500 WS connections.

### Dev run — 2026-05-03 (Replit VM, 500 concurrent authenticated PTY sessions)

```
$ node scripts/load-test-terminal.mjs --sessions 500 --duration 20 \
    --host localhost:5000 --projectId 1

Auth:       auto-login as admin@test.com
Auth:       session cookie obtained (167 chars, cookies: ecode.csrf, ecode.sid)

=== Terminal Load Test ===
Sessions:   500
Duration:   20s
Target:     ws://localhost:5000/api/terminal/ws
Project:    1

Opening 500 sessions (10ms stagger)...
All sessions initiated. Holding open for 20s...
[24.9s] open=500/500 msgs=1000 bytes=48KB lag=2ms

Closing sessions...
=== Results ===
Duration:              27.44s
Sessions opened:       500/500 (100.0% handshake)
Sessions PTY-ready:    500/500 (100.0% authenticated PTY live) ← primary metric
Sessions failed:       0
Messages received:     1000
Data received:         0.05 MB

Connect latency (open):
  p50: 21.1 ms
  p95: 557.5 ms
  p99: 583.5 ms

PTY ready latency (open → ready):
  p50: 4536.8 ms
  p95: 6077.2 ms
  p99: 6123.6 ms

Event-loop lag:
  median: 0.3 ms
  p95:    1.2 ms
  max:    1.7 ms  ✓ ok

Result: ✓ PASS
Target: ≥95% of 500 sessions PTY-ready · max event-loop lag < 500ms
```

**Notes:**
- Primary metric is PTY-ready (type:"ready" from server) — not just WS handshake open.
- 500/500 sessions (100%) reached PTY-ready with authenticated session cookie.
- PTY-ready latency p50 ~4.5 s reflects local PTY spawn time on Replit VM (500 concurrent).
  Production with Docker isolation will show different spawn latency but same auth path.
- Event-loop lag max 1.7 ms — well below the 500 ms threshold.
- "Server at capacity" (1008) correctly fired for any 501st connection (maxSessions=500).
- Wire into CI with `LOAD_TEST_COOKIE` env secret for pre-authenticated runs (follow-up #172).

### WS security checks (2026-05-03)

```
no-auth → 1008 Authentication required ✓
empty projectId → 1008 ✓
/ws/terminal → HTTP 410 Gone ✓
/shell → HTTP 410 Gone ✓
```

---

## File Map

| Behavior | File |
|---|---|
| WebSocket PTY backend (canonical) | `server/terminal/pty-terminal-service.ts` |
| Redis session persistence | `server/terminal/redis-session-manager.ts` |
| Socket.IO PTY backend (legacy, not removed) | `server/terminal/socket-io-terminal.ts` |
| xterm.js terminal component | `client/src/components/WorkspaceTerminal.tsx` |
| IDE Shell panel (thin wrapper) | `client/src/components/editor/ShellPanel.tsx` |
| IDE Terminal panel (thin wrapper) | `client/src/components/editor/ReplitTerminalPanel.tsx` |
| Desktop Shell UI chrome | `client/src/components/shell/ReplitDesktopShell.tsx` |
| Mobile Shell UI chrome | `client/src/components/shell/ReplitMobileShell.tsx` |
| Responsive wrapper | `client/src/components/shell/ResponsiveShell.tsx` |
| Load test script | `scripts/load-test-terminal.mjs` |
