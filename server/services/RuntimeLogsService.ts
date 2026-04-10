import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { Socket } from 'net';
import type { Duplex } from 'stream';
import type { IStorage } from '../storage';
import { WebSocketRateLimiter } from '../middleware/websocket-rate-limiter';
import { getClientIp } from '../utils/ip-extraction';
import { isOriginAllowed } from '../utils/origin-validation';
import { createLogger } from '../utils/logger';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import { sessionManager } from '../auth/session-manager';

const logger = createLogger('runtime-logs');
const rateLimiter = new WebSocketRateLimiter(20, 60000);

interface RuntimeLogsClient {
  ws: WebSocket;
  projectId: string;
  userId: string;
  executionId?: string;
}

interface RuntimeLogEntry {
  type: 'stdout' | 'stderr' | 'system' | 'exit';
  message: string;
  timestamp: number;
  executionId: string;
}

export class RuntimeLogsService {
  private clients: Map<string, RuntimeLogsClient[]> = new Map();
  private executionClients: Map<string, RuntimeLogsClient[]> = new Map();
  private storage: IStorage;
  private wss: WebSocketServer | null = null;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  setup(server: Server): void {
    // Use noServer mode - central dispatcher handles all upgrade routing
    this.wss = new WebSocketServer({ noServer: true });

    logger.info('[RuntimeLogs] Registering with central upgrade dispatcher at /api/runtime/logs/ws');

    // Register with central dispatcher (priority 40 - medium priority for logs)
    centralUpgradeDispatcher.register(
      '/api/runtime/logs/ws',
      this.handleRuntimeLogsUpgrade.bind(this),
      { pathMatch: 'exact', priority: 40 }
    );

    // Handle successful WebSocket connections
    this.wss.on('connection', async (ws, req) => {
      try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const projectId = url.searchParams.get('projectId');
        const executionId = url.searchParams.get('executionId');
        
        // Get userId from authenticated session (set during upgrade), NOT from query params
        const userId = String((req as any).authenticatedUserId || '');

        if (!projectId || !userId) {
          ws.close(1008, 'Missing projectId or authenticated userId');
          return;
        }

        logger.info(`[RuntimeLogs] Client connected via dispatcher: project=${projectId}, user=${userId}, execution=${executionId || 'all'}`);

        await this.handleConnection(ws, req, projectId, userId, executionId || undefined);
      } catch (error) {
        logger.error('[RuntimeLogs] Connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });
  }

  /**
   * Handle WebSocket upgrade requests routed by the central dispatcher
   * Performs validation before completing the handshake
   * NOTE: Must be synchronous - centralUpgradeDispatcher does not await promises
   */
  private handleRuntimeLogsUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const projectId = url.searchParams.get('projectId');

      // Validate required parameters (projectId only - userId comes from session)
      if (!projectId) {
        logger.warn('[RuntimeLogs] Upgrade rejected - missing projectId');
        this.destroySocketWithError(socket, 400, 'Missing projectId');
        return;
      }

      // Origin validation
      const origin = request.headers.origin || '';
      const host = request.headers.host || '';
      if (!isOriginAllowed(origin, host)) {
        logger.warn(`[RuntimeLogs] Upgrade rejected - disallowed origin: ${origin}`);
        this.destroySocketWithError(socket, 403, 'Origin not allowed');
        return;
      }

      // Rate limiting
      const clientIp = getClientIp(request);
      if (!rateLimiter.checkLimit(clientIp)) {
        logger.warn(`[RuntimeLogs] Upgrade rejected - rate limit exceeded for IP: ${clientIp}`);
        this.destroySocketWithError(socket, 429, 'Rate limit exceeded');
        return;
      }

      // Session-based authentication - get userId from session, not query params
      const cookieHeader = request.headers.cookie || '';
      const sessionCookie = this.parseSessionCookie(cookieHeader);
      
      if (!sessionCookie) {
        logger.warn('[RuntimeLogs] Upgrade rejected - no session cookie found');
        this.destroySocketWithError(socket, 401, 'Session required');
        return;
      }

      // Mark socket as handled BEFORE async operations to prevent race conditions
      markSocketAsHandled(request, socket);

      // Chain all async operations with .then() - do NOT use async/await
      sessionManager.getSession(sessionCookie)
        .then((session) => {
          if (!session || !session.userId) {
            logger.warn('[RuntimeLogs] Upgrade rejected - invalid or expired session');
            this.destroySocketWithError(socket, 401, 'Invalid session');
            return;
          }

          // Get authenticated userId from session (NOT from query params)
          const authenticatedUserId = session.userId;

          // Store authenticated userId on request for use in connection handler
          (request as any).authenticatedUserId = authenticatedUserId;

          // Authenticate using session userId (not client-supplied)
          return this.authenticateConnection(request, authenticatedUserId, projectId)
            .then((authorized) => {
              if (!authorized) {
                logger.warn(`[RuntimeLogs] Upgrade rejected - unauthorized user ${authenticatedUserId} for project ${projectId}`);
                this.destroySocketWithError(socket, 401, 'Unauthorized');
                return;
              }

              // Complete the WebSocket handshake
              this.wss!.handleUpgrade(request, socket, head, (ws) => {
                logger.debug(`[RuntimeLogs] Upgrade complete for project=${projectId}, user=${authenticatedUserId}`);
                this.wss!.emit('connection', ws, request);
              });
            });
        })
        .catch((error) => {
          logger.error('[RuntimeLogs] Upgrade authentication error:', error);
          this.destroySocketWithError(socket, 500, 'Internal server error');
        });
    } catch (error) {
      logger.error('[RuntimeLogs] Upgrade handler error:', error);
      this.destroySocketWithError(socket, 500, 'Internal server error');
    }
  }

  /**
   * Send HTTP error response and destroy socket
   */
  private destroySocketWithError(socket: Duplex, code: number, message: string): void {
    const httpResponse = `HTTP/1.1 ${code} ${message}\r\n` +
      `Content-Type: text/plain\r\n` +
      `Content-Length: ${message.length}\r\n` +
      `\r\n` +
      message;

    socket.write(httpResponse);
    socket.destroy();
  }

  /**
   * Parse session cookie from cookie header
   */
  private parseSessionCookie(cookieHeader: string): string | null {
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('ecode.sid=') || cookie.startsWith('connect.sid=')) {
        const prefix = cookie.startsWith('ecode.sid=') ? 'ecode.sid=' : 'connect.sid=';
        const value = cookie.substring(prefix.length);
        return decodeURIComponent(value);
      }
    }
    return null;
  }

  private async authenticateConnection(
    req: IncomingMessage,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      const project = await this.storage.getProject(projectId);
      if (!project) {
        logger.warn(`[RuntimeLogs] Project not found: ${projectId}`);
        return false;
      }

      if (String(project.ownerId) === userId) {
        return true;
      }

      try {
        const teamMember = await this.storage.getTeamMemberByUserAndProject?.(userId, projectId);
        if (teamMember) {
          return true;
        }
      } catch (error) {
        // Team feature might not be available
      }

      logger.warn(`[RuntimeLogs] User ${userId} unauthorized for project ${projectId}`);
      return false;
    } catch (error) {
      logger.error('[RuntimeLogs] Authorization error:', error);
      return false;
    }
  }

  async handleConnection(
    ws: WebSocket,
    request: IncomingMessage,
    projectId: string,
    userId: string,
    executionId?: string
  ): Promise<void> {
    const client: RuntimeLogsClient = {
      ws,
      projectId,
      userId,
      executionId,
    };

    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, []);
    }
    this.clients.get(projectId)!.push(client);

    if (executionId) {
      if (!this.executionClients.has(executionId)) {
        this.executionClients.set(executionId, []);
      }
      this.executionClients.get(executionId)!.push(client);
    }

    try {
      const logs = await this.storage.getTerminalLogs(projectId, 100);
      ws.send(JSON.stringify({
        type: 'initial',
        logs: logs.map(log => ({
          type: log.type === 'error' ? 'stderr' : 'stdout',
          message: log.message,
          timestamp: new Date(log.timestamp).getTime(),
          executionId: executionId || 'unknown'
        })),
      }));
    } catch (error) {
      logger.error('[RuntimeLogs] Error fetching initial logs:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial logs',
      }));
    }

    ws.on('close', () => {
      this.removeClient(projectId, ws, executionId);
    });

    ws.on('error', (error) => {
      logger.error('[RuntimeLogs] WebSocket error:', error);
      this.removeClient(projectId, ws, executionId);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (error) {
        // Ignore parse errors
      }
    });
  }

  private removeClient(projectId: string, ws: WebSocket, executionId?: string): void {
    const projectClients = this.clients.get(projectId);
    if (projectClients) {
      const index = projectClients.findIndex(c => c.ws === ws);
      if (index !== -1) {
        projectClients.splice(index, 1);
      }
      if (projectClients.length === 0) {
        this.clients.delete(projectId);
      }
    }

    if (executionId) {
      const execClients = this.executionClients.get(executionId);
      if (execClients) {
        const index = execClients.findIndex(c => c.ws === ws);
        if (index !== -1) {
          execClients.splice(index, 1);
        }
        if (execClients.length === 0) {
          this.executionClients.delete(executionId);
        }
      }
    }

    logger.debug(`[RuntimeLogs] Client disconnected: project=${projectId}, execution=${executionId || 'all'}`);
  }

  streamOutput(projectId: string, executionId: string, type: 'stdout' | 'stderr' | 'system', message: string): void {
    const entry: RuntimeLogEntry = {
      type,
      message,
      timestamp: Date.now(),
      executionId,
    };

    this.broadcastToExecution(executionId, {
      type: 'log',
      log: entry,
    });

    this.broadcastToProject(projectId, {
      type: 'log',
      log: entry,
    });
  }

  streamExit(projectId: string, executionId: string, exitCode: number, executionTime: number): void {
    const entry: RuntimeLogEntry = {
      type: 'exit',
      message: `Process exited with code ${exitCode}`,
      timestamp: Date.now(),
      executionId,
    };

    const exitData = {
      type: 'exit',
      log: entry,
      exitCode,
      executionTime,
    };

    this.broadcastToExecution(executionId, exitData);
    this.broadcastToProject(projectId, exitData);

    logger.info(`[RuntimeLogs] Execution ${executionId} exited with code ${exitCode} in ${executionTime}ms`);
  }

  private broadcastToExecution(executionId: string, data: object): void {
    const clients = this.executionClients.get(executionId);
    if (!clients) return;

    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  private broadcastToProject(projectId: string, data: object): void {
    const clients = this.clients.get(projectId);
    if (!clients) return;

    const message = JSON.stringify(data);
    for (const client of clients) {
      if (!client.executionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  getConnectedClientsCount(projectId: string): number {
    return this.clients.get(projectId)?.length || 0;
  }

  getExecutionClientsCount(executionId: string): number {
    return this.executionClients.get(executionId)?.length || 0;
  }
}

let runtimeLogsService: RuntimeLogsService | null = null;

export function initRuntimeLogsService(storage: IStorage): RuntimeLogsService {
  if (!runtimeLogsService) {
    runtimeLogsService = new RuntimeLogsService(storage);
  }
  return runtimeLogsService;
}

export function getRuntimeLogsService(): RuntimeLogsService | null {
  return runtimeLogsService;
}
