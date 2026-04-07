import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { storage } from '../storage';
import { spawn } from 'child_process';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';
import { wsMetrics } from './ws-metrics';

const logger = createLogger('mobile-websocket');

// Configuration from environment
const PING_INTERVAL_MS = parseInt(process.env.WS_PING_INTERVAL_MS || '25000', 10);
const PING_TIMEOUT_MS = parseInt(process.env.WS_PING_TIMEOUT_MS || '30000', 10);
const MAX_CONNECTIONS_PER_USER = parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || '5', 10);

// CORS allowlist - default to strict origins, can be overridden via env
const CORS_ORIGINS = process.env.WS_CORS_ORIGINS 
  ? process.env.WS_CORS_ORIGINS.split(',').map(s => s.trim())
  : [
      'http://localhost:5000',
      'http://localhost:3000',
      'https://localhost:5000',
      process.env.FRONTEND_URL || 'http://localhost:5000'
    ].filter(Boolean);

// Track connections per user
const userConnectionCounts = new Map<string, number>();

export class MobileWebSocketService {
  private io: Server;
  private terminalSessions: Map<string, any> = new Map();
  private aiSessions: Map<string, any> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl)
          if (!origin) return callback(null, true);
          
          // Check against allowlist
          if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes('*')) {
            return callback(null, true);
          }
          
          // In development, allow localhost variants
          if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
            return callback(null, true);
          }
          
          logger.warn(`CORS blocked origin: ${origin}`);
          return callback(new Error('Not allowed by CORS'), false);
        },
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingInterval: PING_INTERVAL_MS,
      pingTimeout: PING_TIMEOUT_MS,
      connectTimeout: PING_TIMEOUT_MS
    });

    this.setupNamespaces();
    logger.info(`Mobile WebSocket service initialized with CORS origins: ${CORS_ORIGINS.join(', ')}`);
  }

  private setupNamespaces() {
    const jwtAuthMiddleware = async (socket: any, next: (err?: Error) => void) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
          logger.warn('Connection attempt without token');
          return next(new Error('Authentication token required'));
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET not configured'); })() : 'dev-secret')) as { userId: number };
        const user = await storage.getUser(String(decoded.userId));
        if (!user) {
          logger.warn(`User ${decoded.userId} not found`);
          return next(new Error('User not found'));
        }
        
        // Check connection limit
        const userId = String(user.id);
        const currentCount = userConnectionCounts.get(userId) || 0;
        if (currentCount >= MAX_CONNECTIONS_PER_USER) {
          logger.warn(`User ${userId} exceeded max connections (${MAX_CONNECTIONS_PER_USER})`);
          return next(new Error('Maximum connections exceeded'));
        }
        
        // Track connection
        userConnectionCounts.set(userId, currentCount + 1);
        wsMetrics.recordConnection('mobile');
        
        socket.userId = user.id;
        socket.username = user.username;
        logger.info(`User ${user.id} authenticated, connections: ${currentCount + 1}/${MAX_CONNECTIONS_PER_USER}`);
        next();
      } catch (error) {
        logger.error('Auth middleware error:', error);
        next(new Error('Invalid or expired token'));
      }
    };
    
    const handleDisconnect = (socket: any, namespace: string) => {
      const userId = String(socket.userId);
      const currentCount = userConnectionCounts.get(userId) || 1;
      if (currentCount <= 1) {
        userConnectionCounts.delete(userId);
      } else {
        userConnectionCounts.set(userId, currentCount - 1);
      }
      wsMetrics.recordDisconnection('mobile');
      logger.info(`User ${userId} disconnected from ${namespace}`);
    };

    // Terminal WebSocket namespace with JWT auth
    const terminalNs = this.io.of('/terminal');
    terminalNs.use(jwtAuthMiddleware);
    terminalNs.on('connection', (socket) => {
      socket.on('command', async (data) => {
        // SECURITY: Validate message payload
        if (!data || typeof data !== 'object') {
          socket.emit('error', { message: 'Invalid message format' });
          return;
        }
        
        const { command, projectId } = data;
        
        // SECURITY: Validate required fields
        if (typeof command !== 'string' || typeof projectId !== 'string') {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // SECURITY: Block path traversal in projectId
        if (projectId.includes('..')) {
          socket.emit('error', { message: 'Invalid projectId' });
          return;
        }
        
        try {
          wsMetrics.recordMessageReceived('mobile-terminal');
          const result = await this.executeCommand(command, projectId);
          socket.emit('output', { text: result.stdout || result.stderr });
          wsMetrics.recordMessageSent('mobile-terminal');
        } catch (error: any) {
          logger.error('Command execution error:', error);
          wsMetrics.recordError('mobile-terminal');
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
        this.terminalSessions.delete(socket.id);
        handleDisconnect(socket, 'terminal');
      });
    });

    // AI Assistant WebSocket namespace with JWT auth
    const aiNs = this.io.of('/ai');
    aiNs.use(jwtAuthMiddleware);
    aiNs.on('connection', (socket) => {
      socket.on('message', async (data) => {
        // SECURITY: Validate message payload
        if (!data || typeof data !== 'object') {
          socket.emit('error', { message: 'Invalid message format' });
          return;
        }
        
        const { message, projectId } = data;
        
        // SECURITY: Validate required fields
        if (typeof message !== 'string') {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // SECURITY: Block path traversal in projectId
        if (projectId && projectId.includes('..')) {
          socket.emit('error', { message: 'Invalid projectId' });
          return;
        }
        
        wsMetrics.recordMessageReceived('mobile-ai');
        
        socket.emit('ai-streaming', { chunk: 'I understand you need help with ' });
        
        setTimeout(() => {
          socket.emit('ai-streaming', { chunk: 'your ' + data.message + '. ' });
        }, 100);
        
        setTimeout(() => {
          socket.emit('ai-streaming', { chunk: 'Here\'s what I suggest: ' });
        }, 200);
        
        setTimeout(() => {
          const response = this.generateAIResponse(message);
          socket.emit('ai-response', { text: response });
          wsMetrics.recordMessageSent('mobile-ai');
        }, 500);
      });

      socket.on('disconnect', () => {
        this.aiSessions.delete(socket.id);
        handleDisconnect(socket, 'ai');
      });
    });

    // Real-time collaboration namespace with JWT auth
    const collaborationNs = this.io.of('/collaboration');
    collaborationNs.use(jwtAuthMiddleware);
    collaborationNs.on('connection', (socket) => {
      socket.on('join-project', (projectId) => {
        // SECURITY: Validate projectId
        if (typeof projectId !== 'string' || projectId.includes('..')) {
          socket.emit('error', { message: 'Invalid projectId' });
          return;
        }
        socket.join(`project-${projectId}`);
        socket.to(`project-${projectId}`).emit('user-joined', { userId: (socket as any).userId });
        wsMetrics.recordMessageReceived('mobile-collaboration');
      });

      socket.on('code-change', (data) => {
        // SECURITY: Validate payload
        if (!data || typeof data !== 'object' || !data.projectId) {
          socket.emit('error', { message: 'Invalid message format' });
          return;
        }
        // SECURITY: Block path traversal
        if (String(data.projectId).includes('..')) {
          socket.emit('error', { message: 'Invalid projectId' });
          return;
        }
        socket.to(`project-${data.projectId}`).emit('code-update', data);
        wsMetrics.recordMessageSent('mobile-collaboration');
      });

      socket.on('cursor-move', (data) => {
        // SECURITY: Validate payload
        if (!data || typeof data !== 'object' || !data.projectId) {
          return;
        }
        // SECURITY: Block path traversal
        if (String(data.projectId).includes('..')) {
          return;
        }
        socket.to(`project-${data.projectId}`).emit('cursor-update', data);
      });

      socket.on('disconnect', () => {
        handleDisconnect(socket, 'collaboration');
      });
    });
  }
  
  public shutdown(): void {
    logger.info('Shutting down mobile WebSocket service...');
    this.io.close(() => {
      logger.info('Mobile WebSocket service shut down');
    });
  }

  private async executeCommand(command: string, projectId: string): Promise<any> {
    const safeCommands = ['ls', 'pwd', 'echo', 'cat', 'node', 'npm'];
    const [cmd, ...args] = command.split(' ');
    
    if (!safeCommands.includes(cmd)) {
      return { stderr: `Command not allowed: ${cmd}` };
    }

    return new Promise((resolve) => {
      const child = spawn(cmd, args, {
        cwd: `/tmp/projects/${projectId}`,
        shell: false,
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', () => {
        resolve({ stdout, stderr });
      });

      child.on('error', (error: any) => {
        resolve({ stderr: error.message });
      });
    });
  }

  private generateAIResponse(message: string): string {
    // Simplified AI response generation
    const responses = {
      'debug': 'To debug your code, try adding console.log statements at key points to track variable values.',
      'error': 'Check the error message carefully. It usually indicates the line number and type of error.',
      'optimize': 'Consider using memoization, caching, or more efficient algorithms to optimize performance.',
      'test': 'Write unit tests for each function, covering both normal cases and edge cases.',
      'default': 'I can help you with coding questions, debugging, optimization, and best practices.'
    };

    const keyword = Object.keys(responses).find(k => message.toLowerCase().includes(k)) as keyof typeof responses | undefined;
    return keyword ? responses[keyword] : responses.default;
  }
}

export function initializeMobileWebSocket(httpServer: HttpServer) {
  return new MobileWebSocketService(httpServer);
}