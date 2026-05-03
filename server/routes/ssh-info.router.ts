import { Router, Request, Response } from 'express';
import { z } from 'zod';
import net from 'net';
import { storage } from '../storage';
import { ensureAuthenticated } from '../middleware/auth';
import {
  addSshKey,
  listSshKeys,
  deleteSshKey,
  MAX_PUBLIC_KEY_BYTES,
} from '../ssh/ssh-key-service';

const router = Router();

// Short-lived cache for the local sshd liveness probe.
// Prevents a 500 ms TCP probe on every connection-info request under load.
// TTL is intentionally short (5 s) so failures propagate quickly to the UI.
let sshdLivenessCache: { reachable: boolean; port: number; expiresAt: number } | null = null;

async function probeSshdLiveness(port: number): Promise<boolean> {
  const now = Date.now();
  if (sshdLivenessCache && sshdLivenessCache.port === port && sshdLivenessCache.expiresAt > now) {
    return sshdLivenessCache.reachable;
  }

  const reachable = await new Promise<boolean>((resolve) => {
    const probe = new net.Socket();
    let settled = false;
    const settle = (ok: boolean) => {
      if (!settled) { settled = true; probe.destroy(); resolve(ok); }
    };
    probe.setTimeout(500);
    probe.connect(port, '127.0.0.1', () => settle(true));
    probe.on('error', () => settle(false));
    probe.on('timeout', () => settle(false));
  });

  sshdLivenessCache = { reachable, port, expiresAt: now + 5_000 };
  return reachable;
}

/**
 * Derive the public SSH hostname from trusted server-side environment config only.
 * Priority: SSH_HOST env var → REPLIT_DOMAINS first entry.
 * Returns null when no trusted host is configured — the client must then show
 * "SSH not available" rather than falling back to the request Host header.
 */
function resolveSshHost(): string | null {
  if (process.env.SSH_HOST) return process.env.SSH_HOST;

  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const primary = replitDomains.split(',')[0].trim();
    if (primary) return primary;
  }

  return null;
}

/**
 * GET /api/ssh-keys/connection-info
 * Returns whether SSH is available in this environment and the connection
 * parameters to show in the panel.  The client must NOT hard-code host/port/user.
 *
 * SSH is available when:
 *  - SSH_AVAILABLE is not 'false', AND
 *  - a trusted host can be resolved from SSH_HOST or REPLIT_DOMAINS env vars
 *
 * The ssh2 server starts unconditionally on port 2222 in index.ts.
 * Set SSH_AVAILABLE=false in env to explicitly disable the connect UI.
 */
router.get('/ssh-keys/connection-info', ensureAuthenticated, async (req: Request, res: Response) => {
  const sshExplicitlyDisabled = process.env.SSH_AVAILABLE === 'false';
  if (sshExplicitlyDisabled) {
    return res.json({
      available: false,
      reason: 'SSH access is not provisioned in this environment. Key management is still available so you can add keys for future use.',
      host: null,
      port: null,
      user: null,
      vscodeUrl: null,
      cursorUrl: null,
    });
  }

  const host = resolveSshHost();
  if (!host) {
    return res.json({
      available: false,
      reason: 'SSH host is not configured for this environment (set SSH_HOST or REPLIT_DOMAINS). Key management is still available.',
      host: null,
      port: null,
      user: null,
      vscodeUrl: null,
      cursorUrl: null,
    });
  }

  const port = parseInt(process.env.SSH_PORT || '2222', 10);

  // Gate availability on actual sshd liveness (result cached 5 s).
  const sshdReachable = await probeSshdLiveness(port);

  if (!sshdReachable) {
    return res.json({
      available: false,
      reason: `SSH server is not currently listening on port ${port}. It may still be starting up — try again shortly.`,
      host: null,
      port: null,
      user: null,
      vscodeUrl: null,
      cursorUrl: null,
    });
  }

  // Validate projectId ownership.  The SSH username IS the project ID — returning
  // a project the caller doesn't own would let them construct a valid SSH command
  // for another user's project.  If projectId is absent, omit the user field.
  const rawProjectId = (req.query.projectId as string) || '';
  let user: string | null = null;
  if (rawProjectId) {
    const project = await storage.getProject(rawProjectId).catch(() => null);
    const userId = (req.user as any)?.id;
    if (!project) {
      return res.status(400).json({ error: 'Project not found.' });
    }
    if (String(project.userId) !== String(userId)) {
      return res.status(403).json({ error: 'You do not own this project.' });
    }
    user = rawProjectId;
  }

  if (!user) {
    return res.json({
      available: true,
      host,
      port,
      user: null,
      vscodeUrl: null,
      cursorUrl: null,
    });
  }

  return res.json({
    available: true,
    host,
    port,
    user,
    vscodeUrl: `vscode://vscode-remote/ssh-remote+${user}@${host}:${port}/home/runner`,
    cursorUrl: `cursor://vscode-remote/ssh-remote+${user}@${host}:${port}/home/runner`,
  });
});

/**
 * POST /api/ssh-keys/test-connection
 *
 * Probes LOCAL sshd liveness: opens a TCP socket to 127.0.0.1:<port> and
 * reports whether the daemon is accepting connections inside this container.
 *
 * Scope: this is a local-daemon health check, NOT an external ingress probe.
 * A reachable=true response means the SSH server process is running and bound
 * to the expected port; it does not verify that the external hostname/port
 * is routable from the client's network.  Clients that need to verify
 * external SSH connectivity should attempt an actual ssh2 handshake.
 *
 * Response includes the external host/port from connection-info so the UI
 * can display "Reachable at <host>:2222" using the correct public address.
 */
router.post('/ssh-keys/test-connection', ensureAuthenticated, async (_req: Request, res: Response) => {
  const host = resolveSshHost();
  if (!host || process.env.SSH_AVAILABLE === 'false') {
    return res.json({ reachable: false, message: 'SSH is not configured for this environment.' });
  }

  const port = parseInt(process.env.SSH_PORT || '2222', 10);

  await new Promise<void>((resolve) => {
    const socket = new net.Socket();
    const timeout = 4000;
    let settled = false;

    // Single-settle guard: error and timeout events can both fire; only the
    // first one should write the response.
    const settle = (payload: object) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      res.json(payload);
      resolve();
    };

    socket.setTimeout(timeout);

    socket.connect(port, '127.0.0.1', () => {
      settle({ reachable: true, host, port, message: `SSH server reachable at ${host}:${port}` });
    });

    socket.on('error', (err: Error) => {
      settle({ reachable: false, host, port, message: `Could not reach SSH server: ${err.message}` });
    });

    socket.on('timeout', () => {
      settle({ reachable: false, host, port, message: `Connection to ${host}:${port} timed out` });
    });
  });
});

/**
 * GET /api/ssh-keys
 * List all SSH keys for the authenticated user.
 */
router.get('/ssh-keys', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    return res.json(await listSshKeys(userId));
  } catch {
    return res.status(500).json({ message: 'Failed to fetch SSH keys' });
  }
});

/**
 * POST /api/ssh-keys
 * Validate and store a new SSH public key.
 * Returns 400 for malformed keys, 409 for duplicates.
 */
router.post('/ssh-keys', ensureAuthenticated, async (req: Request, res: Response) => {
  const schema = z.object({
    label: z.string().min(1).max(100),
    publicKey: z.string().min(1).max(MAX_PUBLIC_KEY_BYTES),
  });

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(req.body);
  } catch (zodErr: any) {
    return res.status(400).json({ message: zodErr.errors?.[0]?.message ?? 'Invalid request body' });
  }

  const userId = req.session.userId!;
  const result = await addSshKey(userId, data.label, data.publicKey);

  if (!result.ok) {
    return res.status(result.statusCode).json({ message: result.message });
  }

  return res.status(201).json(result.key);
});

/**
 * DELETE /api/ssh-keys/:id
 * Remove an SSH key owned by the authenticated user.
 */
router.delete('/ssh-keys/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const deleted = await deleteSshKey(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ message: 'SSH key not found' });
    }
    return res.json({ message: 'SSH key deleted' });
  } catch {
    return res.status(500).json({ message: 'Failed to delete SSH key' });
  }
});

/**
 * GET /api/ssh-keys/agent/list  (agent tool)
 * List SSH keys for the current user — same as GET /api/ssh-keys but under
 * a stable agent-tool path so the AI chat handler can call it by name.
 */
router.get('/ssh-keys/agent/list', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    return res.json({ keys: await listSshKeys(userId) });
  } catch {
    return res.status(500).json({ message: 'Failed to list SSH keys' });
  }
});

/**
 * POST /api/ssh-keys/agent/add  (agent tool)
 * Add an SSH key for the current user — thin wrapper around addSshKey(),
 * callable by the AI chat tool layer.
 */
router.post('/ssh-keys/agent/add', ensureAuthenticated, async (req: Request, res: Response) => {
  // Accept both camelCase (publicKey — REST convention) and snake_case
  // (public_key — AI tool-call convention) so the same endpoint is usable
  // from HTTP clients and from the agent tool executor without mismatch.
  const body = { ...req.body };
  if (!body.publicKey && body.public_key) body.publicKey = body.public_key;

  const schema = z.object({
    label: z.string().min(1).max(100),
    publicKey: z.string().min(1).max(MAX_PUBLIC_KEY_BYTES),
  });

  let data: z.infer<typeof schema>;
  try {
    data = schema.parse(body);
  } catch (zodErr: any) {
    return res.status(400).json({ message: zodErr.errors?.[0]?.message ?? 'Invalid request body' });
  }

  const userId = req.session.userId!;
  const result = await addSshKey(userId, data.label, data.publicKey);

  if (!result.ok) {
    return res.status(result.statusCode).json({ message: result.message });
  }

  return res.status(201).json(result.key);
});

/**
 * DELETE /api/ssh-keys/agent/revoke/:id  (agent tool)
 * Revoke (delete) an SSH key for the current user.
 */
router.delete('/ssh-keys/agent/revoke/:id', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId!;
    const deleted = await deleteSshKey(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ message: 'SSH key not found or not owned by current user' });
    }
    return res.json({ message: 'SSH key revoked' });
  } catch {
    return res.status(500).json({ message: 'Failed to revoke SSH key' });
  }
});

export default router;
