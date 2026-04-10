// @ts-nocheck
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { IStorage } from '../storage';
import type { InsertLspDiagnostic, LspDiagnostic } from '@shared/schema';
import { wsRateLimiter, ipRateLimiter } from '../middleware/websocket-rate-limiter';
import { getClientIp } from '../utils/ip-extraction';
import { isOriginAllowed } from '../utils/origin-validation';

interface DiagnosticMessage {
  type: 'diagnostic';
  projectId: string;
  fileId?: number;
  filePath: string;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  code?: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  tags?: string[];
  relatedInformation?: Array<{
    message: string;
    filePath: string;
    line: number;
    column: number;
  }>;
}

interface LSPClient {
  ws: WebSocket;
  projectId: string;
  userId: string;
}

export class LSPService {
  private clients: Map<string, Set<LSPClient>> = new Map();
  private storage: IStorage;
  private wss?: WebSocketServer;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  initialize(wss: WebSocketServer) {
    this.wss = wss;
    
    wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const projectId = url.searchParams.get('projectId');

      if (!projectId) {
        ws.close(1008, 'Missing projectId parameter');
        return;
      }

      // SECURITY: Validate Origin to prevent cross-site WebSocket hijacking
      if (!isOriginAllowed(req.headers.origin, req.headers.host as string | undefined)) {
        console.warn(`[LSP] Rejected connection from unauthorized origin: ${req.headers.origin || req.headers.host}`);
        ws.close(1008, 'Unauthorized origin');
        return;
      }

      // SECURITY: Apply IP-based rate limiting FIRST (prevents DoS)
      // This prevents attackers from spamming connections before auth
      // Use secure IP extraction to prevent header spoofing
      const clientIp = getClientIp(req);
      
      if (!ipRateLimiter.checkLimit(clientIp)) {
        const retryAfter = Math.ceil(ipRateLimiter.getTimeUntilReset(clientIp) / 1000);
        console.warn(`[LSP] Rate limit exceeded for IP ${clientIp}. Retry after ${retryAfter}s`);
        ws.close(1008, `Rate limit exceeded from your IP. Retry after ${retryAfter} seconds.`);
        return;
      }

      // SECURITY: Extract authenticated user ID from session, NOT from URL params
      const sessionStore = (global as any).sessionStore;
      const cookieHeader = req.headers.cookie;
      
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

      // SECURITY: Use session-derived user ID, NEVER trust client-supplied IDs
      const authenticatedUserId = session.passport.user;

      // Authenticate the user via session BEFORE user-based rate limiting
      // This prevents attackers from exhausting another user's quota
      try {
        const authenticated = await this.authenticateConnection(req, authenticatedUserId, projectId);
        if (!authenticated) {
          console.warn(`[LSP] Unauthorized WebSocket connection attempt: user=${authenticatedUserId}, project=${projectId}`);
          ws.close(1008, 'Unauthorized: Invalid session or insufficient permissions');
          return;
        }
      } catch (error) {
        console.error('[LSP] Authentication error:', error);
        ws.close(1011, 'Authentication failed');
        return;
      }

      // SECURITY: Apply per-user rate limiting AFTER authentication
      // Use authenticated user ID to prevent DoS attacks on other users
      if (!wsRateLimiter.checkLimit(authenticatedUserId)) {
        const retryAfter = Math.ceil(wsRateLimiter.getTimeUntilReset(authenticatedUserId) / 1000);
        console.warn(`[LSP] Rate limit exceeded for authenticated user ${authenticatedUserId}. Retry after ${retryAfter}s`);
        ws.close(1008, `Rate limit exceeded. Too many connections. Retry after ${retryAfter} seconds.`);
        return;
      }

      const client: LSPClient = { ws, projectId, userId: authenticatedUserId };
      this.addClient(projectId, client);

      // Send initial diagnostics
      this.sendInitialDiagnostics(client);

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as DiagnosticMessage;
          await this.handleMessage(client, message);
        } catch (error) {
          console.error('[LSP] Message handling error:', error);
        }
      });

      ws.on('close', () => {
        this.removeClient(projectId, client);
      });

      ws.on('error', (error) => {
        console.error('[LSP] WebSocket error:', error);
      });
    });
  }

  private addClient(projectId: string, client: LSPClient) {
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    this.clients.get(projectId)!.add(client);
  }

  private removeClient(projectId: string, client: LSPClient) {
    const clients = this.clients.get(projectId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.clients.delete(projectId);
      }
    }
  }

  private async sendInitialDiagnostics(client: LSPClient) {
    try {
      // Get existing diagnostics for this project
      const diagnostics = await this.getDiagnostics(client.projectId);
      
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'initial',
          diagnostics,
        }));
      }
    } catch (error) {
      console.error('[LSP] Error sending initial diagnostics:', error);
    }
  }

  private async handleMessage(client: LSPClient, message: DiagnosticMessage) {
    if (message.type === 'diagnostic') {
      await this.addDiagnostic(client.projectId, message);
    }
  }

  async addDiagnostic(projectId: string, diagnostic: Omit<InsertLspDiagnostic, 'projectId'>): Promise<LspDiagnostic> {
    const newDiagnostic: InsertLspDiagnostic = {
      projectId,
      ...diagnostic,
    };

    // Store in database (implement in storage layer)
    const stored = await this.storage.createLspDiagnostic(newDiagnostic);

    // Broadcast to all connected clients for this project
    this.broadcastToProject(projectId, {
      type: 'add',
      diagnostic: stored,
    });

    return stored;
  }

  async updateDiagnostic(diagnosticId: string, updates: Partial<LspDiagnostic>): Promise<LspDiagnostic> {
    const updated = await this.storage.updateLspDiagnostic(diagnosticId, updates);
    
    if (updated) {
      this.broadcastToProject(updated.projectId, {
        type: 'update',
        diagnostic: updated,
      });
    }

    return updated;
  }

  async removeDiagnostic(diagnosticId: string): Promise<void> {
    const diagnostic = await this.storage.getLspDiagnostic(diagnosticId);
    if (diagnostic) {
      await this.storage.deleteLspDiagnostic(diagnosticId);
      
      this.broadcastToProject(diagnostic.projectId, {
        type: 'remove',
        diagnosticId,
      });
    }
  }

  async clearDiagnostics(projectId: string, filePath?: string): Promise<void> {
    await this.storage.clearLspDiagnostics(projectId, filePath);
    
    this.broadcastToProject(projectId, {
      type: 'clear',
      filePath,
    });
  }

  async getDiagnostics(projectId: string, filePath?: string): Promise<LspDiagnostic[]> {
    return this.storage.getLspDiagnostics(projectId, filePath);
  }

  async getDiagnosticsByFile(projectId: string): Promise<Map<string, LspDiagnostic[]>> {
    const diagnostics = await this.getDiagnostics(projectId);
    const byFile = new Map<string, LspDiagnostic[]>();

    for (const diagnostic of diagnostics) {
      const path = diagnostic.filePath;
      if (!byFile.has(path)) {
        byFile.set(path, []);
      }
      byFile.get(path)!.push(diagnostic);
    }

    return byFile;
  }

  async getStatistics(projectId: string): Promise<{
    total: number;
    errors: number;
    warnings: number;
    info: number;
    hints: number;
  }> {
    const diagnostics = await this.getDiagnostics(projectId);
    
    return {
      total: diagnostics.length,
      errors: diagnostics.filter(d => d.severity === 'error').length,
      warnings: diagnostics.filter(d => d.severity === 'warning').length,
      info: diagnostics.filter(d => d.severity === 'info').length,
      hints: diagnostics.filter(d => d.severity === 'hint').length,
    };
  }

  private broadcastToProject(projectId: string, message: any) {
    const clients = this.clients.get(projectId);
    if (clients) {
      const messageStr = JSON.stringify(message);
      clients.forEach(client => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
        }
      });
    }
  }

  getConnectedClients(projectId: string): number {
    return this.clients.get(projectId)?.size || 0;
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

  /**
   * Authenticate WebSocket connection by verifying session and project access
   */
  private async authenticateConnection(
    req: IncomingMessage,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      // Extract session cookie from request
      const cookies = req.headers.cookie;
      if (!cookies) {
        console.warn('[LSP] No cookies in WebSocket request');
        return false;
      }

      // Parse session ID from cookie (format: ecode.sid=s%3A...)
      const sessionCookie = cookies.split(';')
        .find(c => c.trim().startsWith('ecode.sid='));
      
      if (!sessionCookie) {
        console.warn('[LSP] No session cookie found');
        return false;
      }

      const sessionId = sessionCookie.split('=')[1];
      if (!sessionId) {
        console.warn('[LSP] Invalid session cookie format');
        return false;
      }

      // Decode the session ID (it's URL encoded and signed)
      const decodedSessionId = decodeURIComponent(sessionId);
      // Remove the 's:' prefix and signature (format: s:sessionId.signature)
      const actualSessionId = decodedSessionId.split('.')[0].replace('s:', '');

      // Verify session exists in session store
      const sessionStore = (global as any).sessionStore;
      if (!sessionStore) {
        console.error('[LSP] Session store not available');
        return false;
      }

      // Get session data
      const session = await new Promise<any>((resolve, reject) => {
        sessionStore.get(actualSessionId, (err: Error | null, session: any) => {
          if (err) reject(err);
          else resolve(session);
        });
      });

      if (!session || !session.passport || !session.passport.user) {
        console.warn('[LSP] Invalid or expired session');
        return false;
      }

      // Verify the userId matches the session
      if (session.passport.user !== userId) {
        console.warn('[LSP] User ID mismatch: session=${session.passport.user}, provided=${userId}');
        return false;
      }

      // Verify user has access to the project
      const project = await this.storage.getProject(projectId);
      if (!project) {
        console.warn(`[LSP] Project not found: ${projectId}`);
        return false;
      }

      // Check if user owns the project or is a team member/collaborator
      if (project.ownerId === userId) {
        // User owns the project - full access
        return true;
      }

      // Check team membership for non-owners
      try {
        const teamMember = await this.storage.getTeamMemberByUserAndProject?.(userId, projectId);
        if (teamMember) {
          // User is a team member - has access
          return true;
        }
      } catch (error) {
        // Team feature might not be available yet, log but don't fail
      }

      // User is neither owner nor team member
      console.warn(`[LSP] User ${userId} does not have access to project ${projectId}`);
      return false;
    } catch (error) {
      console.error('[LSP] Authentication error:', error);
      return false;
    }
  }
}

// Setup function for server initialization
export function setupLSPWebSocket(httpServer: any, storage: IStorage): LSPService {
  const wss = new WebSocketServer({
    noServer: true,
    path: '/api/lsp/ws'
  });

  const lspService = new LSPService(storage);
  lspService.initialize(wss);

  // Handle WebSocket upgrade for LSP connections
  httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    
    if (url.pathname === '/api/lsp/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  return lspService;
}
