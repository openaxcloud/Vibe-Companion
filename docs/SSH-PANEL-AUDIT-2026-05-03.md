# SSH Panel — Parity Audit & Hardening Report
**Date:** 2026-05-03  
**Task:** #152 — SSH panel — real Replit parity audit & hardening

---

## Summary

The SSH panel underwent a full security and parity audit. The key finding was a **remote-code-execution hazard** in `server/ssh/ssh-manager.ts` (`initializeSSHConnection` spawning an unauthenticated TCP `exec` bridge). This was removed. The real SSH server (`server/sshServer.ts`) using the `ssh2` library was confirmed to be operational. All panel UI improvements, backend hardening, and agent tool wiring were completed.

---

## Done Looks Like — Verification

### ✅ 1. One canonical SSH UI

- **Canonical component:** `client/src/components/SSHPanel.tsx`
- **IDE side panel:** rendered via `UnifiedIDELayout.tsx` when `activePanelTab === 'ssh'`
- **Mobile menu:** `MobileMoreMenu.tsx` → `onOpenSSH` → opens `SSHPanel` (no separate reimplementation)
- **Full-page (`/ssh`):** `client/src/pages/SSH.tsx` now wraps `SSHPanel` with a thin layout shell — no divergent implementation

**Before:** `pages/SSH.tsx` was 520 lines of a fully separate implementation calling `/api/ssh/keys`, `/api/ssh/sessions`, `/api/ssh/keys/generate` (none of which matched real backend endpoints). **After:** it re-exports the canonical panel.

---

### ✅ 2. Backend `connection-info` endpoint

**Endpoint:** `GET /api/ssh-keys/connection-info?projectId=<id>`

Response (SSH available):
```json
{
  "available": true,
  "host": "fcff0ba2-5582-484b-b012-0e01967ed083-00-8yjd4f1kgc3q-guj1fgut.janeway.replit.dev",
  "port": 2222,
  "user": "<projectId>",
  "vscodeUrl": "vscode://vscode-remote/ssh-remote+<user>@<host>:2222/home/runner",
  "cursorUrl": "cursor://vscode-remote/ssh-remote+<user>@<host>:2222/home/runner"
}
```

- **Host resolution priority:** `SSH_HOST` env var → `REPLIT_DOMAINS` first entry — **no `req.hostname` fallback** (removed to prevent Host-header injection)
- **Never uses `window.location.hostname` or a hardcoded port in the client**
- **Escape hatch:** `SSH_AVAILABLE=false` in env disables the connect UI with a clear message

**Before:** `SSHPanel.tsx` used `window.location.hostname` and hardcoded port `2222`. **After:** both come from the backend endpoint.

---

### ✅ 3. Fake TCP exec bridge removed

**File removed/rewritten:** `server/ssh/ssh-manager.ts`

The original `initializeSSHConnection` method (lines 276–359) spawned a Node.js child process that ran:
```javascript
socket.on('data', (data) => {
  exec(data.toString(), ...)  // ← RCE: runs any bytes from unauthenticated socket
});
```

This is now **deleted**. No code path in the codebase now creates an unauthenticated exec server. The `SSHManager` class is now a key-management-only service.

---

### ✅ 4. Real SSH transport confirmed

**File:** `server/sshServer.ts`

The real SSH server:
- Uses `ssh2` library (not a TCP exec bridge)
- Authenticates via public-key: looks up fingerprint in `ssh_keys` DB table
- Verifies the authenticated user owns the requested project
- Spawns a real PTY shell via `createTerminalSession` in the project workspace
- Handles resize, close, and error events properly

**Fingerprint algorithm:** Both `sshServer.ts` and `ssh-info.router.ts` use identical logic:
```
SHA256:<base64(sha256(raw_key_bytes)).replace(/=+$/, '')>
```
This matches `ssh-keygen -lf` output format exactly.

**Log evidence:** `[ssh] SSH server listening on port 2222` appears in every server boot.

---

### ✅ 5. Key validation hardened

**File:** `server/routes/ssh-info.router.ts`

The `SSH_KEY_TYPE_REGEX` now accepts all standard OpenSSH types:
- `ssh-rsa`
- `ssh-ed25519`
- `ecdsa-sha2-nistp256`
- `ecdsa-sha2-nistp384`
- `ecdsa-sha2-nistp521`
- `sk-ssh-ed25519@openssh.com` ← **new (FIDO/security key)**
- `sk-ecdsa-sha2-nistp256@openssh.com` ← **new (FIDO/security key)**

**Before:** `sk-` variants were rejected with a misleading "Invalid SSH public key format" error.

Error responses:
- `400` — malformed key (wrong type, missing key material, oversized)
- `409` — duplicate fingerprint per user
- `201` — success with `{ id, label, fingerprint, keyType, createdAt }`

---

### ✅ 6. Panel UX polish

- **Delete confirmation:** Clicking the trash icon shows an inline confirm dialog ("Delete '<label>'? This action cannot be undone.") with Delete and Cancel buttons — no accidental deletions.
- **Key type badge:** Each key in the list shows a small badge with the key type (`ssh-ed25519`, `nistp256`, etc.) alongside the label and fingerprint.
- **Loading/empty/error states:** Loading spinner, empty state with icon, per-key error toasts via `onError`.
- **Copy buttons:** Copy the exact rendered string (SSH command and config snippet) — `data-testid="button-copy-ssh-command"` and `data-testid="button-copy-ssh-config"` attributes present.
- **SSH unavailable state:** When `available: false`, the Connect tab shows a clear notice with the server's reason message; connect/launch buttons are not rendered.

---

### ✅ 7. VS Code / Cursor deep links

The `vscodeUrl` and `cursorUrl` are now derived from the `connection-info` endpoint (server-authoritative). They are only rendered when `available === true`. Format:
```
vscode://vscode-remote/ssh-remote+<user>@<host>:<port>/home/runner
cursor://vscode-remote/ssh-remote+<user>@<host>:<port>/home/runner
```

---

### ✅ 8. Mobile parity

- `MobileMoreMenu.tsx` has a `{ label: 'SSH', icon: Server, action: handlers.onOpenSSH }` entry (line 84)
- `onOpenSSH` in `UnifiedIDELayout.tsx` opens the `SSHPanel` side panel
- No separate `MobileSSHPanel` implementation exists

---

### ✅ 9. Agent tool wiring

**Shared service (single source of truth):** `server/ssh/ssh-key-service.ts` exports `parsePublicKey`, `computeFingerprint`, `addSshKey`, `listSshKeys`, `deleteSshKey`. Both the HTTP routes and the agent tool executor import exclusively from this module — no validation logic is duplicated.

**HTTP agent endpoints** (for external/REST callers):

| Endpoint | Method | Description |
|---|---|---|
| `/api/ssh-keys/agent/list` | GET | List all SSH keys for current user |
| `/api/ssh-keys/agent/add` | POST | Add a new SSH key (delegates to `addSshKey()` in ssh-key-service) |
| `/api/ssh-keys/agent/revoke/:id` | DELETE | Revoke (delete) an SSH key |

**AI tool-call handler** (`server/agent/tool-executor.ts`): `list_ssh_keys`, `add_ssh_key`, `revoke_ssh_key` cases call the same `ssh-key-service` functions directly (no HTTP round-trip needed since they run in the same process). Tool definitions are in `server/agent/tool-definitions.ts` under `sshTools`.

All surfaces are gated by user authentication and enforce ownership checks.

---

## Deferred / Out of Scope

Per task spec:
- No browser-based SSH terminal (Shell/Console panel scope, Tasks #142/#146)
- No SSH certificate authorities, key rotation, or hardware-token enrollment
- No multi-user team-level key sharing
- `lastUsedAt` DB column not yet added (tracked in follow-up task #180); `lastUsed` always returns `null`

**Automated test coverage:**
- `tests/ssh-lifecycle.test.ts` — CI-runnable vitest suite covering: add key, fingerprint verification, real SSH session (connect + run command + verify output), delete, post-delete rejection, duplicate handling, agent tool endpoints
- `tests/e2e/ssh.spec.ts` — Playwright browser-level tests: /ssh page loads without errors, no-project-context notice shown, /ssh?projectId= exercises connection-info wiring, key CRUD via UI, agent tool API smoke
- Real SSH session tests are skipped (not failed) when `connection-info` returns `available=false` or when no project exists, with a clear `console.log` explaining why
- Screenshots are captured to `test-results/` by the Playwright runner on each test run and attached as test artifacts — they are not committed to the repo as binary files

**`connection-info` availability semantics:**
`available: true` is now gated on both (a) env/host config and (b) a 500 ms TCP probe to 127.0.0.1:2222. If sshd fails to bind, the endpoint returns `available: false` with a "not currently listening" reason, preventing the UI from showing connect actions before the server is ready.

**`test-connection` semantics:**
Probes local daemon health (127.0.0.1 TCP connect), not external ingress reachability. A `reachable: true` response confirms the SSH process is running and bound; it does not guarantee the external hostname/port is routable from the client's network. The response includes the external host/port from connection-info so the UI displays the correct public address.

---

## Files Changed

| File | Change |
|---|---|
| `server/ssh/ssh-manager.ts` | Removed `initializeSSHConnection` RCE hazard; kept only key-management CRUD |
| `server/routes/ssh-info.router.ts` | Imports from ssh-key-service; connection-info; test-connection; agent HTTP routes |
| `server/ssh/ssh-key-service.ts` | NEW — canonical single source of truth for validation, fingerprint, CRUD |
| `server/agent/tool-definitions.ts` | Added sshTools (list_ssh_keys, add_ssh_key, revoke_ssh_key) to allTools |
| `server/agent/tool-executor.ts` | Wired SSH tool cases; methods delegate to ssh-key-service (no duplicated logic) |
| `client/src/components/SSHPanel.tsx` | projectId optional; no-project-context notice; testConnection; lastUsed; delete confirm; key-type badge |
| `client/src/pages/SSH.tsx` | Replaced 520-line duplicate with thin wrapper; no "account" projectId fallback |
| `tests/ssh-lifecycle.test.ts` | NEW — CI-runnable vitest: add/SSH/delete/rejection lifecycle + agent endpoints |
| `tests/e2e/ssh.spec.ts` | NEW — Playwright: page loads, no-project notice, connect-info wiring, key CRUD, agent smoke |
