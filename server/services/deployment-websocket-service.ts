// WebSocket service for real-time deployment progress updates
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import { Server } from 'http';
import { EventEmitter } from 'events';
import type { Duplex } from 'stream';
import { createLogger } from '../utils/logger';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { isOriginAllowed } from '../utils/origin-validation';

const logger = createLogger('deployment-websocket-service');

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
    logger.warn(`[Deployment WebSocket] Rate limit exceeded for IP: ${ip} (${tracking.count} connections in window)`);
    return { allowed: false, reason: 'Too many connection attempts' };
  }
  
  // Check active connections
  if (tracking.active >= WS_CONNECTION_LIMITS.maxActiveConnections) {
    logger.warn(`[Deployment WebSocket] Max active connections exceeded for IP: ${ip} (${tracking.active} active)`);
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

// Internal deployment status types (used by deployment-manager.ts)
export type DeploymentStatusType = 'pending' | 'building' | 'deploying' | 'active' | 'failed' | 'stopped';

// UI-friendly status types (used by frontend)
export type UIStatusType = 'idle' | 'publishing' | 'live' | 'failed' | 'needs-republish';

/**
 * Translates internal deployment status to UI-friendly status
 * Maps: pending|building|deploying → publishing
 *       active → live
 *       failed → failed
 *       stopped → idle
 */
export function translateStatusToUI(
  internalStatus: DeploymentStatusType,
  lastCodeChange?: Date | string | null,
  deployedAt?: Date | string | null
): UIStatusType {
  switch (internalStatus) {
    case 'pending':
    case 'building':
    case 'deploying':
      return 'publishing';
    case 'active':
      if (lastCodeChange && deployedAt) {
        const codeChangeTime = typeof lastCodeChange === 'string' ? new Date(lastCodeChange).getTime() : lastCodeChange.getTime();
        const deployedTime = typeof deployedAt === 'string' ? new Date(deployedAt).getTime() : deployedAt.getTime();
        if (codeChangeTime > deployedTime) {
          return 'needs-republish';
        }
      }
      return 'live';
    case 'failed':
      return 'failed';
    case 'stopped':
      return 'idle';
    default:
      return 'idle';
  }
}

/**
 * Translates UI-friendly status back to internal status (for backward compatibility)
 */
export function translateStatusFromUI(uiStatus: UIStatusType): DeploymentStatusType {
  switch (uiStatus) {
    case 'publishing':
      return 'deploying';
    case 'live':
      return 'active';
    case 'needs-republish':
      return 'active';
    case 'failed':
      return 'failed';
    case 'idle':
      return 'stopped';
    default:
      return 'stopped';
  }
}

// WebSocket message types
export interface DeploymentWebSocketMessage {
  type: 'status_change' | 'build_log' | 'deploy_log' | 'error' | 'subscribed' | 'unsubscribed' | 'heartbeat';
  deploymentId: string;
  data?: {
    status?: DeploymentStatusType;
    uiStatus?: UIStatusType;
    previousStatus?: DeploymentStatusType;
    previousUiStatus?: UIStatusType;
    log?: string;
    timestamp?: string;
    url?: string;
    error?: string;
  };
}

interface DeploymentConnection {
  ws: WebSocket;
  clientId: string;
  deploymentIds: Set<string>;
  connectedAt: Date;
  isAlive: boolean;
}

// EventEmitter events that DeploymentManager will emit
export interface DeploymentEvents {
  'status_change': (deploymentId: string, status: DeploymentStatusType, previousStatus: DeploymentStatusType) => void;
  'build_log': (deploymentId: string, log: string) => void;
  'deploy_log': (deploymentId: string, log: string) => void;
  'error': (deploymentId: string, error: string) => void;
}

class DeploymentWebSocketService extends EventEmitter {
  public wss: WebSocketServer | null = null;
  
  // Map: deploymentId -> Set of connections subscribed to that deployment
  private subscriptions = new Map<string, Set<DeploymentConnection>>();
  
  // Map: clientId -> connection (for cleanup)
  private connections = new Map<string, DeploymentConnection>();
  
  private pingInterval: NodeJS.Timeout | null = null;
  
  initialize(server: Server) {
    // Use noServer mode with prependListener for priority (same pattern as agent-websocket-service)
    this.wss = new WebSocketServer({ noServer: true });
    
    // Error handlers
    this.wss.on('error', (err: Error) => {
      console.error('[Deployment WebSocket] WebSocketServer ERROR:', err.message, err.stack);
    });
    
    this.wss.on('wsClientError', (err: Error, socket: any, request: any) => {
      console.error('[Deployment WebSocket] wsClientError:', err.message);
      console.error('[Deployment WebSocket] wsClientError URL:', request?.url);
    });
    
    // ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Use Central Upgrade Dispatcher
    // PROBLEM: Multiple upgrade listeners cause race conditions - "Invalid frame header" errors
    // SOLUTION: Register with central dispatcher that routes ALL upgrades through ONE handler
    // The dispatcher marks sockets BEFORE delegating, eliminating all race conditions
    centralUpgradeDispatcher.register(
      '/ws/deployments',
      (request: IncomingMessage, socket: Duplex, head: Buffer) => {
        this.handleDeploymentUpgrade(request, socket as Socket, head);
      },
      { pathMatch: 'exact', priority: 20 }
    );
    
    logger.info('[Deployment WebSocket] Service initialized with central upgrade dispatcher (priority: 20)');
    
    // Start heartbeat for connection health monitoring
    this.startHeartbeat();
    
    // Start periodic subscription validation
    this.startSubscriptionValidation();
    
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket?.remoteAddress || 'unknown';
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      logger.info(`[Deployment WebSocket] New connection: ${clientId} from ${clientIp}`);
      
      // Create connection object
      const connection: DeploymentConnection = {
        ws,
        clientId,
        deploymentIds: new Set(),
        connectedAt: new Date(),
        isAlive: true,
      };
      
      this.connections.set(clientId, connection);
      
      // Send initial connection confirmation
      this.sendToConnection(connection, {
        type: 'subscribed',
        deploymentId: '',
        data: {
          timestamp: new Date().toISOString(),
        },
      });
      
      // Handle incoming messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(connection, message);
        } catch (error) {
          logger.warn(`[Deployment WebSocket] Invalid message from ${clientId}: ${error}`);
        }
      });
      
      // Handle pong for heartbeat
      ws.on('pong', () => {
        connection.isAlive = true;
      });
      
      ws.on('error', (error) => {
        logger.error(`[Deployment WebSocket] WebSocket error for ${clientId}: ${error.message}`);
      });
      
      ws.on('close', (code, reason) => {
        // Decrement active connection count for rate limiting
        decrementActiveConnections(clientIp);
        
        // Clean up subscriptions
        this.cleanupConnection(connection);
        
        logger.info(`[Deployment WebSocket] Connection closed: ${clientId} (code: ${code})`);
      });
    });
    
    this.wss.on('error', (error) => {
      logger.error(`[Deployment WebSocket] Server error: ${error.message}`);
    });
  }
  
  /**
   * Handle the WebSocket upgrade for /ws/deployments
   * Called by the central dispatcher after path matching
   */
  private handleDeploymentUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void {
    // Mark socket as handled to prevent other handlers from interfering
    markSocketAsHandled(request, socket);
    
    // PRODUCTION SECURITY: Origin validation (prevents CSRF attacks)
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (process.env.NODE_ENV === 'production' && !isOriginAllowed(origin, host)) {
      logger.warn(`[Deployment WebSocket] Origin validation failed - origin: ${origin}, host: ${host}`);
      socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\nContent-Length: 14\r\n\r\nInvalid origin');
      socket.destroy();
      return;
    }
    
    // PRODUCTION SECURITY: Rate limiting (prevents connection flooding)
    const clientIp = request.socket?.remoteAddress || 'unknown';
    const rateLimitResult = checkWebSocketRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      logger.warn(`[Deployment WebSocket] Rate limit rejected - IP: ${clientIp}, reason: ${rateLimitResult.reason}`);
      socket.write('HTTP/1.1 429 Too Many Requests\r\nContent-Type: text/plain\r\nContent-Length: 22\r\n\r\nToo many connections');
      socket.destroy();
      return;
    }
    
    logger.info(`[Deployment WebSocket] Upgrade request from ${clientIp} via central dispatcher`);
    
    // Complete the WebSocket handshake
    this.wss!.handleUpgrade(request, socket, head, (ws) => {
      logger.info(`[Deployment WebSocket] Upgrade complete, emitting connection event`);
      this.wss!.emit('connection', ws, request);
    });
  }
  
  // Handle messages from clients (subscribe/unsubscribe)
  private handleClientMessage(connection: DeploymentConnection, message: any) {
    const { action, deploymentId } = message;
    
    if (!action || !deploymentId) {
      logger.warn(`[Deployment WebSocket] Invalid message format from ${connection.clientId}`);
      return;
    }
    
    switch (action) {
      case 'subscribe':
        this.subscribeToDeployment(connection, deploymentId);
        break;
        
      case 'unsubscribe':
        this.unsubscribeFromDeployment(connection, deploymentId);
        break;
        
      default:
        logger.warn(`[Deployment WebSocket] Unknown action: ${action} from ${connection.clientId}`);
    }
  }
  
  // Subscribe a connection to deployment updates
  private subscribeToDeployment(connection: DeploymentConnection, deploymentId: string) {
    // Add to connection's subscription list
    connection.deploymentIds.add(deploymentId);
    
    // Add to deployment's subscriber list
    if (!this.subscriptions.has(deploymentId)) {
      this.subscriptions.set(deploymentId, new Set());
    }
    this.subscriptions.get(deploymentId)!.add(connection);
    
    logger.info(`[Deployment WebSocket] ${connection.clientId} subscribed to deployment ${deploymentId}`);
    
    // Send confirmation
    this.sendToConnection(connection, {
      type: 'subscribed',
      deploymentId,
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Unsubscribe a connection from deployment updates
  private unsubscribeFromDeployment(connection: DeploymentConnection, deploymentId: string) {
    // Remove from connection's subscription list
    connection.deploymentIds.delete(deploymentId);
    
    // Remove from deployment's subscriber list
    const subscribers = this.subscriptions.get(deploymentId);
    if (subscribers) {
      subscribers.delete(connection);
      
      // Clean up empty subscription sets
      if (subscribers.size === 0) {
        this.subscriptions.delete(deploymentId);
      }
    }
    
    logger.info(`[Deployment WebSocket] ${connection.clientId} unsubscribed from deployment ${deploymentId}`);
    
    // Send confirmation
    this.sendToConnection(connection, {
      type: 'unsubscribed',
      deploymentId,
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Clean up connection when it closes
  private cleanupConnection(connection: DeploymentConnection) {
    // Remove from all deployment subscriptions
    for (const deploymentId of connection.deploymentIds) {
      const subscribers = this.subscriptions.get(deploymentId);
      if (subscribers) {
        subscribers.delete(connection);
        
        if (subscribers.size === 0) {
          this.subscriptions.delete(deploymentId);
        }
      }
    }
    
    // Remove from connections map
    this.connections.delete(connection.clientId);
    
    logger.debug(`[Deployment WebSocket] Cleaned up connection ${connection.clientId}`);
  }

  // Periodically validate subscriptions and remove stale ones
  private subscriptionValidationInterval: NodeJS.Timeout | null = null;
  
  private startSubscriptionValidation() {
    this.subscriptionValidationInterval = setInterval(() => {
      this.validateAllSubscriptions();
    }, 60000);
  }
  
  private validateAllSubscriptions() {
    let cleanedUp = 0;
    
    for (const [deploymentId, subscribers] of this.subscriptions.entries()) {
      for (const connection of subscribers) {
        if (connection.ws.readyState === WebSocket.CLOSED || 
            connection.ws.readyState === WebSocket.CLOSING) {
          subscribers.delete(connection);
          cleanedUp++;
        }
      }
      
      if (subscribers.size === 0) {
        this.subscriptions.delete(deploymentId);
      }
    }
    
    for (const [clientId, connection] of this.connections.entries()) {
      if (connection.ws.readyState === WebSocket.CLOSED || 
          connection.ws.readyState === WebSocket.CLOSING) {
        this.cleanupConnection(connection);
        cleanedUp++;
      }
    }
    
    if (cleanedUp > 0) {
      logger.info(`[Deployment WebSocket] Subscription validation cleaned up ${cleanedUp} stale entries`);
    }
  }
  
  // Heartbeat to detect stale connections
  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      this.connections.forEach((connection, clientId) => {
        // Check if connection is still alive
        if (connection.ws.readyState === WebSocket.CLOSED || connection.ws.readyState === WebSocket.CLOSING) {
          this.cleanupConnection(connection);
          logger.debug(`[Heartbeat] Removed stale connection ${clientId}`);
          return;
        }
        
        // For browser clients, just check readyState rather than sending manual pings
        // Browsers auto-handle ping/pong internally
        if (!connection.isAlive) {
          // Connection hasn't responded to previous ping
          logger.debug(`[Heartbeat] Connection ${clientId} appears stale, marking for removal`);
          connection.ws.terminate();
          this.cleanupConnection(connection);
          return;
        }
        
        // Mark as not alive until we receive pong
        connection.isAlive = false;
        
        // Send application-level heartbeat (instead of WebSocket ping which causes issues)
        this.sendToConnection(connection, {
          type: 'heartbeat',
          deploymentId: '',
          data: {
            timestamp: new Date().toISOString(),
          },
        });
      });
    }, 30000); // Every 30 seconds
  }
  
  // Send message to a specific connection
  private sendToConnection(connection: DeploymentConnection, message: DeploymentWebSocketMessage) {
    if (connection.ws.readyState === WebSocket.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error(`[Deployment WebSocket] Failed to send message to ${connection.clientId}: ${error}`);
      }
    }
  }
  
  // Broadcast to all subscribers of a deployment
  private broadcastToDeployment(deploymentId: string, message: DeploymentWebSocketMessage) {
    const subscribers = this.subscriptions.get(deploymentId);
    
    if (!subscribers || subscribers.size === 0) {
      logger.debug(`[Deployment WebSocket] No subscribers for deployment ${deploymentId}`);
      return;
    }
    
    const messageStr = JSON.stringify(message);
    let sentCount = 0;
    
    subscribers.forEach((connection) => {
      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(messageStr);
          sentCount++;
        } catch (error) {
          logger.error(`[Deployment WebSocket] Failed to broadcast to ${connection.clientId}: ${error}`);
        }
      }
    });
    
    logger.debug(`[Deployment WebSocket] Broadcasted ${message.type} to ${sentCount} subscribers for deployment ${deploymentId}`);
  }
  
  // ===== Public API for DeploymentManager to call =====
  
  // Broadcast status change to all subscribers with UI-friendly status translation
  broadcastStatusChange(deploymentId: string, status: DeploymentStatusType, previousStatus?: DeploymentStatusType, url?: string) {
    const uiStatus = translateStatusToUI(status);
    const previousUiStatus = previousStatus ? translateStatusToUI(previousStatus) : undefined;
    
    this.broadcastToDeployment(deploymentId, {
      type: 'status_change',
      deploymentId,
      data: {
        status,
        uiStatus,
        previousStatus,
        previousUiStatus,
        url,
        timestamp: new Date().toISOString(),
      },
    });
    
    // Also emit event for other services that might be listening
    this.emit('status_change', deploymentId, status, previousStatus);
  }
  
  // Broadcast build log entry
  broadcastBuildLog(deploymentId: string, log: string) {
    this.broadcastToDeployment(deploymentId, {
      type: 'build_log',
      deploymentId,
      data: {
        log,
        timestamp: new Date().toISOString(),
      },
    });
    
    this.emit('build_log', deploymentId, log);
  }
  
  // Broadcast deployment log entry
  broadcastDeployLog(deploymentId: string, log: string) {
    this.broadcastToDeployment(deploymentId, {
      type: 'deploy_log',
      deploymentId,
      data: {
        log,
        timestamp: new Date().toISOString(),
      },
    });
    
    this.emit('deploy_log', deploymentId, log);
  }
  
  // Broadcast error
  broadcastError(deploymentId: string, error: string) {
    this.broadcastToDeployment(deploymentId, {
      type: 'error',
      deploymentId,
      data: {
        error,
        timestamp: new Date().toISOString(),
      },
    });
    
    this.emit('error', deploymentId, error);
  }
  
  // Get connection stats (for monitoring)
  getStats() {
    return {
      totalConnections: this.connections.size,
      activeDeployments: this.subscriptions.size,
      subscriptionsByDeployment: Array.from(this.subscriptions.entries()).map(([id, subs]) => ({
        deploymentId: id,
        subscriberCount: subs.size,
      })),
    };
  }
  
  // Shutdown the service
  shutdown() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Close all connections
    this.connections.forEach((connection) => {
      try {
        connection.ws.close(1000, 'Server shutting down');
      } catch (error) {
        // Ignore errors during shutdown
      }
    });
    
    this.connections.clear();
    this.subscriptions.clear();
    
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    logger.info('[Deployment WebSocket] Service shut down');
  }
}

// Export singleton instance
export const deploymentWebSocketService = new DeploymentWebSocketService();
