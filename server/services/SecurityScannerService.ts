// @ts-nocheck
import type { Server as HTTPServer, IncomingMessage } from 'http';
import WebSocket from 'ws';
import type { IStorage } from '../storage';
import type { SecurityScan, Vulnerability } from '@shared/schema';
import { isOriginAllowed } from '../utils/origin-validation';
import { getClientIp } from '../utils/ip-extraction';
import { ipRateLimiter, wsRateLimiter } from '../middleware/websocket-rate-limiter';

interface SecurityScannerClient {
  ws: WebSocket;
  projectId: string;
  userId: string;
}

export class SecurityScannerService {
  private wss: WebSocket.Server;
  private clients: Map<string, SecurityScannerClient[]> = new Map();
  private storage: IStorage;

  constructor(server: HTTPServer, storage: IStorage) {
    this.storage = storage;

    this.wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', async (request: IncomingMessage, socket, head) => {
      if (!request.url?.startsWith('/api/security-scans/ws')) {
        return;
      }

      try {
        // SECURITY Layer 1: Origin validation (strict hostname comparison)
        // Prevents cross-site WebSocket hijacking attacks
        const origin = request.headers.origin;
        const host = request.headers.host;

        if (!isOriginAllowed(origin, host)) {
          console.warn(`[SecurityScanner] Rejected connection from unauthorized origin: ${origin}`);
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        // SECURITY Layer 2: IP-based rate limiting (pre-auth DoS protection)
        // Extract IP securely (defaults to socket.remoteAddress, immune to header spoofing)
        const clientIp = getClientIp(request);
        
        if (!ipRateLimiter.checkLimit(clientIp)) {
          const retryAfter = Math.ceil(ipRateLimiter.getTimeUntilReset(clientIp) / 1000);
          console.warn(`[SecurityScanner] Rate limit exceeded for IP ${clientIp}. Retry after ${retryAfter}s`);
          socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
          socket.destroy();
          return;
        }

        // SECURITY Layer 3: Session-based authentication
        // Extract userId from session cookie ONLY (never from URL params to prevent identity spoofing)
        const sessionStore = (global as any).sessionStore;
        if (!sessionStore) {
          console.error('[SecurityScanner] Session store not available');
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
          return;
        }

        const cookies = request.headers.cookie;
        const sessionCookie = cookies?.split(';')
          .map(c => c.trim())
          .find(c => c.startsWith('ecode.sid='))
          ?.split('=')[1];
        
        if (!sessionCookie) {
          console.warn('[SecurityScanner] No session cookie found');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        // Decode URL-encoded cookie and extract session ID
        // Guard against malformed cookies that could cause decodeURIComponent to throw
        let decodedCookie: string;
        try {
          decodedCookie = decodeURIComponent(sessionCookie);
        } catch (error) {
          console.warn('[SecurityScanner] Malformed session cookie');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }
        
        const sessionId = decodedCookie
          .split('.')[0]  // Remove signature
          .replace(/^s:/, '');  // Remove 's:' prefix

        const session = await new Promise<any>((resolve, reject) => {
          sessionStore.get(sessionId, (err: any, session: any) => {
            if (err) reject(err);
            else resolve(session);
          });
        });

        if (!session?.passport?.user?.id) {
          console.warn('[SecurityScanner] Invalid session or user not authenticated');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const userId = session.passport.user.id;

        // SECURITY Layer 4: User-based rate limiting (post-auth quota protection)
        if (!wsRateLimiter.checkLimit(userId)) {
          const retryAfter = Math.ceil(wsRateLimiter.getTimeUntilReset(userId) / 1000);
          console.warn(`[SecurityScanner] Rate limit exceeded for user ${userId}. Retry after ${retryAfter}s`);
          socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
          socket.destroy();
          return;
        }

        // Parse projectId from URL
        const url = new URL(request.url, `http://${request.headers.host}`);
        const projectId = url.searchParams.get('projectId');

        if (!projectId) {
          console.warn('[SecurityScanner] Missing projectId parameter');
          socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
          socket.destroy();
          return;
        }

        // SECURITY Layer 5: Project authorization
        // Verify user has access to this project (owner OR team member)
        const hasAccess = await this.authorizeProject(projectId, userId);
        if (!hasAccess) {
          console.warn(`[SecurityScanner] User ${userId} not authorized for project ${projectId}`);
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request, projectId, userId);
        });
      } catch (error) {
        console.error('[SecurityScanner] Error during WebSocket upgrade:', error);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage, projectId: string, userId: string) => {
      this.handleConnection(ws, request, projectId, userId);
    });
  }

  /**
   * SECURITY: Verify user has access to project (owner OR team member)
   */
  private async authorizeProject(projectId: string, userId: string): Promise<boolean> {
    try {
      const project = await this.storage.getProject(projectId);
      if (!project) {
        console.warn(`[SecurityScanner] Project ${projectId} not found`);
        return false;
      }

      // Check if user is project owner
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
        console.debug('[SecurityScanner] Team membership check skipped:', error);
      }

      // User is neither owner nor team member
      console.warn(`[SecurityScanner] User ${userId} does not have access to project ${projectId}`);
      return false;
    } catch (error) {
      console.error('[SecurityScanner] Authorization error:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection for security scan streaming
   */
  async handleConnection(ws: WebSocket, request: IncomingMessage, projectId: string, userId: string): Promise<void> {
    const client: SecurityScannerClient = {
      ws,
      projectId,
      userId,
    };

    // Add client to the map
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, []);
    }
    this.clients.get(projectId)!.push(client);

    // Send initial data (recent scans + vulnerabilities)
    try {
      const scans = await this.storage.getSecurityScans(projectId, 10);
      const openVulnerabilities = await this.storage.getProjectVulnerabilities(projectId, 'open');
      
      ws.send(JSON.stringify({
        type: 'initial',
        scans,
        vulnerabilities: openVulnerabilities,
      }));
    } catch (error) {
      console.error('[SecurityScanner] Error fetching initial data:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to fetch initial security scan data',
      }));
    }

    // Handle disconnection
    ws.on('close', () => {
      this.removeClient(projectId, client);
    });

    ws.on('error', (error) => {
      console.error('[SecurityScanner] WebSocket error:', error);
      this.removeClient(projectId, client);
    });

    // Handle incoming messages (for future interactivity)
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        // Handle commands like requesting rescan, marking vulnerabilities, etc.
      } catch (error) {
        console.error('[SecurityScanner] Error parsing message:', error);
      }
    });
  }

  /**
   * Remove client from the clients map
   */
  private removeClient(projectId: string, client: SecurityScannerClient): void {
    const projectClients = this.clients.get(projectId);
    if (projectClients) {
      const index = projectClients.indexOf(client);
      if (index > -1) {
        projectClients.splice(index, 1);
      }
      if (projectClients.length === 0) {
        this.clients.delete(projectId);
      }
    }
  }

  /**
   * Broadcast security scan update to all connected clients for a project
   */
  async broadcastScanUpdate(projectId: string, scan: SecurityScan): Promise<void> {
    const clients = this.clients.get(projectId);
    if (!clients || clients.length === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'scan_update',
      scan,
    });

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Broadcast vulnerability update to all connected clients for a project
   */
  async broadcastVulnerabilityUpdate(projectId: string, vulnerability: Vulnerability): Promise<void> {
    const clients = this.clients.get(projectId);
    if (!clients || clients.length === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'vulnerability_update',
      vulnerability,
    });

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Get count of connected clients for a project
   */
  getClientCount(projectId: string): number {
    return this.clients.get(projectId)?.length || 0;
  }
}

/**
 * Setup Security Scanner WebSocket server
 */
export function setupSecurityScannerWebSocket(server: HTTPServer, storage: IStorage): SecurityScannerService {
  return new SecurityScannerService(server, storage);
}
