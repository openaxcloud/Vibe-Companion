import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { previewService } from './preview-service';
import { EventEmitter } from 'events';
import { parse as parseCookie } from 'cookie';
import { storage } from '../storage';
import { pool as dbPool } from '../db';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import * as ptyManager from './pty-session-manager';

// Event emitter for preview updates
// NOTE: File changes are emitted by files.router.ts when files are mutated via REST API
// since project files are stored in the database, not the filesystem
export const previewEvents = new EventEmitter();

interface PreviewClient {
  ws: WebSocket;
  projectId?: number;
  userId: number;
  isAlive: boolean;
  lastPing: number;
  eventListeners: Map<string, (...args: any[]) => void>;
}

class PreviewWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, PreviewClient> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL_MS = 30000;
  private readonly CLIENT_TIMEOUT_MS = 90000;

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      noServer: true
    });

    centralUpgradeDispatcher.register('/ws/preview', async (request: IncomingMessage, socket: any, head: Buffer) => {
      markSocketAsHandled(request, socket);

      // Resolve userId from session cookie (may be null for unauthenticated connections).
      // Auth is enforced at the subscribe message level, not at the WS upgrade level,
      // so that protocol-level messages (resize, ping) work without a session.
      const cookies = parseCookie(request.headers.cookie || '');
      const sessionId = cookies['ecode.sid'] || cookies['connect.sid'];
      let userId: number | null = null;
      if (sessionId) {
        try {
          userId = await this.getUserIdFromSession(sessionId);
        } catch (error) {
          console.error('Session validation error:', error);
        }
      }

      try {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          const clientId = Math.random().toString(36).substring(7);
          const client: PreviewClient = { 
            ws, 
            userId, 
            isAlive: true, 
            lastPing: Date.now(),
            eventListeners: new Map()
          };
          this.clients.set(clientId, client);

          this.setupClient(clientId, ws);
        });
      } catch (error) {
        console.error('WebSocket upgrade error:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    }, { pathMatch: 'prefix', priority: 55 });
    
    this.startCleanupInterval();
    this.startPingInterval();
  }
  
  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        if (client.ws.readyState === WebSocket.CLOSED || 
            client.ws.readyState === WebSocket.CLOSING ||
            now - client.lastPing > this.CLIENT_TIMEOUT_MS) {
          this.cleanupClient(clientId);
        }
      }
    }, 30000);
  }
  
  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      for (const [clientId, client] of this.clients.entries()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }
    }, this.PING_INTERVAL_MS);
  }
  
  private cleanupClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Detach from any PTY session to prevent memory leaks.
    if (client.projectId) {
      ptyManager.detachSubscriber(String(client.projectId), client.ws);
    }

    // Remove all event listeners to prevent memory leaks
    for (const [eventName, listener] of client.eventListeners.entries()) {
      previewEvents.off(eventName, listener);
    }
    client.eventListeners.clear();

    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, 'Cleanup');
      }
    } catch (e: any) { console.error('[catch]', e?.message || e); }

    this.clients.delete(clientId);
  }

  private async getUserIdFromSession(sessionId: string): Promise<number | null> {
    try {
      // Strip express-session signature: "s:SID.HMAC" → "SID"
      const cleanSid = sessionId.split('.')[0].replace(/^s:/, '');
      const { rows } = await dbPool.query<{ sess: any }>(
        'SELECT sess FROM user_sessions WHERE sid = $1 AND expire > NOW()',
        [cleanSid]
      );
      if (!rows.length) return null;
      const sess = typeof rows[0].sess === 'string' ? JSON.parse(rows[0].sess) : rows[0].sess;
      const uid = sess?.passport?.user ?? sess?.user ?? null;
      return uid != null ? Number(uid) : null;
    } catch {
      return null;
    }
  }

  private setupClient(clientId: string, ws: WebSocket) {
    const client = this.clients.get(clientId);
    if (!client) return;

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'pong') {
          client.isAlive = true;
          client.lastPing = Date.now();
          return;
        }
        this.handleMessage(clientId, data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      this.cleanupClient(clientId);
    });

    ws.on('error', (error) => {
      console.error(`Preview WebSocket error for client ${clientId}:`, error);
      this.cleanupClient(clientId);
    });

    // Send initial connection success
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Preview WebSocket connected'
    }));

    // Create event listeners with cleanup tracking
    const createListener = (eventName: string, handler: (data: any) => void) => {
      const listener = (data: any) => handler(data);
      client.eventListeners.set(eventName, listener);
      previewEvents.on(eventName, listener);
    };

    createListener('preview:start', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:start',
      projectId: data.projectId,
      port: data.port,
      status: 'starting'
    }));

    createListener('preview:ready', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:ready',
      projectId: data.projectId,
      port: data.primaryPort,
      url: `/preview/${data.projectId}/`,
      status: 'running'
    }));

    createListener('preview:stop', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:stop',
      projectId: data.projectId,
      status: 'stopped'
    }));

    createListener('preview:error', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:error',
      projectId: data.projectId,
      error: data.error,
      status: 'error'
    }));

    createListener('preview:log', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:log',
      projectId: data.projectId,
      log: data.log,
      timestamp: data.timestamp || new Date().toISOString()
    }));

    createListener('preview:rebuild', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:rebuild',
      projectId: data.projectId,
      message: 'Preview rebuilding due to file changes...'
    }));

    // Hot-reload: Listen for file changes and notify clients
    createListener('preview:file-change', (data) => this.broadcastToProject(data.projectId, {
      type: 'preview:file-change',
      projectId: data.projectId,
      filePath: data.filePath,
      changeType: data.changeType,
      timestamp: data.timestamp || new Date().toISOString()
    }));
  }

  private async handleMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (data.type) {
      case 'subscribe':
        // Subscribe to a specific project's preview updates
        const projectId = data.projectId;
        
        // Security: Verify user has access to this project
        const hasAccess = await this.verifyProjectAccess(client.userId, projectId);
        if (!hasAccess) {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'Access denied to this project'
          }));
          return;
        }

        client.projectId = projectId;

        // NOTE: File watching is handled via REST API mutations in files.router.ts
        // which emits preview:file-change events when files are created/updated/deleted
        // No filesystem watcher needed since files are stored in the database

        // Attach to any live PTY session so this subscriber gets pty:data frames.
        ptyManager.attachSubscriber(String(projectId), client.ws);

        client.ws.send(JSON.stringify({
          type: 'subscribed',
          projectId: projectId,
          hasPtySession: ptyManager.hasPtySession(String(projectId)),
        }));
        
        // Send current preview status
        const preview = previewService.getPreview(projectId);
        if (preview) {
          client.ws.send(JSON.stringify({
            type: 'preview:status',
            projectId: projectId,
            status: preview.status,
            port: preview.primaryPort,
            url: preview.status === 'running' ? `/preview/${projectId}/` : null,
            logs: preview.logs || []
          }));
        }
        break;

      case 'unsubscribe':
        if (client.projectId) {
          ptyManager.detachSubscriber(String(client.projectId), client.ws);
        }
        client.projectId = undefined;
        client.ws.send(JSON.stringify({
          type: 'unsubscribed'
        }));
        break;

      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'pty:start': {
        if (!client.projectId) {
          client.ws.send(JSON.stringify({ type: 'error', message: 'Not subscribed to a project' }));
          break;
        }
        const pid = String(client.projectId);
        const { workflowId, cols: ptyC = 80, rows: ptyR = 24 } = data;

        // Server-authoritative: the client provides only a workflowId — no executables
        // or command strings are accepted from the client.  The server resolves the
        // command from the project's workflow steps stored in the database.
        if (!workflowId || typeof workflowId !== 'string') {
          client.ws.send(JSON.stringify({ type: 'error', message: 'pty:start requires workflowId' }));
          break;
        }

        try {
          const workflow = await storage.getWorkflow(workflowId);
          if (!workflow || String(workflow.projectId) !== pid) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Workflow not found or access denied' }));
            break;
          }

          const steps = await storage.getWorkflowSteps(workflowId);
          const step = steps.sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))[0];
          if (!step?.command) {
            client.ws.send(JSON.stringify({ type: 'error', message: 'Workflow has no executable step' }));
            break;
          }

          const session = ptyManager.spawnPtySession(
            pid,
            'bash',
            ['-c', step.command],
            { cols: Number(ptyC) || 80, rows: Number(ptyR) || 24 },
            // onData: PTY bytes are already broadcast as `pty:data` frames by
            // broadcastToPtySubscribers inside pty-session-manager — do NOT
            // re-emit them as `preview:log` here or the client will receive
            // both and show duplicate output.
            (_rawData: string) => { /* pty:data handled by pty-session-manager */ },
            (exitCode: number) => {
              previewEvents.emit('preview:stop', { projectId: pid, exitCode });
            }
          );
          session.subscribers.add(client.ws);
          client.ws.send(JSON.stringify({ type: 'pty:started', projectId: pid, workflowId, cols: ptyC, rows: ptyR }));
        } catch (err: any) {
          client.ws.send(JSON.stringify({ type: 'error', message: `PTY spawn failed: ${err?.message}` }));
        }
        break;
      }

      case 'stdin': {
        // Forward raw stdin data to the running process — PTY first, then child_process fallback.
        if (!client.projectId) {
          client.ws.send(JSON.stringify({ type: 'error', message: 'Not subscribed to a project' }));
          break;
        }
        const { data: stdinData } = data;
        if (typeof stdinData !== 'string') break;
        const pid2 = String(client.projectId);
        // Try PTY session first (preferred — real tty semantics).
        const ptyOk = ptyManager.writeToPtySession(pid2, stdinData);
        if (ptyOk) break;
        // Fallback: legacy child_process stdin pipe.
        const ok = previewService.writeStdin(pid2, stdinData);
        if (!ok) {
          client.ws.send(JSON.stringify({
            type: 'error',
            message: 'No running process to receive stdin'
          }));
        }
        break;
      }

      case 'resize': {
        // PTY resize — apply to active PTY session, then ack.
        const { cols, rows } = data;
        if (client.projectId) {
          ptyManager.resizePtySession(String(client.projectId), Number(cols) || 80, Number(rows) || 24);
        }
        client.ws.send(JSON.stringify({ type: 'resize:ack', cols, rows }));
        break;
      }

      case 'signal': {
        // Send a Unix signal to the running process — PTY first, then child_process fallback.
        if (!client.projectId) {
          client.ws.send(JSON.stringify({ type: 'error', message: 'Not subscribed to a project' }));
          break;
        }
        const sig = data.signal as 'SIGTERM' | 'SIGINT' | 'SIGKILL';
        if (!['SIGTERM', 'SIGINT', 'SIGKILL'].includes(sig)) {
          client.ws.send(JSON.stringify({ type: 'error', message: `Unknown signal: ${sig}` }));
          break;
        }
        const pid3 = String(client.projectId);
        // For WS `signal` messages the user wants to send a specific signal to
        // the running process — NOT to tear it down via killPtySession().
        // signalPtySession() delivers the requested signal without removing the
        // session from the map or scheduling SIGKILL fallback.
        const ptyKilled = ptyManager.signalPtySession(pid3, sig as NodeJS.Signals);
        // Also signal legacy child_process preview if one exists.
        const sent = previewService.signalPreview(pid3, sig) || ptyKilled;
        client.ws.send(JSON.stringify({ type: 'signal:ack', signal: sig, sent }));
        break;
      }

      default:
        console.warn(`Unknown WebSocket message type: ${data.type}`);
    }
  }

  private broadcastToProject(projectId: number | string, message: any) {
    const targetId = String(projectId);
    this.clients.forEach((client) => {
      if (String(client.projectId) === targetId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  broadcast(message: any) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  sendToProject(projectId: number | string, message: any) {
    this.broadcastToProject(projectId, message);
  }

  private async verifyProjectAccess(userId: number | string, projectId: number | string): Promise<boolean> {
    try {
      const project = await storage.getProject(String(projectId));
      if (!project) {
        return false;
      }

      // Check if user is owner (schema uses userId, some legacy uses ownerId)
      if ((project as any).userId === userId || (project as any).ownerId === userId || String((project as any).userId) === String(userId) || String((project as any).ownerId) === String(userId)) {
        return true;
      }

      // Check if user is collaborator
      const collaborators = await storage.getProjectCollaborators(projectId);
      return collaborators.some((c: any) => c.userId === userId);
    } catch (error) {
      console.error('Error verifying project access:', error);
      return false;
    }
  }
}

export const previewWebSocketService = new PreviewWebSocketService();