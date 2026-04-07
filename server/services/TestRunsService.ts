// @ts-nocheck
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { IStorage } from '../storage';
import type { TestRun, TestCase, InsertTestRun, InsertTestCase } from '@shared/schema';
import { teamMembers, collaborationSessions, sessionParticipants } from '@shared/schema';
import { getClientIp } from '../utils/ip-extraction';
import { ipRateLimiter, wsRateLimiter } from '../middleware/websocket-rate-limiter';
import { isOriginAllowed } from '../utils/origin-validation';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const logger = createLogger('test-runs-service');

interface TestRunsClient {
  ws: WebSocket;
  projectId: string;
  userId: string;
  runId?: string; // Optional: subscribe to specific test run
}

interface TestRunMessage {
  type: 'update' | 'complete' | 'test_case' | 'clear';
  testRun?: TestRun;
  testCase?: TestCase;
  runId?: string;
}

export class TestRunsService {
  private clients: Map<string, Set<TestRunsClient>> = new Map();
  private storage: IStorage;
  private wss?: WebSocketServer;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Initialize WebSocket server for real-time test result streaming
   */
  initialize(wss: WebSocketServer) {
    this.wss = wss;

    wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
      try {
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const projectId = url.searchParams.get('projectId');
        const runId = url.searchParams.get('runId') || undefined;

        if (!projectId) {
          ws.close(1008, 'Missing projectId parameter');
          return;
        }

        // SECURITY: Validate Origin to prevent cross-site WebSocket hijacking
        if (!isOriginAllowed(request.headers.origin, request.headers.host as string | undefined)) {
          logger.warn(`[TestRuns] Rejected connection from unauthorized origin: ${request.headers.origin || request.headers.host}`);
          ws.close(1008, 'Unauthorized origin');
          return;
        }

        // SECURITY: Apply IP-based rate limiting FIRST (prevents DoS)
        // This prevents attackers from spamming connections before auth
        // Use secure IP extraction to prevent header spoofing
        const clientIp = getClientIp(request);
        
        if (!ipRateLimiter.checkLimit(clientIp)) {
          const retryAfter = Math.ceil(ipRateLimiter.getTimeUntilReset(clientIp) / 1000);
          logger.warn(`[TestRuns] Rate limit exceeded for IP ${clientIp}. Retry after ${retryAfter}s`);
          ws.close(1008, `Rate limit exceeded from your IP. Retry after ${retryAfter} seconds.`);
          return;
        }

        // SECURITY: Extract authenticated user ID from session, NOT from URL params
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
          logger.warn(`[TestRuns] Unauthorized WebSocket connection attempt: user=${userId}, project=${projectId}`);
          ws.close(1008, 'Unauthorized: Invalid session or insufficient permissions');
          return;
        }

        // SECURITY: Apply per-user rate limiting AFTER authentication
        // Use authenticated user ID to prevent DoS attacks on other users
        if (!wsRateLimiter.checkLimit(userId)) {
          const retryAfter = Math.ceil(wsRateLimiter.getTimeUntilReset(userId) / 1000);
          logger.warn(`[TestRuns] Rate limit exceeded for authenticated user ${userId}. Retry after ${retryAfter}s`);
          ws.close(1008, `Rate limit exceeded. Too many connections. Retry after ${retryAfter} seconds.`);
          return;
        }

        await this.handleConnection(ws, request, projectId, userId, runId);
      } catch (error) {
        logger.error('[TestRuns] Connection error:', error);
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

  /**
   * Authenticate WebSocket connection by verifying session and project access
   */
  private async authenticateConnection(
    req: IncomingMessage,
    userId: string,
    projectId: string
  ): Promise<boolean> {
    try {
      // Verify project exists and user has access
      const project = await this.storage.getProject(projectId);
      if (!project) {
        logger.warn(`[TestRuns] Project not found: ${projectId}`);
        return false;
      }

      // Check if user is the owner (handle both string and number types)
      const userIdNum = typeof userId === 'string' ? parseInt(userId, 10) : userId;
      if (project.ownerId === userIdNum) {
        return true;
      }

      // Check team membership access
      const projectIdNum = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
      
      if (!isNaN(projectIdNum) && !isNaN(userIdNum)) {
        // Check if user is a team member with access to this project
        const teamMemberAccess = await db
          .select()
          .from(teamMembers)
          .where(eq(teamMembers.userId, userIdNum))
          .limit(1);

        if (teamMemberAccess.length > 0) {
          // User is an active team member - allow access
          logger.info(`[TestRuns] Team member ${userId} granted access to project ${projectId}`);
          return true;
        }

        // Check if user is an active participant in a collaboration session
        const collaboratorAccess = await db
          .select()
          .from(sessionParticipants)
          .innerJoin(
            collaborationSessions,
            eq(sessionParticipants.sessionId, collaborationSessions.id)
          )
          .where(
            and(
              eq(collaborationSessions.projectId, projectIdNum),
              eq(sessionParticipants.userId, userIdNum),
              eq(sessionParticipants.active, true),
              eq(collaborationSessions.active, true)
            )
          )
          .limit(1);

        if (collaboratorAccess.length > 0) {
          logger.info(`[TestRuns] Collaborator ${userId} granted access to project ${projectId}`);
          return true;
        }
      }

      logger.warn(`[TestRuns] User ${userId} denied access to project ${projectId}`);
      return false;
    } catch (error) {
      logger.error('[TestRuns] Authentication error:', error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection for test runs streaming
   */
  async handleConnection(ws: WebSocket, request: IncomingMessage, projectId: string, userId: string, runId?: string): Promise<void> {
    const client: TestRunsClient = {
      ws,
      projectId,
      userId,
      runId,
    };

    this.addClient(projectId, client);

    // Send initial test runs
    try {
      const testRuns = await this.storage.getTestRuns(projectId, 10);
      ws.send(JSON.stringify({
        type: 'initial',
        testRuns,
      }));
    } catch (error) {
      logger.error('[TestRuns] Error sending initial test runs:', error);
    }

    ws.on('close', () => {
      this.removeClient(projectId, client);
    });

    ws.on('error', (error) => {
      logger.error('[TestRuns] WebSocket error:', error);
      this.removeClient(projectId, client);
    });
  }

  /**
   * Add a client to the project's client set
   */
  private addClient(projectId: string, client: TestRunsClient) {
    if (!this.clients.has(projectId)) {
      this.clients.set(projectId, new Set());
    }
    this.clients.get(projectId)!.add(client);
  }

  /**
   * Remove a client from the project's client set
   */
  private removeClient(projectId: string, client: TestRunsClient) {
    const clients = this.clients.get(projectId);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        this.clients.delete(projectId);
      }
    }
  }

  /**
   * Broadcast message to all clients connected to a project
   */
  private broadcastToProject(projectId: string, message: TestRunMessage, runId?: string) {
    const clients = this.clients.get(projectId);
    if (!clients) return;

    const messageStr = JSON.stringify(message);
    
    clients.forEach(client => {
      // If runId is specified, only send to clients subscribed to that run or all runs
      if (runId && client.runId && client.runId !== runId) {
        return;
      }

      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  /**
   * Create a new test run and broadcast to connected clients
   */
  async createTestRun(testRun: InsertTestRun): Promise<TestRun> {
    const created = await this.storage.createTestRun(testRun);
    
    this.broadcastToProject(created.projectId, {
      type: 'update',
      testRun: created,
    });

    return created;
  }

  /**
   * Update a test run and broadcast to connected clients
   */
  async updateTestRun(id: string, updates: Partial<TestRun>): Promise<TestRun> {
    const updated = await this.storage.updateTestRun(id, updates);
    
    this.broadcastToProject(updated.projectId, {
      type: updated.status === 'passed' || updated.status === 'failed' || updated.status === 'cancelled' ? 'complete' : 'update',
      testRun: updated,
    }, updated.runId);

    return updated;
  }

  /**
   * Create a test case and broadcast to connected clients
   */
  async createTestCase(testCase: InsertTestCase): Promise<TestCase> {
    const created = await this.storage.createTestCase(testCase);
    
    // Get the test run to find project ID
    const testRun = await this.storage.getTestRun(created.testRunId);
    if (testRun) {
      this.broadcastToProject(testRun.projectId, {
        type: 'test_case',
        testCase: created,
      }, testRun.runId);
    }

    return created;
  }

  /**
   * Update a test case and broadcast to connected clients
   */
  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase> {
    const updated = await this.storage.updateTestCase(id, updates);
    
    // Get the test run to find project ID
    const testRun = await this.storage.getTestRun(updated.testRunId);
    if (testRun) {
      this.broadcastToProject(testRun.projectId, {
        type: 'test_case',
        testCase: updated,
      }, testRun.runId);
    }

    return updated;
  }

  /**
   * Get test runs for a project
   */
  async getTestRuns(projectId: string, limit?: number): Promise<TestRun[]> {
    return await this.storage.getTestRuns(projectId, limit);
  }

  /**
   * Get a specific test run
   */
  async getTestRun(id: string): Promise<TestRun | undefined> {
    return await this.storage.getTestRun(id);
  }

  /**
   * Get test cases for a test run
   */
  async getTestCases(testRunId: string): Promise<TestCase[]> {
    return await this.storage.getTestCases(testRunId);
  }

  /**
   * Get number of connected clients for a project
   */
  getConnectedClients(projectId: string): number {
    return this.clients.get(projectId)?.size || 0;
  }
}

/**
 * Setup function to create and initialize TestRunsService with WebSocket server
 */
export function setupTestRunsWebSocket(httpServer: any, storage: IStorage): TestRunsService {
  const testRunsService = new TestRunsService(storage);
  
  // Create WebSocket server at /api/test-runs/ws
  const wss = new WebSocketServer({ 
    noServer: true,
    path: '/api/test-runs/ws'
  });
  
  // Handle WebSocket upgrade requests
  httpServer.on('upgrade', (request: IncomingMessage, socket: any, head: Buffer) => {
    const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname;
    
    if (pathname === '/api/test-runs/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    }
  });
  
  testRunsService.initialize(wss);
  
  return testRunsService;
}
