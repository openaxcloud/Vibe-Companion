// @ts-nocheck
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { previewService } from './preview-service';
import { EventEmitter } from 'events';
import { parse as parseCookie } from 'cookie';
import { storage } from '../storage';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';

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

      const cookies = parseCookie(request.headers.cookie || '');
      const sessionId = cookies['ecode.sid'];
      
      if (!sessionId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let userId: number | null;
      try {
        userId = await this.getUserIdFromSession(sessionId);
      } catch (error) {
        console.error('Session validation error:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }
      
      if (!userId) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
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
      // Parse the session ID (remove signature if present)
      const cleanSessionId = sessionId.split('.')[0].replace('s:', '');
      
      // Query session store
      const sessionStore = (global as any).sessionStore;
      if (!sessionStore) {
        console.error('Session store not available');
        return null;
      }

      return new Promise((resolve) => {
        sessionStore.get(cleanSessionId, (err: any, session: any) => {
          if (err || !session || !session.passport?.user) {
            resolve(null);
          } else {
            resolve(session.passport.user);
          }
        });
      });
    } catch (error) {
      console.error('Error getting userId from session:', error);
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
        
        client.ws.send(JSON.stringify({
          type: 'subscribed',
          projectId: projectId
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
        client.projectId = undefined;
        client.ws.send(JSON.stringify({
          type: 'unsubscribed'
        }));
        break;

      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;

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

  private async verifyProjectAccess(userId: number, projectId: number): Promise<boolean> {
    try {
      const project = await storage.getProject(projectId);
      if (!project) {
        return false;
      }

      // Check if user is owner
      if (project.ownerId === userId) {
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