/**
 * Real-time Collaboration Service
 * Provides WebRTC/CRDT-based collaborative editing
 * 
 * ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Migrated to Central Upgrade Dispatcher
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import SimplePeer from 'simple-peer';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import { redisCache, CacheKeys, CacheTTL } from '../services/redis-cache.service';

const logger = createLogger('real-collaboration');

// y-websocket protocol message types
const messageSync = 0;
const messageAwareness = 1;

const CHECKPOINT_INTERVAL_MS = 5000;
const instanceId = crypto.randomUUID();

interface DocData {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;
  checkpointTimer?: ReturnType<typeof setTimeout>;
  dirty: boolean;
  ready: boolean;
  readyPromise?: Promise<void>;
  applyingRemote: boolean;
}
const docs = new Map<string, DocData>();

async function loadDocStateFromRedis(doc: Y.Doc, docName: string): Promise<void> {
  try {
    const savedState = await redisCache.getRaw(CacheKeys.collabDocState(`yjs-${docName}`));
    if (savedState) {
      const stateBuffer = Buffer.from(savedState, 'base64');
      Y.applyUpdate(doc, new Uint8Array(stateBuffer));
      logger.info(`Restored Yjs doc state from Redis for doc ${docName}`);
    }
  } catch (error) {
    logger.error(`Failed to restore Yjs doc from Redis for ${docName}:`, error);
  }
}

async function persistDocStateToRedis(doc: Y.Doc, docName: string): Promise<void> {
  try {
    const state = Y.encodeStateAsUpdate(doc);
    const stateBase64 = Buffer.from(state).toString('base64');
    await redisCache.setRaw(CacheKeys.collabDocState(`yjs-${docName}`), stateBase64, CacheTTL.DAY);
  } catch (error) {
    logger.error(`Failed to persist Yjs doc to Redis for ${docName}:`, error);
  }
}

function scheduleCheckpoint(docData: DocData, docName: string): void {
  if (docData.checkpointTimer) return;
  docData.checkpointTimer = setTimeout(async () => {
    docData.checkpointTimer = undefined;
    if (docData.dirty) {
      docData.dirty = false;
      await persistDocStateToRedis(docData.doc, docName);
    }
  }, CHECKPOINT_INTERVAL_MS);
}

async function getYDoc(docName: string): Promise<DocData> {
  let docData = docs.get(docName);
  if (docData) {
    if (!docData.ready && docData.readyPromise) {
      await docData.readyPromise;
    }
    return docData;
  }

  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  docData = { doc, awareness, conns: new Map(), dirty: false, ready: false, applyingRemote: false };
  docs.set(docName, docData);

  const readyPromise = loadDocStateFromRedis(doc, docName).then(() => {
    docData!.ready = true;
  }).catch(() => {
    docData!.ready = true;
  });
  docData.readyPromise = readyPromise;
  await readyPromise;

  const channel = CacheKeys.collabDocUpdates(`yjs-${docName}`);
  const localDocData = docData;
  await redisCache.subscribe(channel, (message: string) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.instance === instanceId) return;
      const updateBuf = Buffer.from(parsed.update, 'base64');
      localDocData.applyingRemote = true;
      Y.applyUpdate(doc, new Uint8Array(updateBuf));
      localDocData.applyingRemote = false;
    } catch (err) {
      localDocData.applyingRemote = false;
      logger.error(`Failed to apply remote Yjs update for ${docName}:`, err);
    }
  });

  doc.on('update', (update: Uint8Array, origin: any) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    const originWsId = origin && (origin as any).__wsId;

    localDocData.conns.forEach((clientIds, conn) => {
      const connWsId = (conn as any).__wsId;
      const isSender = originWsId && connWsId === originWsId;

      if (conn.readyState === WebSocket.OPEN && !isSender) {
        conn.send(message);
      }
    });

    if (!localDocData.applyingRemote) {
      const updateBase64 = Buffer.from(update).toString('base64');
      redisCache.publish(channel, JSON.stringify({ instance: instanceId, update: updateBase64 })).catch(() => {});
    }

    localDocData.dirty = true;
    scheduleCheckpoint(localDocData, docName);
  });

  awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
    const changedClients = added.concat(updated).concat(removed);
    if (changedClients.length === 0) return;

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
    const message = encoding.toUint8Array(encoder);

    const originWsId = origin && (origin as any).__wsId;

    localDocData.conns.forEach((clientIds, conn) => {
      const connWsId = (conn as any).__wsId;
      const isSender = originWsId && connWsId === originWsId;

      if (conn.readyState === WebSocket.OPEN && !isSender) {
        conn.send(message);
      }
    });
  });

  return docData;
}

async function setupWSConnection(ws: WebSocket, req: any) {
  const url = new URL(req.url, 'http://localhost');
  const docName = url.searchParams.get('room') || 'default';
  const docData = await getYDoc(docName);
  const { doc, awareness, conns } = docData;
  
  // Track client IDs for this connection
  const trackedClientIds = new Set<number>();
  conns.set(ws, trackedClientIds);
  
  // Mark this WebSocket for origin tracking
  const wsId = Symbol('ws');
  (ws as any).__wsId = wsId;
  
  // Track awareness updates from this connection
  const awarenessUpdateHandler = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: any) => {
    // Track IDs that came from this connection
    if (origin && (origin as any).__wsId === wsId) {
      added.forEach((id: number) => trackedClientIds.add(id));
      updated.forEach((id: number) => trackedClientIds.add(id));
    }
  };
  awareness.on('update', awarenessUpdateHandler);
  
  // Send sync step 1
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  ws.send(encoding.toUint8Array(encoder));
  
  // Send current awareness state
  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, messageAwareness);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
    );
    ws.send(encoding.toUint8Array(awarenessEncoder));
  }
  
  ws.on('message', (data: Buffer) => {
    try {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const messageType = decoding.readVarUint(decoder);
      
      switch (messageType) {
        case messageSync: {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          syncProtocol.readSyncMessage(decoder, encoder, doc, ws);
          if (encoding.length(encoder) > 1) {
            ws.send(encoding.toUint8Array(encoder));
          }
          break;
        }
        case messageAwareness: {
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            decoding.readVarUint8Array(decoder),
            ws  // Pass ws as origin for tracking
          );
          break;
        }
      }
    } catch (err) {
      logger.error('Error processing y-websocket message', { error: err });
    }
  });
  
  ws.on('close', () => {
    awareness.off('update', awarenessUpdateHandler);
    
    if (trackedClientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(awareness, Array.from(trackedClientIds), null);
    }
    conns.delete(ws);
    
    if (conns.size === 0) {
      if (docData.checkpointTimer) {
        clearTimeout(docData.checkpointTimer);
        docData.checkpointTimer = undefined;
      }
      persistDocStateToRedis(doc, docName);
    }
  });
}

interface CollaborationSession {
  projectId: number;
  fileId: number;
  doc: Y.Doc;
  awareness: any;
  peers: Map<string, {
    ws: WebSocket;
    userId: number;
    cursor?: { line: number; ch: number };
    selection?: { anchor: any; head: any };
  }>;
  webrtcConnections: Map<string, SimplePeer.Instance>;
}

interface CursorUpdate {
  userId: number;
  fileId: number;
  cursor: { line: number; ch: number };
  selection?: { anchor: any; head: any };
  color: string;
  name: string;
}

export class RealCollaborationService {
  private wss!: WebSocketServer;
  private yjsWss!: WebSocketServer;
  private sessions: Map<string, CollaborationSession> = new Map();
  private userSessions: Map<number, Set<string>> = new Map();
  
  // Security Fix: Debounced save timers to prevent data loss
  // Replaces probabilistic 10% save with guaranteed debounced saves
  private saveTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly SAVE_DEBOUNCE_MS = 2000; // Save 2 seconds after last change

  constructor() {}

  setupWebSocket(server: Server) {
    // ✅ 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025): Use Central Upgrade Dispatcher
    // Use noServer mode and register with central dispatcher to eliminate race conditions
    
    // Main collaboration WebSocket
    this.wss = new WebSocketServer({ noServer: true });

    // Yjs WebSocket for CRDT sync
    this.yjsWss = new WebSocketServer({ noServer: true });

    // Register /collaborate handler with central dispatcher (priority 60 = collaboration tier)
    centralUpgradeDispatcher.register(
      '/collaborate',
      this.handleCollaborateUpgrade.bind(this),
      { pathMatch: 'prefix', priority: 60 }
    );
    
    // Register /yjs handler with central dispatcher (priority 61 = slightly lower)
    centralUpgradeDispatcher.register(
      '/yjs',
      this.handleYjsUpgrade.bind(this),
      { pathMatch: 'prefix', priority: 61 }
    );

    logger.info('Real collaboration WebSocket servers initialized (using central dispatcher)');
  }
  
  /**
   * Handle /collaborate WebSocket upgrade via central dispatcher
   */
  private handleCollaborateUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    // Mark socket as handled before upgrade
    markSocketAsHandled(request, socket);
    
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.handleConnection(ws, request);
    });
  }
  
  /**
   * Handle /yjs WebSocket upgrade via central dispatcher
   */
  private handleYjsUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    // Mark socket as handled before upgrade
    markSocketAsHandled(request, socket);
    
    this.yjsWss.handleUpgrade(request, socket, head, (ws) => {
      // Setup Yjs connection for CRDT synchronization
      setupWSConnection(ws, request);
    });
  }

  private async handleConnection(ws: WebSocket, request: any) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const projectId = parseInt(url.searchParams.get('projectId') || '0');
    const fileId = parseInt(url.searchParams.get('fileId') || '0');
    const userId = parseInt(url.searchParams.get('userId') || '0');

    if (!projectId || !fileId || !userId) {
      ws.close(1008, 'Missing required parameters');
      return;
    }

    const sessionKey = `${projectId}-${fileId}`;
    logger.info(`New collaboration connection: user ${userId} for session ${sessionKey}`);

    // Get or create session
    let session = this.sessions.get(sessionKey);
    if (!session) {
      session = await this.createSession(projectId, fileId);
      this.sessions.set(sessionKey, session);
    }

    // Add peer to session
    const peerId = `${userId}-${Date.now()}`;
    session.peers.set(peerId, {
      ws,
      userId,
      cursor: { line: 0, ch: 0 }
    });

    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionKey);

    // Send initial state
    await this.sendInitialState(ws, session, userId);

    // Handle messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(sessionKey, peerId, message);
      } catch (error) {
        logger.error(`Failed to handle collaboration message: ${error}`);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(sessionKey, peerId, userId);
    });

    ws.on('error', (error) => {
      logger.error(`Collaboration WebSocket error: ${error}`);
      this.handleDisconnect(sessionKey, peerId, userId);
    });
  }

  private async createSession(projectId: number, fileId: number): Promise<CollaborationSession> {
    const doc = new Y.Doc();
    const sessionKey = `${projectId}-${fileId}`;
    
    let restoredFromRedis = false;
    try {
      const savedState = await redisCache.getRaw(CacheKeys.collabDocState(`session-${sessionKey}`));
      if (savedState) {
        const stateBuffer = Buffer.from(savedState, 'base64');
        Y.applyUpdate(doc, new Uint8Array(stateBuffer));
        restoredFromRedis = true;
        logger.info(`Restored session doc state from Redis for ${sessionKey}`);
      }
    } catch (error) {
      logger.error(`Failed to restore session doc from Redis for ${sessionKey}:`, error);
    }
    
    if (!restoredFromRedis) {
      const file = await storage.getFile(fileId);
      if (file && file.content) {
        const yText = doc.getText('content');
        yText.insert(0, file.content);
      }
    }

    const awareness = new Map();

    return {
      projectId,
      fileId,
      doc,
      awareness,
      peers: new Map(),
      webrtcConnections: new Map()
    };
  }

  private async sendInitialState(ws: WebSocket, session: CollaborationSession, userId: number) {
    // Send current document state
    const yText = session.doc.getText('content');
    ws.send(JSON.stringify({
      type: 'init',
      content: yText.toString(),
      peers: Array.from(session.peers.entries()).map(([id, peer]) => ({
        id,
        userId: peer.userId,
        cursor: peer.cursor,
        selection: peer.selection
      }))
    }));

    // Notify other peers of new user
    this.broadcast(session, {
      type: 'peer-joined',
      peerId: `${userId}-${Date.now()}`,
      userId
    }, ws);
  }

  private async handleMessage(sessionKey: string, peerId: string, message: any) {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    const peer = session.peers.get(peerId);
    if (!peer) return;

    switch (message.type) {
      case 'cursor':
        await this.handleCursorUpdate(session, peerId, message);
        break;

      case 'selection':
        await this.handleSelectionUpdate(session, peerId, message);
        break;

      case 'operation':
        await this.handleOperation(session, peerId, message);
        break;

      case 'webrtc-signal':
        await this.handleWebRTCSignal(session, peerId, message);
        break;

      case 'voice-call-start':
        await this.handleVoiceCallStart(session, peerId, message);
        break;

      case 'voice-call-end':
        await this.handleVoiceCallEnd(session, peerId);
        break;

      case 'save':
        await this.saveDocument(session);
        break;

      default:
        logger.warn(`Unknown collaboration message type: ${message.type}`);
    }
  }

  private async handleCursorUpdate(session: CollaborationSession, peerId: string, message: any) {
    const peer = session.peers.get(peerId);
    if (!peer) return;

    // Update peer's cursor position
    peer.cursor = message.cursor;

    // Get user info for display
    const user = await storage.getUser(String(peer.userId));
    
    // Broadcast cursor update to other peers
    const cursorUpdate: CursorUpdate = {
      userId: peer.userId,
      fileId: session.fileId,
      cursor: message.cursor,
      selection: peer.selection,
      color: this.getUserColor(peer.userId),
      name: user?.username || `User ${peer.userId}`
    };

    this.broadcast(session, {
      type: 'cursor-update',
      peerId,
      ...cursorUpdate
    }, peer.ws);
  }

  private async handleSelectionUpdate(session: CollaborationSession, peerId: string, message: any) {
    const peer = session.peers.get(peerId);
    if (!peer) return;

    peer.selection = message.selection;

    const user = await storage.getUser(String(peer.userId));

    this.broadcast(session, {
      type: 'selection-update',
      peerId,
      userId: peer.userId,
      selection: message.selection,
      color: this.getUserColor(peer.userId),
      name: user?.username || `User ${peer.userId}`
    }, peer.ws);
  }

  private async handleOperation(session: CollaborationSession, peerId: string, message: any) {
    // Apply operation to Yjs document
    const yText = session.doc.getText('content');
    
    switch (message.operation.type) {
      case 'insert':
        yText.insert(message.operation.index, message.operation.text);
        break;
        
      case 'delete':
        yText.delete(message.operation.index, message.operation.length);
        break;
        
      case 'format':
        // Handle text formatting if needed
        break;
    }

    // Broadcast operation to other peers
    this.broadcast(session, {
      type: 'operation',
      peerId,
      operation: message.operation
    }, session.peers.get(peerId)?.ws);

    // Security Fix: Use debounced save instead of probabilistic save
    // This guarantees saves happen 2 seconds after the last change
    this.scheduleDebouncedSave(session);
  }

  /**
   * Schedule a debounced save for the session
   * Guarantees document is saved 2 seconds after the last modification
   * Replaces the unsafe probabilistic 10% save that could cause data loss
   */
  private scheduleDebouncedSave(session: CollaborationSession): void {
    const sessionKey = `${session.projectId}-${session.fileId}`;
    
    // Clear existing timer if any
    const existingTimer = this.saveTimers.get(sessionKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule new save
    const timer = setTimeout(async () => {
      try {
        await this.saveDocument(session);
        this.saveTimers.delete(sessionKey);
      } catch (error) {
        logger.error(`Failed to save document for session ${sessionKey}:`, error);
      }
    }, this.SAVE_DEBOUNCE_MS);
    
    this.saveTimers.set(sessionKey, timer);
  }

  private async handleWebRTCSignal(session: CollaborationSession, peerId: string, message: any) {
    const { targetPeerId, signal } = message;
    const targetPeer = session.peers.get(targetPeerId);
    
    if (targetPeer) {
      targetPeer.ws.send(JSON.stringify({
        type: 'webrtc-signal',
        fromPeerId: peerId,
        signal
      }));
    }
  }

  private async handleVoiceCallStart(session: CollaborationSession, peerId: string, message: any) {
    const peer = session.peers.get(peerId);
    if (!peer) return;

    // Create WebRTC connection for voice
    const rtcPeer = new SimplePeer({
      initiator: message.initiator,
      trickle: false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    rtcPeer.on('signal', (data) => {
      peer.ws.send(JSON.stringify({
        type: 'voice-signal',
        signal: data
      }));
    });

    rtcPeer.on('connect', () => {
      logger.info(`Voice call connected for peer ${peerId}`);
    });

    rtcPeer.on('error', (err) => {
      logger.error(`Voice call error for peer ${peerId}: ${err}`);
    });

    session.webrtcConnections.set(peerId, rtcPeer);

    // Notify other peers
    this.broadcast(session, {
      type: 'voice-call-started',
      peerId,
      userId: peer.userId
    }, peer.ws);
  }

  private async handleVoiceCallEnd(session: CollaborationSession, peerId: string) {
    const rtcPeer = session.webrtcConnections.get(peerId);
    if (rtcPeer) {
      rtcPeer.destroy();
      session.webrtcConnections.delete(peerId);
    }

    this.broadcast(session, {
      type: 'voice-call-ended',
      peerId
    });
  }

  private async saveDocument(session: CollaborationSession) {
    try {
      const yText = session.doc.getText('content');
      const content = yText.toString();
      
      await storage.updateFile(session.fileId, { content });
      
      // Notify all peers of save
      this.broadcast(session, {
        type: 'saved',
        timestamp: new Date().toISOString()
      });
      
      logger.info(`Document saved for session ${session.projectId}-${session.fileId}`);
    } catch (error) {
      logger.error(`Failed to save document: ${error}`);
    }
  }

  private handleDisconnect(sessionKey: string, peerId: string, userId: number) {
    const session = this.sessions.get(sessionKey);
    if (!session) return;

    // Remove peer
    session.peers.delete(peerId);
    
    // Clean up WebRTC connections
    const rtcPeer = session.webrtcConnections.get(peerId);
    if (rtcPeer) {
      rtcPeer.destroy();
      session.webrtcConnections.delete(peerId);
    }

    // Update user sessions
    const userSessionSet = this.userSessions.get(userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionKey);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(userId);
      }
    }

    // Notify other peers
    this.broadcast(session, {
      type: 'peer-left',
      peerId,
      userId
    });

    if (session.peers.size === 0) {
      const existingTimer = this.saveTimers.get(sessionKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.saveTimers.delete(sessionKey);
      }
      
      this.saveDocument(session).then(async () => {
        try {
          const state = Y.encodeStateAsUpdate(session.doc);
          const stateBase64 = Buffer.from(state).toString('base64');
          await redisCache.setRaw(CacheKeys.collabDocState(`session-${sessionKey}`), stateBase64, CacheTTL.DAY);
        } catch (error) {
          logger.error(`Failed to persist session doc state to Redis: ${error}`);
        }
        session.doc.destroy();
        this.sessions.delete(sessionKey);
        logger.info(`Session ${sessionKey} closed`);
      });
    }
  }

  private broadcast(session: CollaborationSession, message: any, exclude?: WebSocket) {
    const messageStr = JSON.stringify(message);
    
    for (const [peerId, peer] of session.peers) {
      if (peer.ws !== exclude && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(messageStr);
      }
    }
  }

  private getUserColor(userId: number): string {
    // Generate consistent color for user
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[userId % colors.length];
  }

  // Public API
  async getActiveCollaborators(projectId: number, fileId: number): Promise<Array<{
    userId: number;
    username: string;
    cursor?: { line: number; ch: number };
    color: string;
  }>> {
    const sessionKey = `${projectId}-${fileId}`;
    const session = this.sessions.get(sessionKey);
    
    if (!session) return [];

    const collaborators = await Promise.all(
      Array.from(session.peers.values()).map(async (peer) => {
        const user = await storage.getUser(String(peer.userId));
        return {
          userId: peer.userId,
          username: user?.username || `User ${peer.userId}`,
          cursor: peer.cursor,
          color: this.getUserColor(peer.userId)
        };
      })
    );

    return collaborators;
  }

  async forceSync(projectId: number, fileId: number) {
    const sessionKey = `${projectId}-${fileId}`;
    const session = this.sessions.get(sessionKey);
    
    if (session) {
      await this.saveDocument(session);
    }
  }
}

export const realCollaborationService = new RealCollaborationService();