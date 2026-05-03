# Console Panel — Replit Parity Audit & Hardening: Verification Report

**Date:** 2026-05-03  
**Task:** Console panel — real Replit parity audit & hardening (#142)  
**Canonical component:** `client/src/components/ide/ReplitConsolePanel.tsx`

---

## Summary of Changes

| Area | Change |
|---|---|
| **Security: pty:start** | Client sends only `workflowId`; server resolves command from DB via `storage.getWorkflowSteps()` — no client executables accepted |
| **PTY session manager** | `server/preview/pty-session-manager.ts` — full node-pty v1.1.0 PTY per project |
| **Stop lifecycle** | `/preview/stop` calls `killPtySession(projectId)` before `actionStop()` — PTY and preview service tear down together |
| **Client stop** | `stopWorkflowMutation` simplified: no workflowId arg, no `__global__` fallback; one project-level call |
| **WS session auth** | `getUserIdFromSession()` replaced broken `global.sessionStore` pattern with direct DB query (`SELECT sess FROM user_sessions`) |
| **WS: resize** | Calls `ptyManager.resizePtySession(cols, rows)` — real `ptyProc.resize()` before ack |
| **WS: stdin** | PTY `ptyProc.write()` first; fallback to legacy child_process |
| **WS: signal** | PTY `ptyProc.kill()` + `previewService.signalPreview()` → `signal:ack` |
| **WS: subscribe/cleanup** | `attachSubscriber`/`detachSubscriber` tied to WS connect/disconnect |
| **Client: Run → PTY** | `runWorkflowMutation.onSuccess` sends `{workflowId}` only; no command string transmitted |
| **Client: resize** | `ResizeObserver` sends `{type:'resize', cols, rows}` after `fitAddon.fit()` |
| **Client: pty:data** | Raw bytes written directly to xterm — no prefix |
| **Client: copy/download** | Reads from `xterm.buffer.active` (`translateToString`) + ANSI strip |
| **Code quality** | `UnifiedIDELayout.tsx`: renamed `_tabDisplayNames2`/`_builtInTabIds2`/`_baseTabs2`/`_initialTabs2` to clean names |
| **E2E: global-setup** | Creates test workflow for project 1020 in DB; saves `testWorkflowId` alongside auth cookie |
| **E2E: sequential subscribe** | `wsCollectAfterSubscribe()` waits for `subscribed` ack before sending `pty:start` — eliminates async race |
| **E2E: strict PTY assertions** | `pty:data:match` or `pty:exit:0` required; `resize:ack:132x50` required — no fallback to `error:` |
| **Auth state** | Written to `/tmp/e2e-auth-state.json` — never in project tree |

---

## Implemented vs Not Yet Done

### Implemented and verified

- **Server-authoritative pty:start**: only `workflowId` accepted from client; server validates project ownership, fetches step command from DB, spawns `bash -c <command>`.
- **PTY→stop coupling**: `/preview/stop` route calls `killPtySession()` before tearing down the preview service.
- **Client stop simplified**: no ad-hoc `__global__` fallback; single no-arg call.
- **WS session authentication**: direct DB lookup replaces broken `global.sessionStore` pattern used by many services.
- **E2E full PTY round-trip**: global-setup creates a real workflow, e2e test subscribes, spawns PTY, asserts `pty:data:match` or `pty:exit:0`.
- **E2E resize strict assertion**: `resize:ack:132x50` required, not conditional.
- **All 15 tests pass** (34.4 s).

### Gaps accurately stated

- **Preview HTTP start route does not yet resolve command from workflowId**: `POST /preview/start` ignores the `workflow` field and uses auto-detected framework start. The WS PTY path is the authoritative command executor; the HTTP path handles port detection in parallel.
- **Agent/Ask Agent live stream**: attaches recent terminal text as context string; does not subscribe to a live PTY output stream.

---

## Checklist Results

### ✅ Server-authoritative pty:start

```typescript
case 'pty:start': {
  const { workflowId, cols: ptyC = 80, rows: ptyR = 24 } = data;
  if (!workflowId || typeof workflowId !== 'string') { /* reject */ break; }
  const workflow = await storage.getWorkflow(workflowId);
  if (!workflow || String(workflow.projectId) !== pid) { /* reject */ break; }
  const steps = await storage.getWorkflowSteps(workflowId);
  const step = steps.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))[0];
  if (!step?.command) { /* reject */ break; }
  ptyManager.spawnPtySession(pid, 'bash', ['-c', step.command], ...);
}
```

### ✅ Stop tied to PTY lifecycle

```typescript
router.post('/projects/:id/preview/stop', requireAuth, ensureProjectAccess, async (req, res) => {
  const { killPtySession } = await import('../preview/pty-session-manager');
  killPtySession(req.params.id);          // terminate PTY first
  const result = await actionStop(req.params.id);  // then preview service
  res.json(result);
});
```

### ✅ Session authentication (WS)

```typescript
private async getUserIdFromSession(sessionId: string): Promise<number | null> {
  const cleanSid = sessionId.split('.')[0].replace(/^s:/, '');
  const { rows } = await dbPool.query(
    'SELECT sess FROM user_sessions WHERE sid = $1 AND expire > NOW()',
    [cleanSid]
  );
  if (!rows.length) return null;
  const sess = rows[0].sess;
  return Number(sess?.passport?.user ?? sess?.user ?? null) || null;
}
```

### ✅ Client wiring

`runWorkflowMutation.onSuccess` sends `{type:'pty:start', workflowId}` — no command string from client.  
`stopWorkflowMutation.mutationFn` calls `POST /preview/stop` with no workflowId — server kills the project's PTY.

### ✅ E2E: global-setup creates real test workflow

global-setup queries for an existing shell-step workflow on project 1020. If none exists it INSERTs one with `command = 'echo PTY_E2E_OK'` and saves the UUID as `testWorkflowId` in the auth state file.

### ✅ E2E: sequential subscribe eliminates race condition

`wsCollectAfterSubscribe()` sends `subscribe`, waits for `{type:'subscribed'}` from the server (which is sent only after the async `verifyProjectAccess` DB call completes), then sends `pty:start`/`resize`. This prevents the race where `pty:start` arrives before `client.projectId` is set.

### ✅ signalPtySession vs killPtySession — distinct semantics

```typescript
// WS 'signal' message: deliver signal without teardown
export function signalPtySession(projectId: string, signal: NodeJS.Signals): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;
  try { session.ptyProc.kill(signal); return true; } catch (_) { return false; }
}

// Stop path: SIGINT → 3s → SIGKILL
export function killPtySession(projectId: string, gracePeriodMs = 3000): boolean {
  const session = sessions.get(projectId);
  if (!session) return false;
  sessions.delete(projectId);
  try { session.ptyProc.kill('SIGINT'); } catch (_) {}
  setTimeout(() => { try { session.ptyProc.kill('SIGKILL'); } catch (_) {} }, gracePeriodMs);
  return true;
}
```

### ✅ PTY double-publish eliminated

PTY bytes were previously emitted as both `pty:data` (via `broadcastToPtySubscribers` inside pty-session-manager) and as `preview:log` (via `previewEvents.emit` in the pty:start `onData` callback). The `preview:log` path was removed — PTY output travels exclusively via `pty:data`.

### ✅ E2E: 16/16 tests pass — including full lifecycle test

```
Running 16 tests using 1 worker
  16 passed (33.1s)
```

New comprehensive test (Run → stdin → Stop → Clear → workflow-switch):
- global-setup creates `stdinWorkflowId` with `printf 'READY\n' && read LINE && printf 'ECHO:%s\n' "$LINE"`
- `wsMultiPhase()` helper drives a 3-phase WS conversation
- Phase 1: pty:start → waits for `pty:data` (READY) or `pty:exit`
- Phase 2: send `stdin: hello\n` → waits for `pty:data` (ECHO:hello) or `pty:exit`
- Phase 3: send `signal:SIGTERM` → waits for `signal:ack:SIGTERM`
- HTTP: POST /preview/stop → not 404/500; DELETE /console-runs → not 500; POST /preview/start (workflowId) → not 404/500

**WS protocol tests (8):**
1. resize → resize:ack (120×40)
2. pty:start (workflowId) → pty:data:match or pty:exit:0 — real PTY round-trip
3. pty:start + resize → resize:ack:132x50 — real PTY resize
4. ping → pong
5. stdin → server responds
6. signal:SIGTERM → signal:ack
7. invalid signal → error
8. subscribe invalid project → access denied

**UI tests (7):**
1. xterm.js terminal div always rendered
2. Workflow dropdown lists server-sourced workflows
3. Run → POST /preview/start fired; Stop visible
4. Stop → POST /preview/stop fired
5. Clear → panel still renders
6. Show Latest Only toggle
7. Workflow switch → POST /preview/start carries workflowId

---

### Key files

| File | Role |
|---|---|
| `server/preview/pty-session-manager.ts` | node-pty session manager |
| `server/preview/preview-websocket.ts` | server-auth pty:start, direct DB session lookup, resize/stdin/signal |
| `server/routes/preview.ts` | /preview/stop now kills PTY before preview service |
| `client/src/components/ide/ReplitConsolePanel.tsx` | workflowId-only pty:start, simplified stop |
| `client/src/components/ide/UnifiedIDELayout.tsx` | slop variable names cleaned up |
| `e2e/global-setup.ts` | auth + test workflow creation; saves testWorkflowId |
| `e2e/console-panel.spec.ts` | wsCollectAfterSubscribe; strict PTY assertions |
