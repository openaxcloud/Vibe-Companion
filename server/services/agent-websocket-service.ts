// WebSocket service for real-time agent progress updates
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import type { Duplex } from 'stream';
import { Server } from 'http';
import { createLogger } from '../utils/logger';
import { wrapWebSocketServer, markSocketAsHandled } from '../websocket/upgrade-guard';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { isOriginAllowed } from '../utils/origin-validation';
import { getJwtSecret } from '../utils/secrets-manager';
import jwt from 'jsonwebtoken';

const logger = createLogger('agent-websocket-service');

// WebSocket connection rate limiter (per IP)
// Prevents connection flooding attacks
const WS_CONNECTION_LIMITS = {
  maxConnectionsPerMinute: 30,     // Max new connections per IP per minute
  maxActiveConnections: 50,        // Max active connections per IP
  blockDurationMs: 60 * 1000,      // Block duration for violators (1 min)
};

// Simple in-memory rate limiter for WebSocket connections
const wsConnectionTracking = new Map<string, { count: number; timestamp: number; active: number }>();

function checkWebSocketRateLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const tracking = wsConnectionTracking.get(ip);
  
  // Skip rate limiting in development
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true };
  }
  
  if (!tracking) {
    wsConnectionTracking.set(ip, { count: 1, timestamp: now, active: 1 });
    return { allowed: true };
  }
  
  // Reset counter if window has passed
  if (now - tracking.timestamp > WS_CONNECTION_LIMITS.blockDurationMs) {
    wsConnectionTracking.set(ip, { count: 1, timestamp: now, active: tracking.active + 1 });
    return { allowed: true };
  }
  
  // Check connection rate
  if (tracking.count >= WS_CONNECTION_LIMITS.maxConnectionsPerMinute) {
    logger.warn(`[Agent WebSocket] Rate limit exceeded for IP: ${ip} (${tracking.count} connections in window)`);
    return { allowed: false, reason: 'Too many connection attempts' };
  }
  
  // Check active connections
  if (tracking.active >= WS_CONNECTION_LIMITS.maxActiveConnections) {
    logger.warn(`[Agent WebSocket] Max active connections exceeded for IP: ${ip} (${tracking.active} active)`);
    return { allowed: false, reason: 'Too many active connections' };
  }
  
  // Allow and increment
  tracking.count++;
  tracking.active++;
  return { allowed: true };
}

function decrementActiveConnections(ip: string): void {
  const tracking = wsConnectionTracking.get(ip);
  if (tracking && tracking.active > 0) {
    tracking.active--;
  }
}

// ✅ Fortune 500 Security (Dec 7, 2025): Use centralized secrets manager
// JWT secret now managed by secrets-manager.ts with proper dev fallbacks and prod enforcement

interface AgentProgressUpdate {
  type: 'step' | 'summary' | 'error' | 'complete';
  projectId: number;
  sessionId: string;
  data: {
    step?: {
      id: string;
      type: string;
      title: string;
      icon?: string;
      expandable?: boolean;
      details?: string[];
      file?: string;
      children?: any[];
    };
    summary?: {
      timeWorked: string;
      workDone: number;
      itemsRead: number;
      codeChanged: { added: number; removed: number };
      agentUsage: number;
    };
    error?: string;
    complete?: boolean;
  };
}

interface DeviceConnection {
  ws: WebSocket;
  deviceId: string;
  deviceType: 'web' | 'mobile' | 'desktop';
  connectedAt: Date;
  isAlive: boolean; // For heartbeat tracking
}

// ✅ Build State Cache (Dec 11, 2025): Store current build progress for reconnecting clients
// This solves the issue where clients lose connection during build and miss updates
// IMPORTANT: Only caches specific message types needed for replay, stores original message shape
interface BuildStateCache {
  projectId: string;
  sessionId: string;
  status: 'planning' | 'in_progress' | 'completed' | 'failed';
  phase: string;
  progress: number;
  plan?: any;  // The generated plan for replay
  error?: string;
  // Store original messages for faithful replay (max 15 messages)
  replayMessages: Array<{ message: any; timestamp: Date }>;
  lastUpdated: Date;
}

// Message types worth caching for reconnection replay
const CACHEABLE_MESSAGE_TYPES = new Set([
  'plan_generated', 'plan_ready',
  'task_start', 'task_complete',
  'file_created',
  'step',     // Step updates from sendStepUpdate
  'summary',  // Summary updates from sendSummaryUpdate
  'status'    // Only status updates with progress
]);

class AgentWebSocketService {
  public wss: WebSocketServer | null = null;
  private connections = new Map<string, Set<DeviceConnection>>();
  private pingInterval: NodeJS.Timeout | null = null;
  
  // ✅ Build State Cache: connectionKey -> BuildStateCache
  // Stores current build state so reconnecting clients get immediate state sync
  private buildStateCache = new Map<string, BuildStateCache>();
  
  initialize(server: Server) {
    // ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Use Central Upgrade Dispatcher
    // PROBLEM: 16+ upgrade listeners cause race conditions - "Invalid frame header" errors
    // SOLUTION: Register with central dispatcher that routes ALL upgrades through ONE handler
    // The dispatcher marks sockets BEFORE delegating, eliminating all race conditions
    
    this.wss = new WebSocketServer({ noServer: true });
    
    // 🔍 DEBUG: Add error handlers
    this.wss.on('error', (err: Error) => {
      logger.error('[Agent WebSocket] WebSocketServer ERROR:', err.message, err.stack);
    });
    
    this.wss.on('wsClientError', (err: Error, socket: any, request: any) => {
      logger.error('[Agent WebSocket] wsClientError:', err.message);
      logger.error('[Agent WebSocket] wsClientError URL:', request?.url);
    });
    
    // Register with the central dispatcher (priority 10 = high priority)
    // The dispatcher handles path matching and socket marking automatically
    centralUpgradeDispatcher.register(
      '/ws/agent',
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        this.handleAgentUpgrade(request, socket as Socket, head);
      },
      { pathMatch: 'exact', priority: 10 }
    );
    
    logger.info('[Agent WebSocket] Service initialized with noServer + prependListener mode');
    
    // Start heartbeat for connection health monitoring
    this.startHeartbeat();
    
    this.wss.on('connection', (ws, req) => {
      logger.info(`[Agent WebSocket] 🎯 CONNECTION ESTABLISHED! URL: ${req.url}, ws.readyState: ${ws.readyState}`);
      
      logger.info(`[Agent WebSocket] New connection attempt from ${req.socket.remoteAddress} - URL: ${req.url}`);
      
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const projectId = url.searchParams.get('projectId');
      const sessionId = url.searchParams.get('sessionId');
      const deviceId = url.searchParams.get('deviceId') || `device-${Date.now()}`;
      const deviceType = (url.searchParams.get('deviceType') || 'web') as 'web' | 'mobile' | 'desktop';
      
      logger.info(`[Agent WebSocket] Parsed params - projectId: ${projectId}, sessionId: ${sessionId}, deviceId: ${deviceId}, deviceType: ${deviceType}`);
      
      if (!projectId || !sessionId) {
        logger.warn(`[Agent WebSocket] Rejecting connection - missing params (projectId: ${projectId}, sessionId: ${sessionId})`);
        ws.close(1008, 'Missing projectId or sessionId');
        return;
      }
      
      const connectionKey = `${projectId}-${sessionId}`;
      
      // Create device connection object
      const deviceConnection: DeviceConnection = {
        ws,
        deviceId,
        deviceType,
        connectedAt: new Date(),
        isAlive: true // Initially alive
      };
      
      // Add to connections map (supports multiple devices per session)
      if (!this.connections.has(connectionKey)) {
        this.connections.set(connectionKey, new Set());
      }
      this.connections.get(connectionKey)!.add(deviceConnection);
      
      const deviceCount = this.connections.get(connectionKey)!.size;
      logger.info(`[Agent WebSocket] ✅ Connection established: ${connectionKey} (deviceId: ${deviceId}, type: ${deviceType}, total devices: ${deviceCount})`);
      
      // Handle close, pong, message events here (moved from below)
      this.setupConnectionHandlers(ws, connectionKey, deviceConnection);
      
      // ✅ FIX (Dec 11, 2025): Send 'connected' message to client immediately
      // This ensures the client knows the connection is established before workflow starts
      const connectedMsg = JSON.stringify({
        type: 'connected',
        sessionId,
        projectId,
        deviceId,
        deviceType,
        message: 'WebSocket connection established'
      });
      
      logger.info(`[Agent WebSocket] 📤 SENDING 'connected' message, ws.readyState: ${ws.readyState}, OPEN=${ws.readyState === 1}`);
      try {
        ws.send(connectedMsg);
        logger.info(`[Agent WebSocket] ✅ 'connected' message SENT successfully to ${connectionKey}`);
      } catch (sendError: any) {
        logger.error(`[Agent WebSocket] ❌ FAILED to send 'connected' message:`, sendError.message);
      }
      
      // Trigger workflow check/start
      this.checkAndStartWorkflow(projectId, sessionId, ws);
    });
  }
  
  /**
   * Handle the WebSocket upgrade for /ws/agent
   * Called by the central dispatcher after socket is already marked as handled
   */
  private handleAgentUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void {
    try {
      // PRODUCTION SECURITY: Origin validation (prevents CSRF attacks)
      const origin = request.headers.origin;
      const host = request.headers.host;
      if (process.env.NODE_ENV === 'production' && !isOriginAllowed(origin, host)) {
        logger.warn(`[Agent WebSocket] Origin validation failed - origin: ${origin}, host: ${host}`);
        socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nContent-Length: 14\r\n\r\nInvalid origin');
        socket.destroy();
        return;
      }
      
      // PRODUCTION SECURITY: Rate limiting (prevents connection flooding)
      const clientIp = request.socket?.remoteAddress || 'unknown';
      const rateLimitResult = checkWebSocketRateLimit(clientIp);
      if (!rateLimitResult.allowed) {
        logger.warn(`[Agent WebSocket] Rate limit rejected - IP: ${clientIp}, reason: ${rateLimitResult.reason}`);
        socket.write('HTTP/1.1 429 Too Many Requests\r\nContent-Type: text/plain\r\nContent-Length: 22\r\n\r\nToo many connections');
        socket.destroy();
        return;
      }
      
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const projectId = url.searchParams.get('projectId');
      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('bootstrap');
      
      // Parse cookies for session-based auth
      const cookies = this.parseCookies(request.headers.cookie || '');
      const hasSessionCookie = !!cookies['ecode.sid'];
      
      logger.info(`[Agent WebSocket] Upgrade handler: projectId=${projectId}, sessionId=${sessionId}, hasToken=${!!token}, hasSessionCookie=${hasSessionCookie}`);
      
      // Validate parameters
      if (!projectId || !sessionId) {
        logger.warn('[Agent WebSocket] Missing projectId or sessionId - rejecting');
        socket.write('HTTP/1.1 400 Bad Request\r\nContent-Type: text/plain\r\nContent-Length: 30\r\n\r\nMissing projectId or sessionId');
        socket.destroy();
        return;
      }
      
      // TWO authentication modes:
      // 1. Bootstrap token (for autonomous workspace creation)
      // 2. Session cookie (for normal IDE usage)
      
      if (token) {
        // Mode 1: Bootstrap token authentication (synchronous)
        try {
          const decoded = jwt.verify(token, getJwtSecret()) as any;
          
          if (decoded.projectId !== projectId || decoded.sessionId !== sessionId) {
            logger.warn('[Agent WebSocket] Token projectId/sessionId mismatch - rejecting');
            socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nContent-Length: 14\r\n\r\nToken mismatch');
            socket.destroy();
            return;
          }
          
          logger.info(`[Agent WebSocket] Token validated for project ${projectId}, session ${sessionId}`);
          
          // Complete the WebSocket handshake
          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            logger.info(`[Agent WebSocket] Upgrade complete, emitting connection event`);
            this.wss!.emit('connection', ws, request);
          });
          return;
          
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.warn(`[Agent WebSocket] Token validation failed: ${errorMsg}`);
          socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\nInvalid token');
          socket.destroy();
          return;
        }
      }
      
      // Mode 2: Session cookie authentication (for normal IDE usage)
      // ARCHITECTURE: Accept the connection FIRST (synchronously), then validate
      // and close if validation fails. This avoids async timing issues with handleUpgrade.
      if (hasSessionCookie) {
        logger.info(`[Agent WebSocket] Session cookie present - completing upgrade first, then validating`);
        
        // Complete the WebSocket handshake SYNCHRONOUSLY
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          logger.info(`[Agent WebSocket] 🎯 UPGRADE COMPLETE (session auth pending validation)!`);
          
          // Now validate the session asynchronously
          this.validateSessionCookie(cookies['ecode.sid'], projectId)
            .then((userId) => {
              if (userId) {
                logger.info(`[Agent WebSocket] ✅ Session validated for user ${userId}, project ${projectId}, session ${sessionId}`);
                // Emit connection event to complete setup
                this.wss!.emit('connection', ws, request);
              } else {
                logger.warn('[Agent WebSocket] Session validation returned null user - closing connection');
                ws.close(4001, 'Session validation failed');
              }
            })
            .catch((err) => {
              const errorMsg = err instanceof Error ? err.message : String(err);
              logger.warn(`[Agent WebSocket] Session validation failed: ${errorMsg} - closing connection`);
              ws.close(4001, 'Session validation failed');
            });
        });
        return;
      }
      
      // No valid authentication found
      logger.warn('[Agent WebSocket] No valid authentication (no token, no session cookie) - rejecting');
      socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\nContent-Length: 42\r\n\r\nAuthentication required (token or session)');
      socket.destroy();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      logger.error(`[Agent WebSocket] handleAgentUpgrade crashed: ${errorMsg}`);
      logger.error(`[Agent WebSocket] Stack trace: ${errorStack}`);
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      } catch (e) {
        // Socket may already be destroyed
      }
    }
  }

  /**
   * Setup event handlers for a WebSocket connection
   */
  private setupConnectionHandlers(ws: WebSocket, connectionKey: string, deviceConnection: DeviceConnection): void {
    ws.on('error', (error) => {
      logger.error(`[Agent WebSocket] WebSocket error for ${connectionKey} (device: ${deviceConnection.deviceId}): ${error.message}`);
    });
    
    // Handle WebSocket-level pong (for native clients)
    ws.on('pong', () => {
      deviceConnection.isAlive = true;
      this.handlePong(connectionKey, deviceConnection.deviceId);
    });
    
    // Handle application-level messages (including pong for browser clients)
    // SECURITY: Message size limit to prevent memory exhaustion attacks
    const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB limit
    
    ws.on('message', (data) => {
      // SECURITY FIX #26: Reject oversized messages
      const messageSize = Buffer.isBuffer(data) ? data.length : data.toString().length;
      if (messageSize > MAX_MESSAGE_SIZE) {
        logger.warn(`[Agent WebSocket] Message too large (${messageSize} bytes) from ${connectionKey} - closing connection`);
        ws.close(1009, 'Message too large');
        return;
      }
      
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong') {
          deviceConnection.isAlive = true;
          this.handlePong(connectionKey, deviceConnection.deviceId);
        }
        // Other message types can be handled here as needed
      } catch (e) {
        // Ignore non-JSON messages
      }
    });
    
    ws.on('close', (code, reason) => {
      // PRODUCTION SECURITY: Decrement active connection count for rate limiting
      const clientIp = 'unknown'; // Rate limiting tracking
      decrementActiveConnections(clientIp);
      
      // Remove this device from the connections
      const connections = this.connections.get(connectionKey);
      if (connections) {
        connections.delete(deviceConnection);
        
        const remainingDevices = connections.size;
        logger.info(`[Agent WebSocket] Connection closed: ${connectionKey} (deviceId: ${deviceConnection.deviceId}, code: ${code}, remaining devices: ${remainingDevices})`);
        
        // Clean up empty connection sets
        if (remainingDevices === 0) {
          this.connections.delete(connectionKey);
        } else {
          // Notify other devices about disconnection
          this.broadcastPresence(connectionKey, {
            type: 'device_disconnected',
            deviceId: deviceConnection.deviceId,
            deviceType: deviceConnection.deviceType,
            totalDevices: remainingDevices
          }, deviceConnection.deviceId);
        }
      }
    });
  }

  /**
   * Check if workflow should be started and trigger it if needed
   */
  private async checkAndStartWorkflow(projectId: string, sessionId: string, ws: WebSocket): Promise<void> {
    try {
      // Import services dynamically to avoid circular dependencies
      const { db } = await import('../db');
      const { agentPlans, agentWorkflows, agentSessions, projects } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const { agentOrchestrator } = await import('./agent-orchestrator.service');

      // Check if a plan exists for this session
      const existingPlans = await db.select()
        .from(agentPlans)
        .where(eq(agentPlans.sessionId, sessionId))
        .limit(1);

      if (existingPlans.length > 0) {
        logger.info(`[Agent WebSocket] Plan already exists for session ${sessionId}, checking workflow...`);

        // Check if workflow has been executed
        const existingWorkflows = await db.select()
          .from(agentWorkflows)
          .where(eq(agentWorkflows.sessionId, sessionId))
          .limit(1);

        if (existingWorkflows.length === 0) {
          logger.warn(`[Agent WebSocket] Plan exists but NO workflow! Starting execution for session ${sessionId}...`);

          const sessions = await db.select()
            .from(agentSessions)
            .where(eq(agentSessions.id, sessionId))
            .limit(1);

          if (sessions.length === 0) {
            throw new Error(`Session ${sessionId} not found`);
          }

          const session = sessions[0];
          const storedPlan = existingPlans[0];

          const executionPlan = {
            goal: storedPlan.goal,
            tasks: storedPlan.tasks,
            metadata: storedPlan.metadata ?? {},
            planId: storedPlan.planId,
            estimatedTime: storedPlan.estimatedTime
          };

          await agentOrchestrator.executeAutonomousPlan(
            sessionId,
            executionPlan,
            projectId,
            session.userId.toString()
          );

          logger.info(`[Agent WebSocket] ✅ Workflow execution started for session ${sessionId}`);
        } else {
          const workflow = existingWorkflows[0];
          logger.info(`[Agent WebSocket] Workflow already exists for session ${sessionId}, status: ${workflow.status}`);
          
          // Send current status to client
          if (workflow.status === 'completed') {
            ws.send(JSON.stringify({
              type: 'complete',
              sessionId,
              projectId,
              message: 'Workspace creation completed successfully!',
              workflowId: workflow.id
            }));
          } else if (workflow.status === 'failed') {
            ws.send(JSON.stringify({
              type: 'error',
              sessionId,
              projectId,
              message: workflow.error || 'Workspace creation failed',
              workflowId: workflow.id
            }));
          } else if (workflow.status === 'in_progress') {
            // ✅ Build State Cache (Dec 11, 2025): Send cached build state for reconnecting clients
            const cachedState = this.getBuildState(projectId, sessionId);
            
            if (cachedState && cachedState.replayMessages.length > 0) {
              // Send full cached state so client can reconstruct progress
              logger.info(`[Agent WebSocket] 📦 Replaying ${cachedState.replayMessages.length} cached messages to reconnecting client (${cachedState.progress}% progress)`);
              
              // First send current status with progress
              ws.send(JSON.stringify({
                type: 'status',
                sessionId,
                projectId,
                message: 'Workspace creation in progress...',
                status: cachedState.phase,
                progress: cachedState.progress,
                workflowId: workflow.id,
                isReplay: true
              }));
              
              // Send cached plan if available (always send plan first for UI to render properly)
              if (cachedState.plan) {
                ws.send(JSON.stringify({
                  type: 'plan_generated',
                  sessionId,
                  projectId,
                  plan: cachedState.plan,
                  message: 'Plan restored from cache',
                  isReplay: true
                }));
              }
              
              // Replay cached messages in original format
              for (const { message } of cachedState.replayMessages) {
                // Add isReplay flag but preserve original message structure
                ws.send(JSON.stringify({
                  ...message,
                  isReplay: true
                }));
              }
            } else {
              // No cached state, send simple status
              ws.send(JSON.stringify({
                type: 'status',
                sessionId,
                projectId,
                message: 'Workspace creation in progress...',
                status: 'in_progress',
                progress: workflow.progress || 0,
                workflowId: workflow.id
              }));
            }
          }
        }
      } else {
        // No plan - check if we need to start the workflow
        logger.info(`[Agent WebSocket] No plan found for session ${sessionId} - checking if workflow should start...`);

        const sessions = await db.select()
          .from(agentSessions)
          .where(eq(agentSessions.id, sessionId))
          .limit(1);

        if (sessions.length === 0) {
          logger.error(`[Agent WebSocket] Session ${sessionId} not found!`);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Session not found',
            sessionId,
            projectId
          }));
          return;
        }

        const session = sessions[0];
        
        // Check if session is in idle status
        if (session.workflowStatus === 'idle' || !session.workflowStatus) {
          logger.info(`[Agent WebSocket] 🚀 Session ${sessionId} is idle - starting autonomous workspace NOW!`);

          // ✅ FIX (Dec 11, 2025): Send waiting_for_plan status with progress percentage
          ws.send(JSON.stringify({
            type: 'status',
            status: 'waiting_for_plan',
            message: 'Connecting to AI...',
            progress: 8,
            phaseName: 'Waiting for AI',
            sessionId,
            projectId
          }));

          const projectRows = await db.select()
            .from(projects)
            .where(eq(projects.id, Number(projectId)))
            .limit(1);

          if (projectRows.length === 0) {
            throw new Error(`Project ${projectId} not found`);
          }

          const prompt = projectRows[0].description || projectRows[0].name || 'Create a web application';

          agentOrchestrator.startAutonomousWorkspace({
            sessionId,
            projectId: String(projectId),
            userId: String(session.userId),
            prompt: prompt,
            options: {
              language: 'typescript',
              framework: 'react'
            }
          }).then(() => {
            logger.info(`[Agent WebSocket] ✅ startAutonomousWorkspace COMPLETED for session ${sessionId}`);
          }).catch(error => {
            logger.error(`[Agent WebSocket] ❌ startAutonomousWorkspace FAILED:`, error);
            ws.send(JSON.stringify({
              type: 'error',
              message: `Workspace creation failed: ${error.message}`,
              sessionId,
              projectId
            }));
          });
        } else {
          logger.info(`[Agent WebSocket] Session ${sessionId} already in status: ${session.workflowStatus}`);
          const statusMsg = JSON.stringify({
            type: 'status',
            status: session.workflowStatus,
            message: `Workspace creation ${session.workflowStatus}...`,
            sessionId,
            projectId
          });
          logger.info(`[Agent WebSocket] 📤 SENDING 'status' message (${session.workflowStatus}), ws.readyState: ${ws.readyState}`);
          try {
            ws.send(statusMsg);
            logger.info(`[Agent WebSocket] ✅ 'status' message SENT for session ${sessionId}`);
          } catch (sendError: any) {
            logger.error(`[Agent WebSocket] ❌ FAILED to send 'status' message:`, sendError.message);
          }
        }
      }
    } catch (error: any) {
      logger.error(`[Agent WebSocket] Failed to check/start workflow for session ${sessionId}:`, error);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to start workspace workflow: ${error.message}`,
        sessionId,
        projectId
      }));
    }
  }

  // ✅ CRITICAL FIX (Dec 1, 2025): verifyClient validates bootstrap tokens/sessions BEFORE WebSocket upgrade
  // This replaces the complex manual handleUpgrade flow that leaked requests to Express/Vite
  private verifyClient(
    info: { origin: string; req: IncomingMessage; secure: boolean },
    callback: (res: boolean, code?: number, message?: string) => void
  ) {
    try {
      const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
      const projectId = url.searchParams.get('projectId');
      const sessionId = url.searchParams.get('sessionId');
      // ✅ CRITICAL FIX (Dec 1, 2025): Frontend sends 'bootstrap', not 'bootstrapToken'
      const bootstrapToken = url.searchParams.get('bootstrap') || url.searchParams.get('bootstrapToken');
      
      logger.info(`[Agent WebSocket] verifyClient: projectId=${projectId}, sessionId=${sessionId}, hasToken=${!!bootstrapToken}`);
      
      // Require projectId and sessionId
      if (!projectId || !sessionId) {
        logger.warn(`[Agent WebSocket] Rejecting connection - missing projectId or sessionId`);
        callback(false, 400, 'Missing projectId or sessionId');
        return;
      }
      
      // For bootstrap connections, validate the JWT token
      if (bootstrapToken) {
        try {
          const decoded = jwt.verify(bootstrapToken, getJwtSecret()) as {
            type: string;
            projectId: number;
            sessionId: string;
            userId: number;
            exp?: number;
          };
          
          // Validate token claims
          if (decoded.type !== 'agent_bootstrap') {
            logger.warn(`[Agent WebSocket] Invalid token type: ${decoded.type}`);
            callback(false, 401, 'Invalid token type');
            return;
          }
          
          if (decoded.sessionId !== sessionId) {
            logger.warn(`[Agent WebSocket] Session ID mismatch: token=${decoded.sessionId}, param=${sessionId}`);
            callback(false, 403, 'Session ID mismatch');
            return;
          }
          
          if (decoded.projectId.toString() !== projectId) {
            logger.warn(`[Agent WebSocket] Project ID mismatch: token=${decoded.projectId}, param=${projectId}`);
            callback(false, 403, 'Project ID mismatch');
            return;
          }
          
          logger.info(`[Agent WebSocket] ✅ Bootstrap token validated for project ${projectId}, session ${sessionId}`);
          callback(true);
          return;
        } catch (error: any) {
          logger.warn(`[Agent WebSocket] Bootstrap token validation failed: ${error.message}`);
          callback(false, 401, 'Invalid or expired bootstrap token');
          return;
        }
      }
      
      // For non-bootstrap connections, we'll validate session in the connection handler
      // This is a fallback for authenticated users who don't have a bootstrap token
      logger.info(`[Agent WebSocket] Allowing connection without bootstrap token (will validate session later)`);
      callback(true);
      
    } catch (error: any) {
      logger.error(`[Agent WebSocket] verifyClient error: ${error.message}`);
      callback(false, 500, 'Internal server error');
    }
  }
  
  // Track last pong responses and missed pings
  private devicePingState: Map<string, { lastPong: number; missedPings: number }> = new Map();
  private readonly MAX_MISSED_PINGS = 3;
  private readonly PING_INTERVAL_MS = 30000;
  
  // Heartbeat using application-level ping (JSON messages)
  // Browser WebSocket clients don't support ws.ping() API, so we use JSON messages
  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      this.connections.forEach((devices, connectionKey) => {
        devices.forEach((device) => {
          const deviceKey = `${connectionKey}:${device.deviceId}`;
          
          // Check if connection is dead
          if (device.ws.readyState === WebSocket.CLOSED || device.ws.readyState === WebSocket.CLOSING) {
            devices.delete(device);
            this.devicePingState.delete(deviceKey);
            logger.debug(`[Heartbeat] Removed closed device ${device.deviceId} from ${connectionKey}`);
            return;
          }
          
          // Initialize ping state if needed
          if (!this.devicePingState.has(deviceKey)) {
            this.devicePingState.set(deviceKey, { lastPong: now, missedPings: 0 });
          }
          
          const pingState = this.devicePingState.get(deviceKey)!;
          
          // Check if we've received a recent pong
          if (now - pingState.lastPong > this.PING_INTERVAL_MS * 1.5) {
            pingState.missedPings++;
            
            if (pingState.missedPings >= this.MAX_MISSED_PINGS) {
              logger.warn(`[Heartbeat] Device ${device.deviceId} missed ${pingState.missedPings} pings, terminating`);
              try {
                device.ws.close(1000, 'Heartbeat timeout');
              } catch (e: any) { console.error('[catch]', e?.message || e); }
              devices.delete(device);
              this.devicePingState.delete(deviceKey);
              return;
            }
          } else {
            pingState.missedPings = 0;
          }
          
          // Send application-level ping
          if (device.ws.readyState === WebSocket.OPEN) {
            try {
              device.ws.send(JSON.stringify({ type: 'ping', timestamp: now }));
            } catch (e) {
              logger.error(`[Heartbeat] Failed to ping device ${device.deviceId}: ${e}`);
            }
          }
        });
        
        // Clean up empty connection sets
        if (devices.size === 0) {
          this.connections.delete(connectionKey);
        }
      });
      
      // Cleanup orphaned ping states
      for (const [deviceKey] of this.devicePingState.entries()) {
        const [projSession] = deviceKey.split(':');
        if (!this.connections.has(projSession)) {
          this.devicePingState.delete(deviceKey);
        }
      }
    }, this.PING_INTERVAL_MS);
  }
  
  // Handle pong response from client
  private handlePong(connectionKey: string, deviceId: string) {
    const deviceKey = `${connectionKey}:${deviceId}`;
    const pingState = this.devicePingState.get(deviceKey);
    if (pingState) {
      pingState.lastPong = Date.now();
      pingState.missedPings = 0;
    }
  }
  
  // Broadcast presence updates to all devices EXCEPT the sender
  private broadcastPresence(connectionKey: string, message: any, excludeDeviceId?: string) {
    const devices = this.connections.get(connectionKey);
    if (!devices) return;
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    devices.forEach((device) => {
      if (device.deviceId !== excludeDeviceId && device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(messageStr);
        sentCount++;
      }
    });
    
    logger.debug(`[Presence] Broadcasted ${message.type} to ${sentCount} devices on ${connectionKey}`);
  }
  
  // Parse cookies from cookie header string
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;
    
    cookieHeader.split(';').forEach((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name) {
        cookies[name.trim()] = valueParts.join('=');
      }
    });
    
    return cookies;
  }
  
  // Validate session cookie and check project access
  // Uses the session store directly (like LSPService) instead of database queries
  private async validateSessionCookie(sessionCookie: string, projectId: string): Promise<number | null> {
    try {
      // Decode the session cookie (it's URL encoded and signed)
      // Format: s%3A<sessionId>.<signature> -> s:<sessionId>.<signature>
      const decodedCookie = decodeURIComponent(sessionCookie);
      
      // Remove the 's:' prefix and signature (format: s:sessionId.signature)
      const actualSessionId = decodedCookie.split('.')[0].replace('s:', '');
      
      if (!actualSessionId) {
        logger.warn('[Agent WebSocket] Could not extract session ID from cookie');
        return null;
      }
      
      logger.debug(`[Agent WebSocket] Extracted session ID: ${actualSessionId.substring(0, 10)}...`);
      
      // Use the session store directly (global variable set during app initialization)
      const sessionStore = (global as any).sessionStore;
      if (!sessionStore) {
        logger.error('[Agent WebSocket] Session store not available');
        return null;
      }
      
      // Get session data from store
      const session = await new Promise<any>((resolve, reject) => {
        sessionStore.get(actualSessionId, (err: Error | null, session: any) => {
          if (err) reject(err);
          else resolve(session);
        });
      });
      
      if (!session || !session.passport || !session.passport.user) {
        logger.warn('[Agent WebSocket] Invalid or expired session');
        return null;
      }
      
      const userId = session.passport.user;
      logger.debug(`[Agent WebSocket] Session found for user: ${userId}`);
      
      // Verify user has access to this project
      const { db } = await import('../db');
      const { projects } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      const projectRows = await db.select()
        .from(projects)
        .where(eq(projects.id, parseInt(projectId, 10)))
        .limit(1);
      
      if (!projectRows.length) {
        logger.warn(`[Agent WebSocket] Project ${projectId} not found`);
        return null;
      }
      
      const project = projectRows[0];
      
      // Check if user owns the project or is a collaborator
      // For now, just check ownership (can expand to collaborators later)
      if (project.ownerId !== userId) {
        logger.warn(`[Agent WebSocket] User ${userId} does not have access to project ${projectId}`);
        return null;
      }
      
      return userId;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[Agent WebSocket] Session validation error: ${errorMsg}`);
      return null;
    }
  }
  
  // Send progress update to ALL connected devices for a session
  // ✅ Updated Dec 11, 2025: Also updates build state cache for reconnection support
  sendProgress(update: AgentProgressUpdate) {
    const connectionKey = `${update.projectId}-${update.sessionId}`;
    
    // ✅ Always update build state cache, even if no devices connected
    this.updateBuildStateCache(connectionKey, update);
    
    const devices = this.connections.get(connectionKey);
    
    if (!devices || devices.size === 0) {
      logger.debug(`Cannot broadcast status: No active connections for ${connectionKey}`);
      return;
    }
    
    const messageStr = JSON.stringify(update);
    let sentCount = 0;
    
    devices.forEach((device) => {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(messageStr);
        sentCount++;
      }
    });
    
    logger.debug(`Sent progress update to ${sentCount} device(s) on ${connectionKey}: ${update.type}`);
  }
  
  sendStepUpdate(projectId: number, sessionId: string, step: any) {
    this.sendProgress({
      type: 'step',
      projectId,
      sessionId,
      data: { step }
    });
  }
  
  sendSummaryUpdate(projectId: number, sessionId: string, summary: any) {
    this.sendProgress({
      type: 'summary',
      projectId,
      sessionId,
      data: { summary }
    });
  }
  
  sendError(projectId: number, sessionId: string, error: string) {
    this.sendProgress({
      type: 'error',
      projectId,
      sessionId,
      data: { error }
    });
  }
  
  sendComplete(projectId: number, sessionId: string) {
    this.sendProgress({
      type: 'complete',
      projectId,
      sessionId,
      data: { complete: true }
    });
  }

  // ============================================================================
  // ✅ Replit Agent 2024 Inline Progress Methods (Dec 12, 2025)
  // These methods emit rich UI messages for the new inline chat components
  // ============================================================================

  /**
   * Send a timeline event (file create/edit/delete, commands, checkpoints)
   * Renders as InlineProgressTimeline in the chat
   */
  sendTimelineEvent(projectId: number, sessionId: string, event: {
    id: string;
    type: 'file_create' | 'file_edit' | 'file_delete' | 'command' | 'checkpoint' | 'info';
    title: string;
    description?: string;
    filePath?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'error';
  }) {
    this.broadcastToSession(projectId, sessionId, {
      type: 'autonomous_timeline_event',
      projectId: projectId.toString(),
      sessionId,
      event: {
        ...event,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Send a checkpoint milestone marker
   * Renders as InlineCheckpoint in the chat
   */
  sendCheckpoint(projectId: number, sessionId: string, checkpoint: {
    title: string;
    description?: string;
    number?: number;
    completedTasks?: number;
    totalTasks?: number;
    eta?: string;
  }) {
    this.broadcastToSession(projectId, sessionId, {
      type: 'autonomous_checkpoint',
      projectId: projectId.toString(),
      sessionId,
      checkpoint
    });
  }

  /**
   * Send task list with progress
   * Renders as InlineTaskListEnhanced in the chat
   */
  sendTaskList(projectId: number, sessionId: string, taskList: {
    title?: string;
    items: Array<{
      id: string;
      title: string;
      status: 'pending' | 'in_progress' | 'completed' | 'error';
      filePath?: string;
      duration?: number;
    }>;
    showProgress?: boolean;
    compact?: boolean;
  }) {
    this.broadcastToSession(projectId, sessionId, {
      type: 'autonomous_task_list',
      projectId: projectId.toString(),
      sessionId,
      taskList
    });
  }

  /**
   * Send a plan card with app type and features
   * Renders as InlinePlanCard in the chat
   */
  sendPlan(projectId: number, sessionId: string, plan: {
    appType?: string;
    features?: string[];
    description?: string;
    showBuildOptions?: boolean;
    onSelectBuildMode?: (mode: 'fast' | 'balanced' | 'thorough') => void;
    onChangePlan?: () => void;
  }) {
    this.broadcastToSession(projectId, sessionId, {
      type: 'autonomous_plan',
      projectId: projectId.toString(),
      sessionId,
      plan
    });
  }

  /**
   * Send preview window update
   * Renders as InlinePreviewWindow in the chat
   */
  sendPreview(projectId: number, sessionId: string, preview: {
    url?: string;
    title?: string;
    isLoading?: boolean;
    isLive?: boolean;
  }) {
    this.broadcastToSession(projectId, sessionId, {
      type: 'autonomous_preview',
      projectId: projectId.toString(),
      sessionId,
      preview
    });
  }

  /**
   * Send a file operation notification
   * Renders as InlineFileOperation in the chat
   */
  sendFileOperation(projectId: number, sessionId: string, operation: {
    type: 'create' | 'update' | 'delete' | 'rename';
    filePath: string;
    language?: string;
    content?: string;
    linesAdded?: number;
    linesRemoved?: number;
  }) {
    this.broadcastToSession(projectId, sessionId, {
      type: 'autonomous_file_operation',
      projectId: projectId.toString(),
      sessionId,
      fileOperation: operation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast a message to all devices connected to a session
   */
  private broadcastToSession(projectId: number, sessionId: string, message: any) {
    const connectionKey = `${projectId}-${sessionId}`;
    const devices = this.connections.get(connectionKey);
    
    if (!devices || devices.size === 0) {
      logger.debug(`[Agent WebSocket] No active connections for ${connectionKey}, skipping broadcast`);
      return;
    }
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    devices.forEach((device) => {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(messageStr);
        sentCount++;
      }
    });
    
    logger.debug(`[Agent WebSocket] Broadcasted ${message.type} to ${sentCount} device(s)`);
  }

  // ✅ Build State Cache Methods (Dec 11, 2025)
  
  /**
   * Update the build state cache with new progress information
   * Only caches specific message types for replay, stores original message shape
   */
  private updateBuildStateCache(connectionKey: string, message: any) {
    const now = new Date();
    
    // Skip non-cacheable message types
    if (!CACHEABLE_MESSAGE_TYPES.has(message.type)) {
      // Still update status for complete/error to trigger cleanup
      if (message.type === 'complete' || message.type === 'error') {
        const existingState = this.buildStateCache.get(connectionKey);
        if (existingState) {
          existingState.status = message.type === 'complete' ? 'completed' : 'failed';
          existingState.phase = message.type;
          existingState.lastUpdated = now;
          if (message.type === 'error') {
            existingState.error = message.message || message.data?.error;
          }
          // Don't delete immediately - keep for potential reconnection
          // Will be cleaned up by cleanupOldCacheEntries
        }
      }
      return;
    }
    
    // Initialize or get existing state
    let state = this.buildStateCache.get(connectionKey);
    if (!state) {
      state = {
        projectId: message.projectId?.toString() || '',
        sessionId: message.sessionId || '',
        status: 'planning',
        phase: 'planning',
        progress: 0,
        replayMessages: [],
        lastUpdated: now
      };
      this.buildStateCache.set(connectionKey, state);
    }
    
    // Update based on message type
    if (message.type === 'status' && typeof message.progress === 'number') {
      state.progress = message.progress;
      state.phase = message.status || state.phase;
      state.status = 'in_progress';
    } else if (message.type === 'plan_generated' || message.type === 'plan_ready') {
      state.plan = message.plan || message.data?.plan;
      state.phase = 'executing';
      state.status = 'in_progress';
    } else if (message.type === 'task_complete' && typeof message.progress === 'number') {
      state.progress = message.progress;
    }
    
    // Store original message for replay (except status updates which are redundant)
    if (message.type !== 'status') {
      state.replayMessages.push({ message: { ...message }, timestamp: now });
      // Keep only last 15 messages for replay
      if (state.replayMessages.length > 15) {
        state.replayMessages = state.replayMessages.slice(-15);
      }
    }
    
    state.lastUpdated = now;
    
    // Periodic cleanup (every 20 updates)
    if (Math.random() < 0.05) {
      this.cleanupOldCacheEntries();
    }
  }
  
  /**
   * Get cached build state for a session
   */
  getBuildState(projectId: string | number, sessionId: string): BuildStateCache | undefined {
    const connectionKey = `${projectId}-${sessionId}`;
    return this.buildStateCache.get(connectionKey);
  }
  
  /**
   * Clear build state cache for a session
   */
  clearBuildState(projectId: string | number, sessionId: string) {
    const connectionKey = `${projectId}-${sessionId}`;
    this.buildStateCache.delete(connectionKey);
    logger.debug(`[Agent WebSocket] Cleared build state cache for ${connectionKey}`);
  }
  
  /**
   * Clean up cache entries older than 30 minutes (completed/failed) or 2 hours (in_progress)
   */
  private cleanupOldCacheEntries() {
    const now = Date.now();
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    
    for (const [key, state] of this.buildStateCache.entries()) {
      const isFinished = state.status === 'completed' || state.status === 'failed';
      const maxAge = isFinished ? thirtyMinutesAgo : twoHoursAgo;
      
      if (state.lastUpdated < maxAge) {
        this.buildStateCache.delete(key);
        logger.debug(`[Agent WebSocket] Cleaned up stale build cache for ${key}`);
      }
    }
  }

  // Generic broadcast method for autonomous agent events (sends to ALL devices)
  broadcast(message: any, projectId: string | number) {
    const sessionId = message.sessionId || 'default';
    const connectionKey = `${projectId}-${sessionId}`;
    const devices = this.connections.get(connectionKey);

    // ✅ Always update build state cache, even if no devices connected
    // This ensures reconnecting clients can get current state
    this.updateBuildStateCache(connectionKey, message);

    if (!devices || devices.size === 0) {
      // Changed to debug - this is expected during autonomous workspace creation without UI
      logger.debug(`Cannot broadcast ${message.type}: No active connections for ${connectionKey}`);
      return;
    }

    const messageStr = JSON.stringify(message);
    let sentCount = 0;

    devices.forEach((device) => {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(messageStr);
        sentCount++;
      }
    });

    logger.debug(`Broadcasted ${message.type} to ${sentCount} device(s) on ${connectionKey}`);
  }

  // NEW: Convenience methods for plan execution events (matches frontend expectations)
  broadcastPlanStarted(projectId: string | number, sessionId: string, totalTasks: number) {
    this.broadcast({
      type: 'task_start',
      projectId,
      sessionId,
      taskName: 'Initializing autonomous workspace creation',
      message: `Starting ${totalTasks} tasks...`
    }, projectId);
  }

  broadcastTaskStarted(projectId: string | number, sessionId: string, taskIndex: number, task: any) {
    this.broadcast({
      type: 'task_start',
      projectId,
      sessionId,
      taskId: task.id || `task-${taskIndex}`,
      taskName: task.description || task.name || `Task ${taskIndex + 1}`,
      message: task.description || `Starting task ${taskIndex + 1}`
    }, projectId);
  }

  broadcastTaskCompleted(projectId: string | number, sessionId: string, taskIndex: number, totalTasks: number, result: any) {
    const progress = Math.round(((taskIndex + 1) / totalTasks) * 100);
    this.broadcast({
      type: 'task_complete',
      projectId,
      sessionId,
      taskId: result.stepId || `task-${taskIndex}`,
      taskName: `Task ${taskIndex + 1} completed`,
      progress
    }, projectId);
  }

  broadcastFileCreated(projectId: string | number, sessionId: string, filePath: string) {
    this.broadcast({
      type: 'file_created',
      projectId,
      sessionId,
      filePath
    }, projectId);
  }

  broadcastCommandOutput(projectId: string | number, sessionId: string, stream: 'stdout' | 'stderr', data: string) {
    this.broadcast({
      type: 'command_output',
      projectId,
      sessionId,
      stream,
      data
    }, projectId);
  }

  broadcastPlanCompleted(projectId: string | number, sessionId: string, success: boolean) {
    this.broadcast({
      type: 'complete',
      projectId,
      sessionId,
      message: 'Workspace creation complete! 🎉'
    }, projectId);
  }

  broadcastPlanFailed(projectId: string | number, sessionId: string, error: string) {
    this.broadcast({
      type: 'error',
      projectId,
      sessionId,
      message: error
    }, projectId);
  }

  broadcastAgentMessage(projectId: string | number, sessionId: string, content: string, messageType?: string) {
    this.broadcast({
      type: 'agent_message',
      projectId,
      sessionId,
      content,
      messageType
    }, projectId);
  }

  /**
   * Broadcast degraded mode notification to ALL connected clients
   * Called when a circuit breaker opens or provider fallback occurs
   */
  broadcastDegradedMode(data: {
    provider: string;
    status: 'circuit_open' | 'fallback_activated' | 'recovered';
    fallbackProvider?: string;
    message: string;
    estimatedRecovery?: Date;
  }) {
    const notification = {
      type: 'degraded_mode',
      ...data,
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(notification);
    let sentCount = 0;

    // Broadcast to ALL active connections
    this.connections.forEach((devices, connectionKey) => {
      devices.forEach((device) => {
        if (device.ws.readyState === WebSocket.OPEN) {
          device.ws.send(messageStr);
          sentCount++;
        }
      });
    });

    logger.info(`[Agent WebSocket] Broadcasted degraded mode (${data.status}) to ${sentCount} client(s): ${data.message}`);
  }

  /**
   * Broadcast provider health status update to all clients
   */
  broadcastProviderHealth(providers: Array<{
    provider: string;
    status: 'healthy' | 'degraded' | 'circuit_open' | 'unavailable';
    canAcceptRequests: boolean;
    errorRate?: number;
  }>) {
    const notification = {
      type: 'provider_health',
      providers,
      timestamp: new Date().toISOString()
    };

    const messageStr = JSON.stringify(notification);
    let sentCount = 0;

    this.connections.forEach((devices) => {
      devices.forEach((device) => {
        if (device.ws.readyState === WebSocket.OPEN) {
          device.ws.send(messageStr);
          sentCount++;
        }
      });
    });

    logger.debug(`[Agent WebSocket] Broadcasted provider health to ${sentCount} client(s)`);
  }
}

export const agentWebSocketService = new AgentWebSocketService();