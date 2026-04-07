/**
 * ServerLogsService - Real-time server log streaming via WebSocket
 * Streams Winston logs to connected clients like Replit's console
 */

import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import type { Duplex } from 'stream';
import { WebSocketRateLimiter } from '../middleware/websocket-rate-limiter';
import { getClientIp } from '../utils/ip-extraction';
import { isOriginAllowed } from '../utils/origin-validation';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import Transport from 'winston-transport';
import { winstonLogger } from '../utils/logger';
import { sessionManager } from '../auth/session-manager';
import type { IStorage } from '../storage';

const rateLimiter = new WebSocketRateLimiter(30, 60000);

export interface ServerLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  service: string;
  details?: unknown[];
}

interface ServerLogsClient {
  ws: WebSocket;
  userId: string;
  projectId?: string;
  connectedAt: number;
}

class WebSocketTransport extends Transport {
  private broadcast: (log: ServerLogEntry) => void;

  constructor(opts: Transport.TransportStreamOptions & { broadcast: (log: ServerLogEntry) => void }) {
    super(opts);
    this.broadcast = opts.broadcast;
  }

  log(info: any, callback: () => void) {
    setImmediate(() => {
      const logEntry: ServerLogEntry = {
        level: info.level?.replace(new RegExp(String.raw`\u001b\[\d+m`, 'g'), '') || 'info',
        message: info.message || '',
        timestamp: info.timestamp || new Date().toISOString(),
        service: info.service || 'server',
        details: info.details,
      };

      this.broadcast(logEntry);
    });

    callback();
  }
}

export class ServerLogsService {
  private clients: Map<string, ServerLogsClient> = new Map();
  private wss: WebSocketServer | null = null;
  private logBuffer: ServerLogEntry[] = [];
  private maxBufferSize = 500;
  private transport: WebSocketTransport | null = null;
  private storage: IStorage | null = null;

  constructor(storage?: IStorage) {
    this.transport = new WebSocketTransport({
      broadcast: this.broadcastLog.bind(this),
    });
    if (storage) {
      this.storage = storage;
    }
  }

  setup(server: Server, storage?: IStorage): void {
    if (storage) {
      this.storage = storage;
    }
    this.wss = new WebSocketServer({ noServer: true });

    console.log('[ServerLogs] Registering with central upgrade dispatcher at /api/server/logs/ws');

    centralUpgradeDispatcher.register(
      '/api/server/logs/ws',
      this.handleUpgrade.bind(this),
      { pathMatch: 'exact', priority: 45 }
    );

    winstonLogger.add(this.transport!);

    this.wss.on('connection', (ws, req) => {
      try {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const userId = String((req as any).authenticatedUserId || 'unknown');
        const projectId = url.searchParams.get('projectId') || undefined;

        const clientId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const client: ServerLogsClient = {
          ws,
          userId,
          projectId,
          connectedAt: Date.now(),
        };

        this.clients.set(clientId, client);

        console.log(`[ServerLogs] Client connected: ${clientId} (total: ${this.clients.size})`);

        ws.send(JSON.stringify({
          type: 'connected',
          message: 'Connected to server logs stream',
          timestamp: Date.now(),
        }));

        if (this.logBuffer.length > 0) {
          ws.send(JSON.stringify({
            type: 'initial',
            logs: this.logBuffer.slice(-100),
          }));
        }

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          } catch (e) {
          }
        });

        ws.on('close', () => {
          this.clients.delete(clientId);
          console.log(`[ServerLogs] Client disconnected: ${clientId} (remaining: ${this.clients.size})`);
        });

        ws.on('error', (error) => {
          console.error(`[ServerLogs] Client error: ${clientId}`, error.message);
          this.clients.delete(clientId);
        });

      } catch (error) {
        console.error('[ServerLogs] Connection error:', error);
        ws.close(1011, 'Internal server error');
      }
    });

    console.log('[ServerLogs] Server logs streaming service initialized');
  }

  private async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    try {
      const origin = request.headers.origin || '';
      const host = request.headers.host || '';
      
      if (!isOriginAllowed(origin, host)) {
        console.warn(`[ServerLogs] Upgrade rejected - disallowed origin: ${origin}`);
        this.destroySocketWithError(socket, 403, 'Origin not allowed');
        return;
      }

      const clientIp = getClientIp(request);
      if (!rateLimiter.checkLimit(clientIp)) {
        console.warn(`[ServerLogs] Upgrade rejected - rate limit exceeded for IP: ${clientIp}`);
        this.destroySocketWithError(socket, 429, 'Rate limit exceeded');
        return;
      }

      const cookieHeader = request.headers.cookie || '';
      const sessionCookie = this.parseSessionCookie(cookieHeader);
      
      if (!sessionCookie) {
        console.warn('[ServerLogs] Upgrade rejected - no session cookie found');
        this.destroySocketWithError(socket, 401, 'Session required');
        return;
      }

      const session = await sessionManager.getSession(sessionCookie);
      if (!session || !session.userId) {
        console.warn('[ServerLogs] Upgrade rejected - invalid or expired session');
        this.destroySocketWithError(socket, 401, 'Invalid session');
        return;
      }

      const authenticatedUserId = session.userId;

      if (this.storage) {
        try {
          const user = await this.storage.getUser(authenticatedUserId);
          if (!user) {
            console.warn(`[ServerLogs] Upgrade rejected - user ${authenticatedUserId} not found in database`);
            this.destroySocketWithError(socket, 401, 'User not found');
            return;
          }
        } catch (error) {
          console.error('[ServerLogs] Database lookup error:', error);
        }
      }

      (request as any).authenticatedUserId = authenticatedUserId;
      
      markSocketAsHandled(request, socket);

      this.wss!.handleUpgrade(request, socket, head, (ws) => {
        this.wss!.emit('connection', ws, request);
      });

    } catch (error) {
      console.error('[ServerLogs] Upgrade error:', error);
      this.destroySocketWithError(socket, 500, 'Internal server error');
    }
  }

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

  private destroySocketWithError(socket: Duplex, statusCode: number, message: string): void {
    const response = [
      `HTTP/1.1 ${statusCode} ${message}`,
      'Content-Type: text/plain',
      'Connection: close',
      '',
      message,
    ].join('\r\n');

    socket.write(response);
    socket.destroy();
  }

  private broadcastLog(log: ServerLogEntry): void {
    this.logBuffer.push(log);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    const message = JSON.stringify({
      type: 'log',
      log,
    });

    for (const [clientId, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error(`[ServerLogs] Failed to send to client ${clientId}:`, error);
          this.clients.delete(clientId);
        }
      }
    }
  }

  getConnectedClients(): number {
    return this.clients.size;
  }

  getBufferedLogs(): ServerLogEntry[] {
    return [...this.logBuffer];
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }
}

export const serverLogsService = new ServerLogsService();
