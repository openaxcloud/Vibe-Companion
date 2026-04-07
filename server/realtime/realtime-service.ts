// @ts-nocheck
import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';

const logger = createLogger('realtime-service');

export interface RealtimeEvent {
  type: 'file-update' | 'file-create' | 'file-delete' | 'build-log' | 'deploy-log' | 'terminal-output' | 'preview-update' | 'collaboration' | 'notification';
  projectId: string;
  data: any;
  timestamp: Date;
  userId?: number;
}

export class RealtimeService {
  private io: SocketServer;
  private projectRooms = new Map<string, Set<string>>(); // projectId -> Set of socket IDs
  private userSockets = new Map<number, Set<string>>(); // userId -> Set of socket IDs
  
  constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : '*',
        credentials: true
      },
      path: '/ws/realtime'
    });
    
    this.setupSocketHandlers();
    logger.info('Realtime service initialized');
  }
  
  private setupSocketHandlers() {
    this.io.use(async (socket: Socket, next: (err?: any) => void) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }
        
        // Verify JWT token - SECURITY: Use centralized secrets manager
        const { getJwtSecret } = await import('../utils/secrets-manager');
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        socket.data.userId = decoded.userId;
        socket.data.projectId = socket.handshake.query.projectId;
        
        next();
      } catch (error) {
        next(new Error('Invalid authentication'));
      }
    });
    
    this.io.on('connection', async (socket: Socket) => {
      const userId = socket.data.userId;
      const projectId = (socket.data.projectId || '').toString();
      
      logger.info(`User ${userId} connected to project ${projectId}`);
      
      // Add to user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);
      
      // Join project room if specified
      if (projectId) {
        socket.join(`project:${projectId}`);
        if (!this.projectRooms.has(projectId)) {
          this.projectRooms.set(projectId, new Set());
        }
        this.projectRooms.get(projectId)!.add(socket.id);

        // Send initial project state
        await this.sendProjectState(socket, projectId);
      }
      
      // Handle real-time events
      socket.on('file:change', async (data: any) => {
        await this.handleFileChange(socket, data);
      });
      
      socket.on('terminal:input', async (data: any) => {
        await this.handleTerminalInput(socket, data);
      });
      
      socket.on('build:subscribe', async (buildId: string) => {
        socket.join(`build:${buildId}`);
      });
      
      socket.on('deploy:subscribe', async (deploymentId: string) => {
        socket.join(`deployment:${deploymentId}`);
      });
      
      socket.on('preview:request-update', async (data: any) => {
        await this.handlePreviewUpdate(socket, data);
      });
      
      socket.on('collaboration:cursor', async (data: any) => {
        await this.handleCollaborationCursor(socket, data);
      });
      
      socket.on('disconnect', () => {
        // Clean up
        const userId = socket.data.userId;
        const projectId = (socket.data.projectId || '').toString();
        
        if (userId && this.userSockets.has(userId)) {
          this.userSockets.get(userId)!.delete(socket.id);
          if (this.userSockets.get(userId)!.size === 0) {
            this.userSockets.delete(userId);
          }
        }
        
        if (projectId && this.projectRooms.has(projectId)) {
          this.projectRooms.get(projectId)!.delete(socket.id);
          if (this.projectRooms.get(projectId)!.size === 0) {
            this.projectRooms.delete(projectId);
          }
        }
        
        logger.info(`User ${userId} disconnected`);
      });
    });
  }
  
  private async sendProjectState(socket: Socket, projectId: string) {
    try {
      // Send current project files
      const files = await storage.getFilesByProjectId(projectId);
      socket.emit('project:state', {
        files,
        projectId,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Error sending project state:', error);
    }
  }
  
  private async handleFileChange(socket: Socket, data: any) {
    const { projectId, fileId, content, path } = data;
    
    try {
      // Broadcast to all other users in the project
      socket.to(`project:${projectId}`).emit('file:updated', {
        fileId,
        content,
        path,
        userId: socket.data.userId,
        timestamp: new Date()
      });
      
      // Also send to preview service for hot reload
      this.broadcastPreviewUpdate(projectId, { type: 'file-change', path });
    } catch (error) {
      logger.error('Error handling file change:', error);
    }
  }
  
  private async handleTerminalInput(socket: Socket, data: any) {
    const { projectId, sessionId, input } = data;
    
    // Broadcast to terminal service
    socket.to(`terminal:${projectId}:${sessionId}`).emit('terminal:input', {
      input,
      userId: socket.data.userId,
      timestamp: new Date()
    });
  }
  
  private async handlePreviewUpdate(socket: Socket, data: any) {
    const { projectId, type } = data;
    
    this.broadcastPreviewUpdate(projectId, { type, timestamp: new Date() });
  }
  
  private async handleCollaborationCursor(socket: Socket, data: any) {
    const { projectId, fileId, cursor, selection } = data;
    
    socket.to(`project:${projectId}`).emit('collaboration:cursor-update', {
      userId: socket.data.userId,
      fileId,
      cursor,
      selection,
      timestamp: new Date()
    });
  }
  
  // Public methods for broadcasting events from other services
  
  public broadcastFileUpdate(projectId: number, event: any) {
    this.io.to(`project:${projectId}`).emit('file:updated', {
      ...event,
      timestamp: new Date()
    });
  }
  
  public broadcastFileCreate(projectId: number, event: any) {
    this.io.to(`project:${projectId}`).emit('file:created', {
      ...event,
      timestamp: new Date()
    });
  }
  
  public broadcastFileDelete(projectId: number, event: any) {
    this.io.to(`project:${projectId}`).emit('file:deleted', {
      ...event,
      timestamp: new Date()
    });
  }
  
  public broadcastBuildLog(buildId: string, log: string) {
    this.io.to(`build:${buildId}`).emit('build:log', {
      log,
      timestamp: new Date()
    });
  }
  
  public broadcastBuildStatus(buildId: string, status: string) {
    this.io.to(`build:${buildId}`).emit('build:status', {
      status,
      timestamp: new Date()
    });
  }
  
  public broadcastDeployLog(deploymentId: string, log: string) {
    this.io.to(`deployment:${deploymentId}`).emit('deploy:log', {
      log,
      timestamp: new Date()
    });
  }
  
  public broadcastDeployStatus(deploymentId: string, status: string) {
    this.io.to(`deployment:${deploymentId}`).emit('deploy:status', {
      status,
      timestamp: new Date()
    });
  }
  
  public broadcastTerminalOutput(projectId: number, sessionId: string, output: string) {
    this.io.to(`terminal:${projectId}:${sessionId}`).emit('terminal:output', {
      output,
      timestamp: new Date()
    });
  }
  
  public broadcastPreviewUpdate(projectId: number, data: any) {
    this.io.to(`project:${projectId}`).emit('preview:update', {
      ...data,
      timestamp: new Date()
    });
  }
  
  public broadcastNotification(userId: number, notification: any) {
    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.forEach(socketId => {
        this.io.to(socketId).emit('notification', {
          ...notification,
          timestamp: new Date()
        });
      });
    }
  }
  
  public getActiveUsersInProject(projectId: number): number {
    return this.projectRooms.get(projectId)?.size || 0;
  }
  
  public getActiveProjects(): number[] {
    return Array.from(this.projectRooms.keys());
  }
}

let realtimeService: RealtimeService;

export function initializeRealtimeService(server: HttpServer) {
  realtimeService = new RealtimeService(server);
  return realtimeService;
}

export function getRealtimeService(): RealtimeService {
  if (!realtimeService) {
    throw new Error('Realtime service not initialized');
  }
  return realtimeService;
}