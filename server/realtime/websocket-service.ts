// @ts-nocheck
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { storage } from '../storage';

export interface RealtimeMessage {
  type: 'cursor' | 'selection' | 'edit' | 'file' | 'terminal' | 'chat' | 'presence';
  projectId: number;
  userId: number;
  data: any;
  timestamp: Date;
}

export interface CollaborationSession {
  projectId: number;
  users: Map<number, {
    id: number;
    username: string;
    cursor?: { line: number; column: number };
    selection?: { start: { line: number; column: number }; end: { line: number; column: number } };
    color: string;
  }>;
  document?: any; // Yjs document
}

export class WebSocketService {
  private io: SocketIOServer;
  private sessions: Map<number, CollaborationSession> = new Map();
  private userSockets: Map<number, Set<string>> = new Map();

  private clientThrottles: Map<string, Map<string, number>> = new Map();
  private presenceTimestamps: Map<number, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly PRESENCE_TTL_MS = 60000;
  private readonly THROTTLE_TTL_MS = 300000;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://e-code.ai', 'https://www.e-code.ai']
          : ['http://localhost:5173', 'http://localhost:3000'],
        credentials: true,
      },
      path: '/socket.io',
      pingInterval: 25000,
      pingTimeout: 20000,
    });

    this.io.on('error', (error: Error) => {
      console.error('[WebSocketService] Socket.IO server error:', error);
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  private startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, actions] of this.clientThrottles.entries()) {
        let allExpired = true;
        for (const [action, timestamp] of actions.entries()) {
          if (now - timestamp > this.THROTTLE_TTL_MS) {
            actions.delete(action);
          } else {
            allExpired = false;
          }
        }
        if (allExpired || actions.size === 0) {
          this.clientThrottles.delete(clientId);
        }
      }
      
      for (const [userId, timestamp] of this.presenceTimestamps.entries()) {
        if (now - timestamp > this.PRESENCE_TTL_MS) {
          this.presenceTimestamps.delete(userId);
          this.sessions.forEach((session, projectId) => {
            if (session.users.has(userId)) {
              session.users.delete(userId);
              this.io.to(`project:${projectId}`).emit('user-left', { userId });
            }
          });
        }
      }
    }, 30000);
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // SECURITY: Use centralized secrets manager
        const { getJwtSecret } = await import('../utils/secrets-manager');
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        const user = await storage.getUser(decoded.userId);
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.data.user = user;
        next();
      } catch (error) {
        next(new Error('Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user;

      // Track user sockets and presence
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id)!.add(socket.id);
      this.presenceTimestamps.set(user.id, Date.now());

      socket.on('heartbeat', () => {
        this.presenceTimestamps.set(user.id, Date.now());
      });

      // Handle joining project collaboration
      socket.on('join-project', async (projectId: number) => {
        const project = await storage.getProject(projectId);
        if (!project) {
          socket.emit('error', 'Project not found');
          return;
        }

        // Check permissions
        const hasAccess = await this.checkProjectAccess(user.id, projectId);
        if (!hasAccess) {
          socket.emit('error', 'Access denied');
          return;
        }

        // Join project room
        socket.join(`project:${projectId}`);
        
        // Initialize or get session
        if (!this.sessions.has(projectId)) {
          this.sessions.set(projectId, {
            projectId,
            users: new Map(),
          });
        }

        const session = this.sessions.get(projectId)!;
        
        // Add user to session
        session.users.set(user.id, {
          id: user.id,
          username: user.username,
          color: this.generateUserColor(user.id),
        });

        // Notify others
        socket.to(`project:${projectId}`).emit('user-joined', {
          userId: user.id,
          username: user.username,
          color: session.users.get(user.id)!.color,
        });

        // Send current users
        socket.emit('current-users', Array.from(session.users.values()));
      });

      // Handle cursor movements
      socket.on('cursor-move', (data: { projectId: number; line: number; column: number }) => {
        const session = this.sessions.get(data.projectId);
        if (!session || !session.users.has(user.id)) return;

        session.users.get(user.id)!.cursor = { line: data.line, column: data.column };

        socket.to(`project:${data.projectId}`).emit('cursor-update', {
          userId: user.id,
          cursor: { line: data.line, column: data.column },
        });
      });

      // Handle text selection
      socket.on('selection-change', (data: { projectId: number; selection: any }) => {
        const session = this.sessions.get(data.projectId);
        if (!session || !session.users.has(user.id)) return;

        session.users.get(user.id)!.selection = data.selection;

        socket.to(`project:${data.projectId}`).emit('selection-update', {
          userId: user.id,
          selection: data.selection,
        });
      });

      // Handle code edits
      socket.on('code-edit', (data: { projectId: number; fileId: string; changes: any }) => {
        // Broadcast to all users in the project
        socket.to(`project:${data.projectId}`).emit('code-change', {
          userId: user.id,
          fileId: data.fileId,
          changes: data.changes,
        });

        // Save to storage (debounced in production)
        this.saveFileChanges(data.projectId, data.fileId, data.changes);
      });

      // Handle file operations
      socket.on('file-operation', (data: { projectId: number; operation: string; payload: any }) => {
        socket.to(`project:${data.projectId}`).emit('file-update', {
          userId: user.id,
          operation: data.operation,
          payload: data.payload,
        });
      });

      // Handle terminal output
      socket.on('terminal-output', (data: { projectId: number; output: string }) => {
        socket.to(`project:${data.projectId}`).emit('terminal-update', {
          userId: user.id,
          output: data.output,
        });
      });

      // Handle chat messages
      socket.on('chat-message', async (data: { projectId: number; message: string }) => {
        const message = {
          id: Date.now(),
          userId: user.id,
          username: user.username,
          message: data.message,
          timestamp: new Date(),
        };

        // Save to storage
        await this.saveChatMessage(data.projectId, message);

        // Broadcast to all users
        this.io.to(`project:${data.projectId}`).emit('chat-update', message);
      });

      // Handle leaving project
      socket.on('leave-project', (projectId: number) => {
        this.handleLeaveProject(socket, user.id, projectId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        // Remove socket from user's socket set
        this.userSockets.get(user.id)?.delete(socket.id);
        
        // If user has no more sockets, remove from all sessions
        if (this.userSockets.get(user.id)?.size === 0) {
          this.userSockets.delete(user.id);
          
          // Remove from all sessions
          this.sessions.forEach((session, projectId) => {
            if (session.users.has(user.id)) {
              session.users.delete(user.id);
              this.io.to(`project:${projectId}`).emit('user-left', {
                userId: user.id,
              });
            }
          });
        }
      });
    });
  }

  private async checkProjectAccess(userId: number, projectId: number): Promise<boolean> {
    // Check if user owns the project or has been granted access
    const project = await storage.getProject(projectId);
    if (!project) return false;
    
    // For now, allow if user owns the project
    // In production, check team membership, share permissions, etc.
    return project.userId === userId;
  }

  private generateUserColor(userId: number): string {
    const colors = [
      '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
      '#2196f3', '#00bcd4', '#009688', '#4caf50',
      '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107',
      '#ff9800', '#ff5722', '#795548', '#607d8b',
    ];
    return colors[userId % colors.length];
  }

  private handleLeaveProject(socket: Socket, userId: number, projectId: number) {
    socket.leave(`project:${projectId}`);
    
    const session = this.sessions.get(projectId);
    if (session && session.users.has(userId)) {
      session.users.delete(userId);
      
      socket.to(`project:${projectId}`).emit('user-left', {
        userId: userId,
      });
      
      // Clean up empty sessions
      if (session.users.size === 0) {
        this.sessions.delete(projectId);
      }
    }
  }

  private async saveFileChanges(projectId: number, fileId: string, changes: any) {
    // Implement file change saving logic
    // This would integrate with the file system service
    try {
      // await fileService.updateFile(projectId, fileId, changes);
    } catch (error) {
      console.error('Error saving file changes:', error);
    }
  }

  private async saveChatMessage(projectId: number, message: any) {
    // Implement chat message persistence
    try {
      // await storage.saveChatMessage(projectId, message);
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  }

  // Send real-time notification to specific user
  public sendNotification(userId: number, notification: any) {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.forEach(socketId => {
        this.io.to(socketId).emit('notification', notification);
      });
    }
  }

  // Broadcast deployment status update
  public broadcastDeploymentUpdate(projectId: number, status: any) {
    this.io.to(`project:${projectId}`).emit('deployment-update', status);
  }

  // Broadcast AI agent activity
  public broadcastAgentActivity(projectId: number, activity: any) {
    this.io.to(`project:${projectId}`).emit('agent-activity', activity);
  }
}

export let websocketService: WebSocketService;

export function initializeWebSocketService(httpServer: HTTPServer) {
  websocketService = new WebSocketService(httpServer);
  return websocketService;
}