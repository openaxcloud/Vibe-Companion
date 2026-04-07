// @ts-nocheck
import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { IStorage } from '../storage';
import type { BuildLog, InsertBuildLog } from '@shared/schema';
import { wsRateLimiter, ipRateLimiter } from '../middleware/websocket-rate-limiter';
import { getClientIp } from '../utils/ip-extraction';
import { isOriginAllowed } from '../utils/origin-validation';

interface BuildLogsClient {
  ws: WebSocket;
  projectId: string;
  userId: string;
  buildId?: string; // Optional: subscribe to specific build
}

export class BuildLogsService {
  private clients: Map<string, BuildLogsClient[]> = new Map();
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Authenticate and authorize WebSocket connection
   * SECURITY: Verifies session, project ownership, or team membership
   */
  private async authenticateConnection(
    req: IncomingMessage,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      // Verify project exists
      const project = await this.storage.getProject(projectId);
      if (!project) {
        console.warn(`[BuildLogs] Project not found: ${projectId}`);
        return false;
      }

      // Check if user owns the project
      if (project.ownerId === userId) {
        return true;
      }

      // Check team membership for non-owners
      try {
        const teamMember = await this.storage.getTeamMemberByUserAndProject?.(userId, projectId);
        if (teamMember) {
          return true;
        }
      } catch (error) {
        // Team feature might not be available yet, log but don't fail
      }

      // User is neither owner nor team member
      console.warn(`[BuildLogs] User ${userId} does not have access to project ${projectId}`);
      return false;
    } catch (error) {
      console.error('[BuildLogs] Authorization error:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection for build logs streaming
   */
  async handleConnection(ws: WebSocket, request: IncomingMessage, projectId: string, userId: string, buildId?: string): Promise<void> {
    const client: BuildLogsClient = {
      ws,
      projectId,
      userId,
      buildId,
    };

    // Add client to the map
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, []);
    }
    this.clients.get(projectId)!.push(client);

    // Send initial logs
    try {
      const logs = await this.storage.getBuildLogs(projectId, buildId, 100);
      ws.send(JSON.stringify({
        type: 'initial',
        logs,
      }));
    } catch (error) {
      console.error('[BuildLogs] Error fetching initial logs:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial logs',
      }));
    }

    // Handle disconnection
    ws.on('close', () => {
      this.removeClient(projectId, ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error('[BuildLogs] WebSocket error:', error);
      this.removeClient(projectId, ws);
    });
  }

  /**
   * Add a new build log and broadcast to connected clients
   */
  async addLog(log: InsertBuildLog): Promise<BuildLog> {
    const created = await this.storage.createBuildLog(log);
    
    // Broadcast to connected clients for this project
    this.broadcastToProject(log.projectId, {
      type: 'log',
      log: created,
    });

    return created;
  }

  /**
   * Add multiple build logs in batch
   */
  async addLogs(logs: InsertBuildLog[]): Promise<void> {
    for (const log of logs) {
      await this.addLog(log);
    }
  }

  /**
   * Get build logs for a project
   */
  async getLogs(projectId: string, buildId?: string, limit?: number): Promise<BuildLog[]> {
    return await this.storage.getBuildLogs(projectId, buildId, limit);
  }

  /**
   * Clear build logs for a project
   */
  async clearLogs(projectId: string, buildId?: string): Promise<void> {
    await this.storage.clearBuildLogs(projectId, buildId);
    
    // Notify connected clients
    this.broadcastToProject(projectId, {
      type: 'cleared',
      buildId,
    });
  }

  /**
   * Broadcast message to all clients connected to a project
   */
  private broadcastToProject(projectId: string, message: any): void {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return;

    const messageStr = JSON.stringify(message);
    
    for (const client of projectClients) {
      // If client is subscribed to a specific buildId, only send matching logs
      if (client.buildId && message.log && message.log.buildId !== client.buildId) {
        continue;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    }
  }

  /**
   * Remove a client from the connections map
   */
  private removeClient(projectId: string, ws: WebSocket): void {
    const projectClients = this.clients.get(projectId);
    if (!projectClients) return;

    const index = projectClients.findIndex(c => c.ws === ws);
    if (index !== -1) {
      projectClients.splice(index, 1);
    }

    // Clean up empty project arrays
    if (projectClients.length === 0) {
      this.clients.delete(projectId);
    }
  }

  /**
   * Get count of connected clients for a project
   */
  getClientCount(projectId: string): number {
    return this.clients.get(projectId)?.length || 0;
  }

  /**
   * Get total connected clients across all projects
   */
  getTotalClientCount(): number {
    let total = 0;
    for (const clients of this.clients.values()) {
      total += clients.length;
    }
    return total;
  }

  /**
   * Initialize WebSocket server with security hardening
   */
  initialize(wss: any): void {
    wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      try {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const projectId = url.searchParams.get('projectId');
        const buildId = url.searchParams.get('buildId') || undefined;

        if (!projectId) {
          ws.close(1008, 'Missing projectId parameter');
          return;
        }

        // SECURITY: Validate Origin to prevent cross-site WebSocket hijacking
        if (!isOriginAllowed(request.headers.origin, request.headers.host as string | undefined)) {
          console.warn(`[BuildLogs] Rejected connection from unauthorized origin: ${request.headers.origin || request.headers.host}`);
          ws.close(1008, 'Unauthorized origin');
          return;
        }

        // SECURITY: Apply IP-based rate limiting FIRST (prevents DoS)
        // Use secure IP extraction to prevent header spoofing
        const clientIp = getClientIp(request);
        
        if (!ipRateLimiter.checkLimit(clientIp)) {
          const retryAfter = Math.ceil(ipRateLimiter.getTimeUntilReset(clientIp) / 1000);
          console.warn(`[BuildLogs] Rate limit exceeded for IP ${clientIp}. Retry after ${retryAfter}s`);
          ws.close(1008, `Rate limit exceeded from your IP. Retry after ${retryAfter} seconds.`);
          return;
        }

        // SECURITY: Get userId from session
        const sessionStore = (global as any).sessionStore;
        const cookieHeader = request.headers.cookie;
        
        if (!cookieHeader || !sessionStore) {
          ws.close(1008, 'Authentication required');
          return;
        }

        // Parse session ID from cookie
        const sessionId = this.parseSessionId(cookieHeader);
        if (!sessionId) {
          ws.close(1008, 'Invalid session');
          return;
        }

        // Get session data
        const session = await new Promise<any>((resolve, reject) => {
          sessionStore.get(sessionId, (err: any, session: any) => {
            if (err) reject(err);
            else resolve(session);
          });
        });

        if (!session?.passport?.user) {
          ws.close(1008, 'Not authenticated');
          return;
        }

        const userId = session.passport.user;

        // SECURITY: Verify project access authorization
        const authorized = await this.authenticateConnection(request, userId, projectId);
        if (!authorized) {
          console.warn(`[BuildLogs] Unauthorized WebSocket connection attempt: user=${userId}, project=${projectId}`);
          ws.close(1008, 'Unauthorized: Invalid session or insufficient permissions');
          return;
        }

        // SECURITY: Apply per-user rate limiting AFTER authentication
        if (!wsRateLimiter.checkLimit(userId)) {
          const retryAfter = Math.ceil(wsRateLimiter.getTimeUntilReset(userId) / 1000);
          console.warn(`[BuildLogs] Rate limit exceeded for authenticated user ${userId}. Retry after ${retryAfter}s`);
          ws.close(1008, `Rate limit exceeded. Too many connections. Retry after ${retryAfter} seconds.`);
          return;
        }

        await this.handleConnection(ws, request, projectId, userId, buildId);
      } catch (error) {
        console.error('[BuildLogs] Connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  /**
   * Parse session ID from cookie header
   */
  private parseSessionId(cookieHeader: string): string | null {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('ecode.sid=')) {
        const value = cookie.substring('ecode.sid='.length);
        return decodeURIComponent(value).replace('s:', '').split('.')[0];
      }
    }
    return null;
  }
}

// Setup function for server initialization
export function setupBuildLogsWebSocket(httpServer: any, storage: IStorage): BuildLogsService {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/api/build-logs/ws'
  });

  const buildLogsService = new BuildLogsService(storage);
  buildLogsService.initialize(wss);

  // Handle WebSocket upgrade for build logs connections
  httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    
    if (url.pathname === '/api/build-logs/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  return buildLogsService;
}
