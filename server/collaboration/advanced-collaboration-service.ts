// @ts-nocheck
import { Server as SocketIOServer } from 'socket.io';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

const logger = createLogger('advanced-collaboration');

interface CollaborationSession {
  id: string;
  projectId: number;
  userId: number;
  username: string;
  socketId: string;
  cursor: {
    line: number;
    column: number;
    selection?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
  };
  activeFile?: string;
  lastActivity: Date;
  color: string;
  status: 'active' | 'idle' | 'away';
}

interface CollaborationRoom {
  projectId: number;
  sessions: Map<string, CollaborationSession>;
  yDoc: Y.Doc;
  awareness: any;
  files: Map<string, Y.Text>;
  createdAt: Date;
  lastActivity: Date;
}

interface VoiceChannelSession {
  userId: number;
  username: string;
  socketId: string;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  roomId: string;
}

interface ScreenShareSession {
  userId: number;
  username: string;
  socketId: string;
  streamId: string;
  quality: 'low' | 'medium' | 'high';
  isSharing: boolean;
}

export class AdvancedCollaborationService {
  private io: SocketIOServer;
  private rooms: Map<number, CollaborationRoom> = new Map();
  private voiceChannels: Map<string, Map<number, VoiceChannelSession>> = new Map();
  private screenShares: Map<string, ScreenShareSession> = new Map();
  private userColors: string[] = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  private colorIndex = 0;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupSocketHandlers();
    this.startCleanupTimer();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`User connected: ${socket.id}`);

      // Join collaboration room
      socket.on('join-collaboration', async (data) => {
        try {
          const { projectId, userId, username, token } = data;
          
          // Verify user has access to project
          const project = await storage.getProject(projectId);
          if (!project) {
            socket.emit('collaboration-error', { message: 'Project not found' });
            return;
          }

          // Check if user has access (owner or collaborator)
          const hasAccess = project.ownerId === userId;
          if (!hasAccess) {
            const collaborators = await storage.getProjectCollaborators(projectId);
            const isCollaborator = collaborators.some(c => c.userId === userId);
            if (!isCollaborator) {
              socket.emit('collaboration-error', { message: 'Access denied' });
              return;
            }
          }

          // Create or get collaboration room
          let room = this.rooms.get(projectId);
          if (!room) {
            room = this.createCollaborationRoom(projectId);
          }

          // Create session
          const session: CollaborationSession = {
            id: `${userId}-${socket.id}`,
            projectId,
            userId,
            username,
            socketId: socket.id,
            cursor: { line: 0, column: 0 },
            lastActivity: new Date(),
            color: this.getUserColor(userId),
            status: 'active'
          };

          room.sessions.set(session.id, session);
          socket.join(`project-${projectId}`);

          // Notify other users
          socket.to(`project-${projectId}`).emit('user-joined', {
            userId,
            username,
            color: session.color,
            sessionId: session.id
          });

          // Send current collaborators to new user
          const collaborators = Array.from(room.sessions.values()).map(s => ({
            userId: s.userId,
            username: s.username,
            color: s.color,
            status: s.status,
            activeFile: s.activeFile,
            cursor: s.cursor
          }));

          socket.emit('collaboration-joined', {
            sessionId: session.id,
            collaborators: collaborators.filter(c => c.userId !== userId),
            roomInfo: {
              projectId,
              totalUsers: room.sessions.size,
              createdAt: room.createdAt
            }
          });

          logger.info(`User ${username} joined collaboration room for project ${projectId}`);
        } catch (error) {
          logger.error('Error joining collaboration:', error);
          socket.emit('collaboration-error', { message: 'Failed to join collaboration' });
        }
      });

      // Handle cursor movement
      socket.on('cursor-move', (data) => {
        try {
          const { projectId, cursor, activeFile } = data;
          const room = this.rooms.get(projectId);
          if (!room) return;

          const session = Array.from(room.sessions.values())
            .find(s => s.socketId === socket.id);
          
          if (session) {
            session.cursor = cursor;
            session.activeFile = activeFile;
            session.lastActivity = new Date();

            // Broadcast cursor position to other users
            socket.to(`project-${projectId}`).emit('cursor-update', {
              userId: session.userId,
              username: session.username,
              color: session.color,
              cursor,
              activeFile
            });
          }
        } catch (error) {
          logger.error('Error handling cursor move:', error);
        }
      });

      // Handle text changes with CRDT
      socket.on('text-change', async (data) => {
        try {
          const { projectId, filePath, operation } = data;
          const room = this.rooms.get(projectId);
          if (!room) return;

          // Get or create Y.Text for this file
          let yText = room.files.get(filePath);
          if (!yText) {
            yText = room.yDoc.getText(filePath);
            room.files.set(filePath, yText);
            
            // Load initial content from storage
            const file = await storage.getFile(projectId, filePath);
            if (file && file.content) {
              yText.insert(0, file.content);
            }
          }

          // Apply operation using Yjs
          if (operation.type === 'insert') {
            yText.insert(operation.index, operation.text);
          } else if (operation.type === 'delete') {
            yText.delete(operation.index, operation.length);
          }

          // Save to storage periodically
          const content = yText.toString();
          await storage.updateFile(projectId, filePath, content);

          room.lastActivity = new Date();
        } catch (error) {
          logger.error('Error handling text change:', error);
        }
      });

      // Handle file operations
      socket.on('file-operation', async (data) => {
        try {
          const { projectId, operation } = data;
          const room = this.rooms.get(projectId);
          if (!room) return;

          // Broadcast file operation to all users in room
          socket.to(`project-${projectId}`).emit('file-operation-broadcast', {
            operation,
            timestamp: new Date().toISOString()
          });

          logger.info(`File operation ${operation.type} broadcasted for project ${projectId}`);
        } catch (error) {
          logger.error('Error handling file operation:', error);
        }
      });

      // Voice chat functionality
      socket.on('join-voice', async (data) => {
        try {
          const { projectId, userId, username } = data;
          const roomId = `voice-${projectId}`;

          let voiceChannel = this.voiceChannels.get(roomId);
          if (!voiceChannel) {
            voiceChannel = new Map();
            this.voiceChannels.set(roomId, voiceChannel);
          }

          const voiceSession: VoiceChannelSession = {
            userId,
            username,
            socketId: socket.id,
            isMuted: false,
            isDeafened: false,
            isSpeaking: false,
            roomId
          };

          voiceChannel.set(userId, voiceSession);
          socket.join(roomId);

          // Notify others in voice channel
          socket.to(roomId).emit('user-joined-voice', {
            userId,
            username,
            isMuted: false,
            isDeafened: false
          });

          // Send current voice participants
          const participants = Array.from(voiceChannel.values()).map(s => ({
            userId: s.userId,
            username: s.username,
            isMuted: s.isMuted,
            isDeafened: s.isDeafened,
            isSpeaking: s.isSpeaking
          }));

          socket.emit('voice-joined', {
            roomId,
            participants: participants.filter(p => p.userId !== userId)
          });

          logger.info(`User ${username} joined voice channel for project ${projectId}`);
        } catch (error) {
          logger.error('Error joining voice:', error);
        }
      });

      // Voice state changes
      socket.on('voice-state-change', (data) => {
        try {
          const { projectId, isMuted, isDeafened, isSpeaking } = data;
          const roomId = `voice-${projectId}`;
          const voiceChannel = this.voiceChannels.get(roomId);
          
          if (voiceChannel) {
            const session = Array.from(voiceChannel.values())
              .find(s => s.socketId === socket.id);
            
            if (session) {
              session.isMuted = isMuted ?? session.isMuted;
              session.isDeafened = isDeafened ?? session.isDeafened;
              session.isSpeaking = isSpeaking ?? session.isSpeaking;

              // Broadcast state change
              socket.to(roomId).emit('voice-state-update', {
                userId: session.userId,
                isMuted: session.isMuted,
                isDeafened: session.isDeafened,
                isSpeaking: session.isSpeaking
              });
            }
          }
        } catch (error) {
          logger.error('Error handling voice state change:', error);
        }
      });

      // Screen sharing
      socket.on('start-screen-share', async (data) => {
        try {
          const { projectId, userId, username, streamId, quality } = data;
          const shareId = `screen-${projectId}-${userId}`;

          const screenShare: ScreenShareSession = {
            userId,
            username,
            socketId: socket.id,
            streamId,
            quality: quality || 'medium',
            isSharing: true
          };

          this.screenShares.set(shareId, screenShare);

          // Notify all users in project
          socket.to(`project-${projectId}`).emit('screen-share-started', {
            userId,
            username,
            streamId,
            quality: screenShare.quality
          });

          socket.emit('screen-share-confirmed', { shareId });

          logger.info(`User ${username} started screen sharing for project ${projectId}`);
        } catch (error) {
          logger.error('Error starting screen share:', error);
        }
      });

      socket.on('stop-screen-share', (data) => {
        try {
          const { projectId, userId } = data;
          const shareId = `screen-${projectId}-${userId}`;
          
          const screenShare = this.screenShares.get(shareId);
          if (screenShare) {
            this.screenShares.delete(shareId);

            // Notify all users
            socket.to(`project-${projectId}`).emit('screen-share-stopped', {
              userId,
              username: screenShare.username
            });

            logger.info(`Screen sharing stopped for project ${projectId} by user ${userId}`);
          }
        } catch (error) {
          logger.error('Error stopping screen share:', error);
        }
      });

      // User status updates
      socket.on('status-change', (data) => {
        try {
          const { projectId, status } = data;
          const room = this.rooms.get(projectId);
          if (!room) return;

          const session = Array.from(room.sessions.values())
            .find(s => s.socketId === socket.id);
          
          if (session) {
            session.status = status;
            session.lastActivity = new Date();

            // Broadcast status change
            socket.to(`project-${projectId}`).emit('user-status-update', {
              userId: session.userId,
              username: session.username,
              status
            });
          }
        } catch (error) {
          logger.error('Error handling status change:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        try {
          this.handleUserDisconnect(socket.id);
          logger.info(`User disconnected: ${socket.id}`);
        } catch (error) {
          logger.error('Error handling disconnect:', error);
        }
      });
    });
  }

  private createCollaborationRoom(projectId: number): CollaborationRoom {
    const yDoc = new Y.Doc();
    const room: CollaborationRoom = {
      projectId,
      sessions: new Map(),
      yDoc,
      awareness: null, // Would be initialized with awareness provider
      files: new Map(),
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.rooms.set(projectId, room);
    logger.info(`Created collaboration room for project ${projectId}`);
    
    return room;
  }

  private getUserColor(userId: number): string {
    // Assign consistent color based on user ID
    const index = userId % this.userColors.length;
    return this.userColors[index];
  }

  private handleUserDisconnect(socketId: string) {
    // Remove from collaboration rooms
    for (const [projectId, room] of this.rooms.entries()) {
      const session = Array.from(room.sessions.values())
        .find(s => s.socketId === socketId);
      
      if (session) {
        room.sessions.delete(session.id);
        
        // Notify other users
        this.io.to(`project-${projectId}`).emit('user-left', {
          userId: session.userId,
          username: session.username
        });

        // Clean up empty rooms
        if (room.sessions.size === 0) {
          this.rooms.delete(projectId);
          logger.info(`Cleaned up empty collaboration room for project ${projectId}`);
        }
      }
    }

    // Remove from voice channels
    for (const [roomId, voiceChannel] of this.voiceChannels.entries()) {
      const session = Array.from(voiceChannel.values())
        .find(s => s.socketId === socketId);
      
      if (session) {
        voiceChannel.delete(session.userId);
        
        // Notify voice channel participants
        this.io.to(roomId).emit('user-left-voice', {
          userId: session.userId,
          username: session.username
        });

        // Clean up empty voice channels
        if (voiceChannel.size === 0) {
          this.voiceChannels.delete(roomId);
        }
      }
    }

    // Remove screen shares
    for (const [shareId, screenShare] of this.screenShares.entries()) {
      if (screenShare.socketId === socketId) {
        this.screenShares.delete(shareId);
        
        // Notify users that screen share stopped
        this.io.emit('screen-share-stopped', {
          userId: screenShare.userId,
          username: screenShare.username
        });
      }
    }
  }

  private startCleanupTimer() {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      const now = new Date();
      const inactiveThreshold = 15 * 60 * 1000; // 15 minutes

      for (const [projectId, room] of this.rooms.entries()) {
        for (const [sessionId, session] of room.sessions.entries()) {
          if (now.getTime() - session.lastActivity.getTime() > inactiveThreshold) {
            room.sessions.delete(sessionId);
            
            this.io.to(`project-${projectId}`).emit('user-left', {
              userId: session.userId,
              username: session.username,
              reason: 'inactive'
            });
          }
        }

        // Clean up empty rooms
        if (room.sessions.size === 0) {
          this.rooms.delete(projectId);
        }
      }
    }, 5 * 60 * 1000);
  }

  // Public API methods
  async getCollaborationStats(projectId: number) {
    const room = this.rooms.get(projectId);
    if (!room) {
      return {
        activeUsers: 0,
        totalSessions: 0,
        voiceParticipants: 0,
        screenShares: 0
      };
    }

    const voiceChannel = this.voiceChannels.get(`voice-${projectId}`);
    const screenShareCount = Array.from(this.screenShares.values())
      .filter(s => s.streamId.includes(projectId.toString())).length;

    return {
      activeUsers: room.sessions.size,
      totalSessions: room.sessions.size,
      voiceParticipants: voiceChannel?.size || 0,
      screenShares: screenShareCount,
      lastActivity: room.lastActivity
    };
  }

  async getActiveCollaborators(projectId: number) {
    const room = this.rooms.get(projectId);
    if (!room) return [];

    return Array.from(room.sessions.values()).map(session => ({
      userId: session.userId,
      username: session.username,
      status: session.status,
      activeFile: session.activeFile,
      lastActivity: session.lastActivity,
      color: session.color
    }));
  }

  async kickUser(projectId: number, targetUserId: number, moderatorUserId: number) {
    const room = this.rooms.get(projectId);
    if (!room) return false;

    // Verify moderator has permission (project owner or admin)
    const project = await storage.getProject(projectId);
    if (!project || project.ownerId !== moderatorUserId) {
      return false;
    }

    const session = Array.from(room.sessions.values())
      .find(s => s.userId === targetUserId);
    
    if (session) {
      // Disconnect user
      const socket = this.io.sockets.sockets.get(session.socketId);
      if (socket) {
        socket.emit('kicked-from-collaboration', {
          reason: 'Removed by project owner',
          moderator: moderatorUserId
        });
        socket.disconnect();
      }

      return true;
    }

    return false;
  }
}

export let advancedCollaborationService: AdvancedCollaborationService;

export function initializeAdvancedCollaboration(io: SocketIOServer) {
  advancedCollaborationService = new AdvancedCollaborationService(io);
  return advancedCollaborationService;
}