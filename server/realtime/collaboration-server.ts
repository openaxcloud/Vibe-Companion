import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import { storage } from '../storage';
import { Server } from 'http';

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

export class CollaborationServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, CollaborationClient> = new Map();
  private projectClients: Map<number, Set<WebSocket>> = new Map();
  private fileClients: Map<string, Set<WebSocket>> = new Map();
  private yjsDocs: Map<string, Y.Doc> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/collaboration'
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      this.handleConnection(ws, req);
    });

    // Ping clients every 30 seconds to keep connections alive
    setInterval(() => {
      this.clients.forEach((client, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);
  }

  private handleConnection(ws: WebSocket, req: any) {
    console.log('New collaboration connection');

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
        const data = JSON.parse(message.toString()) as CollaborationMessage;
        await this.handleMessage(ws, data);
      } catch (error) {
        console.error('Failed to handle collaboration message:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnection(ws);
    });

    ws.on('pong', () => {
      // Client is alive
    });
  }

  private async handleMessage(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

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
        console.warn('Unknown message type:', message.type);
    }
  }

  private async handleAuth(ws: WebSocket, message: CollaborationMessage) {
    const client = this.clients.get(ws);
    if (!client) return;

    // Verify user access
    const userId = message.userId!;
    const user = await storage.getUser(userId);
    if (!user) {
      ws.close(1008, 'Invalid user');
      return;
    }

    // Update client info
    client.userId = userId;
    client.username = user.username;

    // Send auth success
    this.send(ws, {
      type: 'auth_success',
      userId,
      username: user.username,
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
      await storage.updateFile(client.fileId, { content });
    }
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

    // Leave project and file
    this.handleLeaveProject(ws);

    // Remove from clients
    this.clients.delete(ws);

    console.log(`User ${client.username} disconnected`);
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