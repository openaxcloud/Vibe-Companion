/**
 * Realtime Collaboration Server
 * ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Migrated to Central Upgrade Dispatcher
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { storage } from '../storage';
import { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';
import { wsMetrics, generateDeterministicColor } from '../websocket/ws-metrics';

const logger = createLogger('collaboration-server');

// Configuration from environment
const PING_INTERVAL_MS = parseInt(process.env.WS_PING_INTERVAL_MS || '30000', 10);
const MAX_CONNECTIONS_PER_USER = parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || '5', 10);
const PARTICIPANT_SYNC_INTERVAL_MS = parseInt(process.env.WS_PARTICIPANT_SYNC_INTERVAL_MS || '60000', 10);

// Track connections per user
const userConnectionCounts = new Map<string, number>();

interface CollaborationClient {
  ws: WebSocket;
  userId: number;
  username: string;
  projectId: number;
  fileId?: number;
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

interface CollaborationMessage {
  type: string;
  userId?: number;
  username?: string;
  projectId?: number;
  fileId?: number;
  data: any;
  timestamp: number;
}

// W-H4: Rate limiting utility for per-client throttling
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

// W-H16: Simple mutex for Yjs operations
const yjsLocks = new Map<string, Promise<void>>();

async function withYjsLock<T>(fileKey: string, fn: () => Promise<T> | T): Promise<T> {
  while (yjsLocks.has(fileKey)) {
    await yjsLocks.get(fileKey);
  }
  let resolve: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  yjsLocks.set(fileKey, promise);
  try {
    return await fn();
  } finally {
    yjsLocks.delete(fileKey);
    resolve!();
  }
}

export class CollaborationServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, CollaborationClient> = new Map();
  private projectClients: Map<number, Set<WebSocket>> = new Map();
  private fileClients: Map<string, Set<WebSocket>> = new Map();
  private yjsDocs: Map<string, Y.Doc> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private participantSyncInterval: NodeJS.Timeout | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private pendingSaves: Map<string, boolean> = new Map();

  initialize(server: Server) {
    // ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Use Central Upgrade Dispatcher
    // Use noServer mode and register with central dispatcher to eliminate race conditions
    // W-H12: Add maxPayload to prevent DoS via large messages
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });

    // Register /ws/collaboration handler with central dispatcher (priority 63)
    // Note: Socket.IO also uses /ws/collaboration in unified-collaboration-service.ts
    // This registration provides backup WebSocket support for direct ws connections
    centralUpgradeDispatcher.register(
      '/ws/collaboration',
      this.handleUpgrade.bind(this),
      { pathMatch: 'prefix', priority: 63 }
    );

    // Ping clients at configurable interval to keep connections alive
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, PING_INTERVAL_MS);
    
    // Periodic participant list sync
    this.participantSyncInterval = setInterval(() => {
      this.syncAllParticipants();
    }, PARTICIPANT_SYNC_INTERVAL_MS);
    
    // Auto-save Yjs documents every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.autoSaveAllDocuments();
    }, 30000);
    
    logger.info('[Realtime CollaborationServer] Initialized (using central dispatcher)');
  }
  
  private syncAllParticipants(): void {
    this.projectClients.forEach((wsSet, projectId) => {
      const users = this.getProjectUsers(projectId);
      wsSet.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          this.send(ws, {
            type: 'participant_sync',
            users,
            timestamp: Date.now()
          });
        }
      });
    });
  }
  
  /**
   * Handle /ws/collaboration WebSocket upgrade via central dispatcher
   */
  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (!this.wss) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }
    
    // Mark socket as handled before upgrade
    markSocketAsHandled(request, socket);
    
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleConnection(ws, request);
    });
  }

  private handleConnection(ws: WebSocket, req: any) {
    wsMetrics.recordConnection('collaboration');
    
    // Initialize client info
    const clientInfo: CollaborationClient = {
      ws,
      userId: 0,
      username: '',
      projectId: 0
    };

    this.clients.set(ws, clientInfo);

    ws.on('message', async (message: Buffer) => {
      try {
        wsMetrics.recordMessageReceived('collaboration', message.length);
        const data = JSON.parse(message.toString()) as CollaborationMessage;
        // W-H13: Validate message schema
        if (!validateMessage(data)) {
          this.send(ws, {
            type: 'error',
            error: 'Invalid message schema',
            timestamp: Date.now()
          });
          return;
        }
        await this.handleMessage(ws, data);
      } catch (error) {
        logger.error('Failed to handle collaboration message:', error);
        wsMetrics.recordError('collaboration');
        // W-H17: Send error response to client
        this.send(ws, {
          type: 'error',
          error: 'Failed to process message',
          timestamp: Date.now()
        });
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      logger.info(`Collaboration WS closed with code ${code}, reason: ${reason?.toString() || 'none'}`);
      wsMetrics.recordDisconnection('collaboration');
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      wsMetrics.recordError('collaboration');
      this.handleDisconnection(ws);
    });

    ws.on('pong', () => {
      // Client is alive
    });
  }

  private async handleMessage(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    // W-H4: 100ms throttle on all messages to prevent DoS (except auth)
    if (message.type !== 'auth' && client.userId) {
      if (isThrottled(String(client.userId), message.type, 100)) {
        return;
      }
    }

    switch (message.type) {
      case 'auth':
        await this.handleAuth(ws, message);
        break;

      case 'join_project':
        await this.handleJoinProject(ws, message);
        break;

      case 'leave_project':
        this.handleLeaveProject(ws);
        break;

      case 'join_file':
        await this.handleJoinFile(ws, message);
        break;

      case 'leave_file':
        this.handleLeaveFile(ws);
        break;

      case 'cursor_update':
        this.handleCursorUpdate(ws, message);
        break;

      case 'selection_update':
        this.handleSelectionUpdate(ws, message);
        break;

      case 'code_change':
        await this.handleCodeChange(ws, message);
        break;

      case 'yjs_update':
        await this.handleYjsUpdate(ws, message);
        break;

      case 'request_users':
        this.handleRequestUsers(ws);
        break;

      case 'chat_message':
        this.handleChatMessage(ws, message);
        break;

      case 'request_sync':
        await this.handleRequestSync(ws, message);
        break;

      default:
        logger.warn('[CollaborationServer] Unknown message type:', message.type);
    }
  }

  private async handleAuth(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    if (!message.data?.token) {
      this.send(ws, {
        type: 'auth_failed',
        error: 'Authentication token required',
        timestamp: Date.now()
      });
      ws.close(1008, 'Authentication token required');
      return;
    }

    let decoded: { userId: number };
    try {
      decoded = jwt.verify(message.data.token, process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET not configured'); })() : 'dev-secret')) as { userId: number };
    } catch (jwtError) {
      logger.error('[CollaborationServer] JWT verification failed:', jwtError);
      this.send(ws, {
        type: 'auth_failed',
        error: 'Invalid or expired token',
        timestamp: Date.now()
      });
      ws.close(1008, 'Invalid token');
      return;
    }

    const user = await storage.getUser(decoded.userId);
    if (!user) {
      this.send(ws, {
        type: 'auth_failed',
        error: 'User not found',
        timestamp: Date.now()
      });
      ws.close(1008, 'Invalid user');
      return;
    }
    
    const userId = String(user.id);
    
    // Check connection limit per user
    const currentCount = userConnectionCounts.get(userId) || 0;
    if (currentCount >= MAX_CONNECTIONS_PER_USER) {
      logger.warn(`User ${userId} exceeded max connections (${MAX_CONNECTIONS_PER_USER})`);
      this.send(ws, {
        type: 'auth_failed',
        error: 'Maximum connections exceeded',
        timestamp: Date.now()
      });
      ws.close(4004, 'Maximum connections exceeded');
      return;
    }
    
    // Track connection count
    userConnectionCounts.set(userId, currentCount + 1);

    // Update client info with verified user data
    client.userId = user.id;
    client.username = user.username;
    
    logger.info(`User ${userId} authenticated, connections: ${currentCount + 1}/${MAX_CONNECTIONS_PER_USER}`);

    // Send auth success with deterministic color
    this.send(ws, {
      type: 'auth_success',
      userId: user.id,
      username: user.username,
      color: generateDeterministicColor(userId),
      timestamp: Date.now()
    });
  }

  private async handleJoinProject(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.userId) return;

    const projectId = message.projectId!;

    // Verify user has access to project
    const project = await storage.getProject(projectId);
    if (!project) {
      this.send(ws, {
        type: 'error',
        error: 'Project not found',
        timestamp: Date.now()
      });
      return;
    }

    const hasAccess = project.ownerId === client.userId ||
      await storage.isProjectCollaborator(projectId, client.userId);

    if (!hasAccess) {
      this.send(ws, {
        type: 'error',
        error: 'Access denied',
        timestamp: Date.now()
      });
      return;
    }

    // Leave current project if any
    this.handleLeaveProject(ws);

    // Join new project
    client.projectId = projectId;

    // Add to project clients
    if (!this.projectClients.has(projectId)) {
      this.projectClients.set(projectId, new Set());
    }
    this.projectClients.get(projectId)!.add(ws);

    // Notify others in project
    this.broadcastToProject(projectId, {
      type: 'user_joined',
      userId: client.userId,
      username: client.username,
      timestamp: Date.now()
    }, ws);

    // Send current users in project
    const projectUsers = this.getProjectUsers(projectId);
    this.send(ws, {
      type: 'project_users',
      users: projectUsers,
      timestamp: Date.now()
    });
  }

  private handleLeaveProject(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client || !client.projectId) return;

    const projectId = client.projectId;

    // Remove from project clients
    const projectWsSet = this.projectClients.get(projectId);
    if (projectWsSet) {
      projectWsSet.delete(ws);
      if (projectWsSet.size === 0) {
        this.projectClients.delete(projectId);
      }
    }

    // Leave file if in one
    this.handleLeaveFile(ws);

    // Notify others
    this.broadcastToProject(projectId, {
      type: 'user_left',
      userId: client.userId,
      username: client.username,
      timestamp: Date.now()
    }, ws);

    client.projectId = 0;
  }

  private async handleJoinFile(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.projectId) return;

    const fileId = message.fileId!;
    const fileKey = `${client.projectId}-${fileId}`;

    // Verify file exists and user has access
    const file = await storage.getFile(fileId);
    if (!file || file.projectId !== client.projectId) {
      this.send(ws, {
        type: 'error',
        error: 'File not found or access denied',
        timestamp: Date.now()
      });
      return;
    }

    // Leave current file if any
    this.handleLeaveFile(ws);

    // Join new file
    client.fileId = fileId;

    // Add to file clients
    if (!this.fileClients.has(fileKey)) {
      this.fileClients.set(fileKey, new Set());
    }
    this.fileClients.get(fileKey)!.add(ws);

    // Get or create Yjs document for file
    let yjsDoc = this.yjsDocs.get(fileKey);
    if (!yjsDoc) {
      yjsDoc = new Y.Doc();
      const yText = yjsDoc.getText('content');
      yText.insert(0, file.content || '');
      this.yjsDocs.set(fileKey, yjsDoc);
    }

    // Send current file state
    const state = Y.encodeStateAsUpdate(yjsDoc);
    this.send(ws, {
      type: 'file_state',
      fileId,
      state: Array.from(state),
      timestamp: Date.now()
    });

    // Notify others in file
    this.broadcastToFile(fileKey, {
      type: 'user_joined_file',
      userId: client.userId,
      username: client.username,
      fileId,
      timestamp: Date.now()
    }, ws);
  }

  private handleLeaveFile(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client || !client.fileId) return;

    const fileKey = `${client.projectId}-${client.fileId}`;

    // Remove from file clients
    const fileWsSet = this.fileClients.get(fileKey);
    if (fileWsSet) {
      fileWsSet.delete(ws);
      if (fileWsSet.size === 0) {
        this.fileClients.delete(fileKey);
        // Clean up Yjs document if no clients
        this.yjsDocs.delete(fileKey);
      }
    }

    // Notify others
    this.broadcastToFile(fileKey, {
      type: 'user_left_file',
      userId: client.userId,
      username: client.username,
      fileId: client.fileId,
      timestamp: Date.now()
    }, ws);

    client.fileId = undefined;
    client.cursor = undefined;
    client.selection = undefined;
  }

  private handleCursorUpdate(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.fileId) return;

    client.cursor = message.data.cursor;

    const fileKey = `${client.projectId}-${client.fileId}`;
    this.broadcastToFile(fileKey, {
      type: 'cursor_update',
      userId: client.userId,
      username: client.username,
      cursor: client.cursor,
      timestamp: Date.now()
    }, ws);
  }

  private handleSelectionUpdate(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.fileId) return;

    client.selection = message.data.selection;

    const fileKey = `${client.projectId}-${client.fileId}`;
    this.broadcastToFile(fileKey, {
      type: 'selection_update',
      userId: client.userId,
      username: client.username,
      selection: client.selection,
      timestamp: Date.now()
    }, ws);
  }

  private async handleCodeChange(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.fileId) return;

    const fileKey = `${client.projectId}-${client.fileId}`;
    
    // Broadcast change to other clients
    this.broadcastToFile(fileKey, {
      type: 'code_change',
      userId: client.userId,
      username: client.username,
      change: message.data.change,
      timestamp: Date.now()
    }, ws);

    // Update file content in database (debounced in practice)
    if (message.data.saveToDb) {
      await storage.updateFile(client.fileId, {
        content: message.data.content
      });
    }
  }

  private async handleYjsUpdate(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.fileId) return;

    const fileKey = `${client.projectId}-${client.fileId}`;
    const yjsDoc = this.yjsDocs.get(fileKey);
    if (!yjsDoc) return;

    // W-H16: Use mutex to handle Yjs race conditions
    await withYjsLock(fileKey, async () => {
      // Apply update to Yjs document
      const update = new Uint8Array(message.data.update);
      Y.applyUpdate(yjsDoc, update);

      // Broadcast update to other clients
      this.broadcastToFile(fileKey, {
        type: 'yjs_update',
        update: Array.from(update),
        timestamp: Date.now()
      }, ws);

      // Save to database periodically (debounced)
      if (message.data.saveToDb) {
        const yText = yjsDoc.getText('content');
        const content = yText.toString();
        await storage.updateFile(client.fileId!, { content });
      }
    });
  }

  private handleRequestUsers(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client || !client.projectId) return;

    const users = this.getProjectUsers(client.projectId);
    this.send(ws, {
      type: 'project_users',
      users,
      timestamp: Date.now()
    });
  }

  private handleChatMessage(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.projectId) return;

    this.broadcastToProject(client.projectId, {
      type: 'chat_message',
      userId: client.userId,
      username: client.username,
      message: message.data.message,
      timestamp: Date.now()
    });
  }

  private async handleRequestSync(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client || !client.fileId) return;

    const fileKey = `${client.projectId}-${client.fileId}`;
    const yjsDoc = this.yjsDocs.get(fileKey);
    if (!yjsDoc) return;

    const state = Y.encodeStateAsUpdate(yjsDoc);
    this.send(ws, {
      type: 'sync_response',
      state: Array.from(state),
      timestamp: Date.now()
    });
  }

  private handleDisconnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Update connection count
    if (client.userId) {
      const userId = String(client.userId);
      const currentCount = userConnectionCounts.get(userId) || 1;
      if (currentCount <= 1) {
        userConnectionCounts.delete(userId);
      } else {
        userConnectionCounts.set(userId, currentCount - 1);
      }
      
      // W-H7: Cleanup throttle tracking
      cleanupClientThrottles(userId);
    }

    // Leave project and file
    this.handleLeaveProject(ws);

    // Remove from clients
    this.clients.delete(ws);
  }
  
  // Auto-save all Yjs documents to database
  private async autoSaveAllDocuments(): Promise<void> {
    for (const [fileKey, yjsDoc] of this.yjsDocs.entries()) {
      // Skip if save is already pending
      if (this.pendingSaves.get(fileKey)) continue;
      
      try {
        const [projectId, fileIdStr] = fileKey.split('-');
        const fileId = parseInt(fileIdStr, 10);
        if (isNaN(fileId)) continue;
        
        this.pendingSaves.set(fileKey, true);
        
        await withYjsLock(fileKey, async () => {
          const yText = yjsDoc.getText('content');
          const content = yText.toString();
          if (content) {
            await storage.updateFile(fileId, { content });
            logger.debug(`[Collaboration] Auto-saved file ${fileId}`);
          }
        });
      } catch (error) {
        logger.error(`[Collaboration] Auto-save failed for ${fileKey}:`, error);
      } finally {
        this.pendingSaves.delete(fileKey);
      }
    }
  }
  
  public shutdown(): void {
    logger.info('Shutting down collaboration server...');
    
    // Clear intervals
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    if (this.participantSyncInterval) {
      clearInterval(this.participantSyncInterval);
    }
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    // Close all connections with proper code/reason
    this.clients.forEach((client, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.send(ws, { type: 'server_shutdown', timestamp: Date.now() });
        ws.close(1001, 'Server shutting down');
      }
    });
    
    if (this.wss) {
      this.wss.close();
    }
    
    logger.info('Collaboration server shut down');
  }

  private send(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private broadcastToProject(projectId: number, data: any, exclude?: WebSocket) {
    const projectWsSet = this.projectClients.get(projectId);
    if (!projectWsSet) return;

    projectWsSet.forEach(ws => {
      if (ws !== exclude) {
        this.send(ws, data);
      }
    });
  }

  private broadcastToFile(fileKey: string, data: any, exclude?: WebSocket) {
    const fileWsSet = this.fileClients.get(fileKey);
    if (!fileWsSet) return;

    fileWsSet.forEach(ws => {
      if (ws !== exclude) {
        this.send(ws, data);
      }
    });
  }

  private getProjectUsers(projectId: number): any[] {
    const users: any[] = [];
    const projectWsSet = this.projectClients.get(projectId);
    
    if (projectWsSet) {
      projectWsSet.forEach(ws => {
        const client = this.clients.get(ws);
        if (client) {
          users.push({
            userId: client.userId,
            username: client.username,
            fileId: client.fileId,
            cursor: client.cursor,
            selection: client.selection
          });
        }
      });
    }

    return users;
  }
}

export const collaborationServer = new CollaborationServer();