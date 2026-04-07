import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import type { Server } from 'http';
import jwt from 'jsonwebtoken';
import { checkpointRestoreService } from '../services/checkpoint-restore.service';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from '../storage';
import { centralUpgradeDispatcher } from './central-upgrade-dispatcher';
import { markSocketAsHandled } from './upgrade-guard';
import { getJwtSecret } from '../utils/secrets-manager';
import { wsMetrics } from './ws-metrics';
import { registerShutdownHandler } from './graceful-shutdown';

const logger = createLogger('checkpoint-ws');

const getSecret = () => getJwtSecret();

// Configuration from environment
const PING_INTERVAL_MS = parseInt(process.env.WS_PING_INTERVAL_MS || '30000', 10);
const MAX_CONNECTIONS_PER_USER = parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || '5', 10);

// Track connections per user
const userConnectionCounts = new Map<string, number>();

// W-H2: Rate limiting utility for per-client throttling
const clientThrottles = new Map<string, Map<string, number>>();

function isThrottled(clientId: string, action: string, intervalMs: number): boolean {
  const now = Date.now();
  if (!clientThrottles.has(clientId)) {
    clientThrottles.set(clientId, new Map());
  }
  const clientActions = clientThrottles.get(clientId)!;
  const lastTime = clientActions.get(action) || 0;
  if (now - lastTime < intervalMs) return true;
  clientActions.set(action, now);
  return false;
}

function cleanupClientThrottles(clientId: string): void {
  clientThrottles.delete(clientId);
}

// W-H13: Message validation helper
function validateMessage(msg: any): boolean {
  return typeof msg === 'object' && msg !== null && typeof msg.type === 'string';
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  subscribedProjects?: Set<number>;
  lastActivity?: Date;
}

const clients = new Map<number, Set<AuthenticatedWebSocket>>();
let pingInterval: NodeJS.Timeout | null = null;

async function handleAuth(ws: AuthenticatedWebSocket, data: any) {
  try {
    if (!data.token) {
      ws.send(JSON.stringify({
        type: 'auth-failed',
        message: 'Authentication token required',
        timestamp: new Date().toISOString()
      }));
      ws.close();
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(data.token, getSecret());
    } catch (jwtError) {
      logger.warn('JWT verification failed:', jwtError);
      ws.send(JSON.stringify({
        type: 'auth-failed',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString()
      }));
      ws.close();
      return;
    }

    const user = await storage.getUser(decoded.userId);
    if (!user) {
      logger.warn(`JWT valid but user ${decoded.userId} not found in database`);
      ws.send(JSON.stringify({
        type: 'auth-failed',
        message: 'User not found',
        timestamp: new Date().toISOString()
      }));
      ws.close();
      return;
    }

    const userId = String(user.id);
    
    // Check connection limit per user
    const currentCount = userConnectionCounts.get(userId) || 0;
    if (currentCount >= MAX_CONNECTIONS_PER_USER) {
      logger.warn(`User ${userId} exceeded max connections (${MAX_CONNECTIONS_PER_USER})`);
      ws.send(JSON.stringify({
        type: 'auth-failed',
        message: 'Maximum connections exceeded',
        timestamp: new Date().toISOString()
      }));
      ws.close(4004, 'Maximum connections exceeded');
      return;
    }
    
    // Track connection count
    userConnectionCounts.set(userId, currentCount + 1);
    wsMetrics.recordConnection('checkpoint');
    
    ws.userId = userId;
    ws.username = user.username;
    ws.subscribedProjects = new Set();
    ws.lastActivity = new Date();
    
    logger.info(`✅ Checkpoint WS: Client authenticated as user ${user.id} (${user.username}), connections: ${currentCount + 1}/${MAX_CONNECTIONS_PER_USER}`);
    
    ws.send(JSON.stringify({
      type: 'auth-success',
      data: {
        userId: user.id,
        username: user.username
      },
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Authentication error:', error);
    wsMetrics.recordError('checkpoint');
    ws.send(JSON.stringify({
      type: 'auth-failed',
      message: 'Authentication failed',
      timestamp: new Date().toISOString()
    }));
    ws.close(4000, 'Authentication failed');
  }
}

async function handleSubscribe(ws: AuthenticatedWebSocket, projectId: number) {
  try {
    if (!ws.userId) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not authenticated',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    const userIdNum = parseInt(ws.userId, 10);
    const [project] = await db.select()
      .from(projects)
      .where(and(
        eq(projects.id, projectId),
        eq(projects.ownerId, userIdNum)
      ))
      .limit(1);

    if (!project) {
      logger.warn(`⚠️ SECURITY: User ${ws.userId} attempted to subscribe to unauthorized project ${projectId}`);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Not authorized for this project',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    ws.subscribedProjects?.add(projectId);

    if (!clients.has(projectId)) {
      clients.set(projectId, new Set());
    }
    clients.get(projectId)!.add(ws);

    logger.info(`✅ Checkpoint WS: User ${ws.userId} subscribed to project ${projectId}`);
    
    ws.send(JSON.stringify({
      type: 'subscribed',
      projectId,
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Subscribe error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to subscribe',
      timestamp: new Date().toISOString()
    }));
  }
}

function handleUnsubscribe(ws: AuthenticatedWebSocket, projectId: number) {
  ws.subscribedProjects?.delete(projectId);
  clients.get(projectId)?.delete(ws);
  
  if (clients.get(projectId)?.size === 0) {
    clients.delete(projectId);
  }

  ws.send(JSON.stringify({
    type: 'unsubscribed',
    projectId,
    timestamp: new Date().toISOString()
  }));
}

function broadcastToProject(projectId: number, message: any) {
  const projectClients = clients.get(projectId);
  if (!projectClients) return;

  const messageStr = JSON.stringify(message);
  projectClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

export function setupCheckpointWebSocket(httpServer: Server) {
  // W-H10: Add maxPayload to prevent DoS via large messages
  const wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });

  centralUpgradeDispatcher.register('/ws/checkpoints', (request, socket, head) => {
    markSocketAsHandled(request, socket);
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
  
  // Start heartbeat/ping interval
  pingInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, PING_INTERVAL_MS);
  
  // Register shutdown handler
  registerShutdownHandler('checkpoint-ws', () => {
    logger.info('Shutting down checkpoint WebSocket service...');
    if (pingInterval) {
      clearInterval(pingInterval);
    }
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'server-shutdown', timestamp: new Date().toISOString() }));
        ws.close(1001, 'Server shutting down');
      }
    });
    wss.close();
    logger.info('Checkpoint WebSocket service shut down');
  }, 50);

  wss.on('connection', (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
    logger.info('[Checkpoint WS] New client connected');
    
    ws.subscribedProjects = new Set();
    ws.lastActivity = new Date();
    
    ws.on('pong', () => {
      ws.lastActivity = new Date();
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // SECURITY: Validate message schema before processing
        if (!validateMessage(message)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format',
            timestamp: new Date().toISOString()
          }));
          return;
        }

        switch (message.type) {
          case 'auth':
            await handleAuth(ws, message);
            break;

          case 'subscribe':
            if (typeof message.projectId === 'number') {
              // W-H2: 200ms throttle on subscriptions to prevent DoS
              if (ws.userId && isThrottled(ws.userId, 'subscribe', 200)) {
                ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Rate limit exceeded, please slow down',
                  timestamp: new Date().toISOString()
                }));
                break;
              }
              await handleSubscribe(ws, message.projectId);
            }
            break;

          case 'unsubscribe':
            if (typeof message.projectId === 'number') {
              handleUnsubscribe(ws, message.projectId);
            }
            break;

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
            break;

          default:
            logger.warn(`Unknown message type: ${message.type}`);
        }
      } catch (error) {
        logger.error('Error processing message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logger.info(`[Checkpoint WS] Client disconnected with code ${code}, reason: ${reason?.toString() || 'none'}`);
      wsMetrics.recordDisconnection('checkpoint');
      
      // Update connection count
      if (ws.userId) {
        const currentCount = userConnectionCounts.get(ws.userId) || 1;
        if (currentCount <= 1) {
          userConnectionCounts.delete(ws.userId);
        } else {
          userConnectionCounts.set(ws.userId, currentCount - 1);
        }
      }
      
      // W-H6: Proper cleanup on disconnect
      ws.subscribedProjects?.forEach(projectId => {
        clients.get(projectId)?.delete(ws);
        if (clients.get(projectId)?.size === 0) {
          clients.delete(projectId);
        }
      });
      // W-H6: Cleanup throttle tracking
      if (ws.userId) {
        cleanupClientThrottles(ws.userId);
      }
    });

    ws.on('error', (error) => {
      logger.error('[Checkpoint WS] WebSocket error:', error);
      wsMetrics.recordError('checkpoint');
      
      // Update connection count
      if (ws.userId) {
        const currentCount = userConnectionCounts.get(ws.userId) || 1;
        if (currentCount <= 1) {
          userConnectionCounts.delete(ws.userId);
        } else {
          userConnectionCounts.set(ws.userId, currentCount - 1);
        }
      }
      
      // W-H6: Cleanup on error path too
      ws.subscribedProjects?.forEach(projectId => {
        clients.get(projectId)?.delete(ws);
        if (clients.get(projectId)?.size === 0) {
          clients.delete(projectId);
        }
      });
      if (ws.userId) {
        cleanupClientThrottles(ws.userId);
      }
    });
  });

  checkpointRestoreService.on('restored', (event) => {
    logger.info(`[Checkpoint WS] Broadcasting restore event for project ${event.projectId}`);
    broadcastToProject(event.projectId, {
      type: 'checkpoint:restored',
      data: event,
      timestamp: new Date().toISOString()
    });
  });

  checkpointRestoreService.on('checkpoint_created', (event) => {
    logger.info(`[Checkpoint WS] Broadcasting checkpoint created for project ${event.projectId}`);
    broadcastToProject(event.projectId, {
      type: 'checkpoint:created',
      data: event,
      timestamp: new Date().toISOString()
    });
  });

  logger.info('[Checkpoint WS] ✅ WebSocket service initialized at /ws/checkpoints');

  return wss;
}
