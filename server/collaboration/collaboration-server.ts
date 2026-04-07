/**
 * Collaboration Server
 * ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Migrated to Central Upgrade Dispatcher
 */

import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { Awareness } from 'y-protocols/awareness';
import { Request } from 'express';
import http, { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import * as crypto from 'crypto';
import { storage } from '../storage';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import { createLogger } from '../utils/logger';
import { redisCache, CacheKeys, CacheTTL } from '../services/redis-cache.service';

const logger = createLogger('collaboration-server');

const CHECKPOINT_INTERVAL_MS = 5000;
const instanceId = crypto.randomUUID();

interface CollaborationRoom {
  doc: Y.Doc;
  awareness: Awareness;
  connections: Set<WebSocket>;
  projectId: number;
  lastActivity: Date;
  checkpointTimer?: ReturnType<typeof setTimeout>;
  dirty: boolean;
  applyingRemote: boolean;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  clientId?: number;
  projectId?: number;
  isAlive?: boolean;
}

export class CollaborationServer {
  private wss: WebSocketServer;
  private rooms: Map<string, CollaborationRoom> = new Map();
  private clientIdCounter = 0;

  constructor(server: http.Server) {
    // ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Use Central Upgrade Dispatcher
    // Use noServer mode and register with central dispatcher to eliminate race conditions
    this.wss = new WebSocketServer({ noServer: true });

    // Register /collaboration handler with central dispatcher (priority 62)
    centralUpgradeDispatcher.register(
      '/collaboration',
      this.handleUpgrade.bind(this),
      { pathMatch: 'prefix', priority: 62 }
    );

    this.startCleanupInterval();
    logger.info('[CollaborationServer] Initialized (using central dispatcher)');
  }
  
  /**
   * Handle /collaboration WebSocket upgrade via central dispatcher
   */
  private handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    // Mark socket as handled before upgrade
    markSocketAsHandled(request, socket);
    
    this.wss.handleUpgrade(request, socket, head, async (ws: AuthenticatedWebSocket) => {
      const projectId = parseInt(request.url?.split('?projectId=')[1] || '0');
      const userId = (request as any).session?.passport?.user;
      
      if (!projectId || !userId) {
        ws.close(1008, 'Missing project ID or authentication');
        return;
      }

      // Verify user has access to project
      const hasAccess = await this.verifyProjectAccess(userId, projectId);
      if (!hasAccess) {
        ws.close(1008, 'Access denied');
        return;
      }

      ws.userId = userId;
      ws.projectId = projectId;
      ws.clientId = ++this.clientIdCounter;
      ws.isAlive = true;

      const roomName = `project-${projectId}`;
      const room = await this.getOrCreateRoom(roomName, projectId);
      room.connections.add(ws);

      // Send initial document state
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // Message type: sync
      syncProtocol.writeSyncStep1(encoder, room.doc);
      ws.send(encoding.toUint8Array(encoder));

      // Send awareness state
      this.broadcastAwareness(room, ws);

      ws.on('message', (message: ArrayBuffer) => {
        try {
          this.handleMessage(ws, message, room);
        } catch (error) {
          console.error('Error handling collaboration message:', error);
        }
      });

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        room.connections.delete(ws);
        if (ws.clientId) {
          this.broadcastUserLeft(room, ws.clientId);
        }
        if (room.connections.size === 0) {
          if (room.checkpointTimer) {
            clearTimeout(room.checkpointTimer);
            room.checkpointTimer = undefined;
          }
          this.persistRoomState(roomName, room.doc).then(() => {
            this.rooms.delete(roomName);
          });
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        room.connections.delete(ws);
        if (ws.clientId) {
          this.broadcastUserLeft(room, ws.clientId);
        }
      });
    });
  }

  private async verifyProjectAccess(userId: number, projectId: number): Promise<boolean> {
    try {
      const project = await storage.getProject(projectId);
      if (!project) return false;
      
      // Check if user owns the project
      if (project.ownerId === userId) return true;
      
      // Check if user is a collaborator
      const isCollaborator = await storage.isProjectCollaborator(projectId, userId);
      if (isCollaborator) return true;
      
      // Check if project is public
      if (project.visibility === 'public') return true;
      
      return false;
    } catch (error) {
      console.error('Error verifying project access:', error);
      return false;
    }
  }

  private scheduleCheckpoint(roomName: string, room: CollaborationRoom): void {
    if (room.checkpointTimer) return;
    room.checkpointTimer = setTimeout(async () => {
      room.checkpointTimer = undefined;
      if (room.dirty) {
        room.dirty = false;
        await this.persistRoomState(roomName, room.doc);
      }
    }, CHECKPOINT_INTERVAL_MS);
  }

  private async getOrCreateRoom(roomName: string, projectId: number): Promise<CollaborationRoom> {
    let room = this.rooms.get(roomName);
    if (!room) {
      const doc = new Y.Doc();
      const awareness = new Awareness(doc);
      room = {
        doc,
        awareness,
        connections: new Set(),
        projectId,
        lastActivity: new Date(),
        dirty: false,
        applyingRemote: false
      };

      try {
        const savedState = await redisCache.getRaw(CacheKeys.collabDocState(roomName));
        if (savedState) {
          const stateBuffer = Buffer.from(savedState, 'base64');
          Y.applyUpdate(doc, new Uint8Array(stateBuffer));
          logger.info(`Restored Yjs doc state from Redis for room ${roomName}`);
        }
      } catch (error) {
        logger.error(`Failed to restore doc state from Redis for room ${roomName}:`, error);
      }

      const channel = CacheKeys.collabDocUpdates(roomName);
      const roomRef = room;

      await redisCache.subscribe(channel, (message: string) => {
        try {
          const parsed = JSON.parse(message);
          if (parsed.instance === instanceId) return;
          const updateBuf = Buffer.from(parsed.update, 'base64');
          roomRef.applyingRemote = true;
          Y.applyUpdate(doc, new Uint8Array(updateBuf));
          roomRef.applyingRemote = false;
        } catch (err) {
          roomRef.applyingRemote = false;
          logger.error(`Failed to apply remote update for room ${roomName}:`, err);
        }
      });

      doc.on('update', (update: Uint8Array) => {
        roomRef.dirty = true;
        this.scheduleCheckpoint(roomName, roomRef);

        if (!roomRef.applyingRemote) {
          const updateBase64 = Buffer.from(update).toString('base64');
          redisCache.publish(channel, JSON.stringify({ instance: instanceId, update: updateBase64 })).catch(() => {});
        }
      });

      this.rooms.set(roomName, room);
    }
    room.lastActivity = new Date();
    return room;
  }

  private async persistRoomState(roomName: string, doc: Y.Doc): Promise<void> {
    try {
      const state = Y.encodeStateAsUpdate(doc);
      const stateBase64 = Buffer.from(state).toString('base64');
      await redisCache.setRaw(CacheKeys.collabDocState(roomName), stateBase64, CacheTTL.DAY);
      logger.info(`Persisted Yjs doc state to Redis for room ${roomName}`);
    } catch (error) {
      logger.error(`Failed to persist doc state to Redis for room ${roomName}:`, error);
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: ArrayBuffer, room: CollaborationRoom) {
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case 0: // Sync
        this.handleSync(decoder, ws, room);
        break;
      case 1: // Awareness
        this.handleAwareness(decoder, ws, room);
        break;
      default:
        console.warn('Unknown message type:', messageType);
    }
  }

  private handleSync(decoder: any, ws: AuthenticatedWebSocket, room: CollaborationRoom) {
    const encoder = encoding.createEncoder();
    const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, room.doc, null);
    
    if (syncMessageType === 0) {
      // Reply with sync step 2
      ws.send(encoding.toUint8Array(encoder));
    } else if (syncMessageType === 1 || syncMessageType === 2) {
      // Broadcast update to all other clients
      const update = encoding.toUint8Array(encoder);
      room.connections.forEach(conn => {
        if (conn !== ws && conn.readyState === WebSocket.OPEN) {
          conn.send(update);
        }
      });
    }
  }

  private handleAwareness(decoder: any, ws: AuthenticatedWebSocket, room: CollaborationRoom) {
    const clientId = ws.clientId!;
    const update = decoding.readVarUint8Array(decoder);
    
    // Apply awareness update
    awarenessProtocol.applyAwarenessUpdate(room.awareness, update, clientId);
    
    // Set user info in awareness
    room.awareness.setLocalStateField('user', {
      userId: ws.userId,
      clientId: clientId
    });

    // Broadcast to all other clients
    room.connections.forEach(conn => {
      if (conn !== ws && conn.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1); // Awareness message type
        encoding.writeVarUint8Array(encoder, update);
        conn.send(encoding.toUint8Array(encoder));
      }
    });
  }

  private broadcastAwareness(room: CollaborationRoom, newConnection: AuthenticatedWebSocket) {
    const states = room.awareness.getStates();
    if (states.size === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1); // Awareness message type
    const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys()));
    encoding.writeVarUint8Array(encoder, update);
    newConnection.send(encoding.toUint8Array(encoder));
  }

  private broadcastUserLeft(room: CollaborationRoom, clientId: number) {
    // Remove the user from awareness by removing their state
    awarenessProtocol.removeAwarenessStates(room.awareness, [clientId], clientId);
    
    // Create an update that removes this client
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1); // Awareness message type
    const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, [clientId]);
    encoding.writeVarUint8Array(encoder, update);
    
    room.connections.forEach(conn => {
      if (conn.readyState === WebSocket.OPEN) {
        conn.send(encoding.toUint8Array(encoder));
      }
    });
  }

  private startCleanupInterval() {
    // Ping clients every 30 seconds
    setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          ws.terminate();
          return;
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    setInterval(() => {
      const now = new Date();
      this.rooms.forEach((room, roomName) => {
        if (room.connections.size === 0 && 
            now.getTime() - room.lastActivity.getTime() > 5 * 60 * 1000) {
          this.persistRoomState(roomName, room.doc).then(() => {
            this.rooms.delete(roomName);
          });
        }
      });
    }, 5 * 60 * 1000);
  }

  public getRoomInfo(projectId: number) {
    const room = this.rooms.get(`project-${projectId}`);
    if (!room) return null;

    const states = room.awareness.getStates();
    return {
      activeUsers: room.connections.size,
      awareness: Array.from(states.values())
    };
  }
}