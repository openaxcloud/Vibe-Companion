// @ts-nocheck
import { WebSocket } from 'ws';
import * as Y from 'yjs';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';
import { db } from '../db';
import { collaborationSessions, sessionParticipants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';
import { generateDeterministicColor } from '../websocket/ws-metrics';

const logger = createLogger('collaborative-editing');

// Configuration from environment
const INACTIVE_THRESHOLD_MS = parseInt(process.env.WS_INACTIVE_THRESHOLD_MS || '1800000', 10); // 30 min default
const CLEANUP_INTERVAL_MS = parseInt(process.env.WS_CLEANUP_INTERVAL_MS || '300000', 10); // 5 min default
const EMPTY_SESSION_DELAY_MS = parseInt(process.env.WS_EMPTY_SESSION_DELAY_MS || '30000', 10); // 30 sec default

interface CollaborativeSession {
  id: string;
  projectId: string;
  fileId: number;
  ydoc: Y.Doc;
  participants: Map<string, Participant>;
  createdAt: Date;
  lastActivity: Date;
}

interface Participant {
  userId: string;
  username: string;
  websocket: WebSocket;
  color: string;
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  joinedAt: Date;
  lastSeen: Date;
}

interface AwarenessState {
  user: {
    id: string;
    username: string;
    color: string;
  };
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}


// W-H16: Simple mutex for Yjs operations to handle race conditions
const yjsLocks = new Map<string, Promise<void>>();

async function withYjsLock<T>(sessionId: string, fn: () => Promise<T> | T): Promise<T> {
  while (yjsLocks.has(sessionId)) {
    await yjsLocks.get(sessionId);
  }
  let resolve: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  yjsLocks.set(sessionId, promise);
  try {
    return await fn();
  } finally {
    yjsLocks.delete(sessionId);
    resolve!();
  }
}

export class CollaborativeEditingService {
  private sessions: Map<string, CollaborativeSession> = new Map();
  private fileToSession: Map<number, string> = new Map();
  private userColorIndex: number = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // W-H8: Single cleanup interval (avoid duplicates)
    this.startCleanupInterval();
    logger.info('CollaborativeEditingService initialized');
  }

  private startCleanupInterval(): void {
    // Clear any existing interval to prevent duplicates
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // Cleanup inactive sessions (configurable interval)
    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveSessions();
    }, CLEANUP_INTERVAL_MS);
    logger.info(`Cleanup interval set to ${CLEANUP_INTERVAL_MS}ms`);
  }

  /**
   * Create or join a collaborative session
   */
  async createOrJoinSession(
    projectId: string,
    fileId: number,
    userId: string,
    username: string,
    websocket: WebSocket
  ): Promise<{ sessionId: string; ydoc: Y.Doc; color: string; participants: AwarenessState[] }> {
    let sessionId = this.fileToSession.get(fileId);
    let session: CollaborativeSession;
    let isNewSession = false;

    if (!sessionId || !this.sessions.has(sessionId)) {
      // Create new session
      sessionId = crypto.randomUUID();
      const ydoc = new Y.Doc();
      
      session = {
        id: sessionId,
        projectId,
        fileId,
        ydoc,
        participants: new Map(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      this.sessions.set(sessionId, session);
      this.fileToSession.set(fileId, sessionId);
      isNewSession = true;

      // Store session in database
      await db.insert(collaborationSessions).values({
        id: sessionId,
        projectId,
        fileId,
        active: true,
        createdAt: new Date(),
      });
    } else {
      session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
    }

    // Assign deterministic color based on userId (consistent across sessions)
    const color = generateDeterministicColor(userId);

    // Add participant
    const participant: Participant = {
      userId,
      username,
      websocket,
      color,
      joinedAt: new Date(),
      lastSeen: new Date(),
    };

    session.participants.set(userId, participant);

    // Store participant in database
    await db.insert(sessionParticipants).values({
      id: crypto.randomUUID(),
      sessionId,
      userId,
      username,
      cursorColor: color,
      joinedAt: new Date(),
      active: true,
    });

    // Get current participants for awareness
    const participants = Array.from(session.participants.values()).map(p => ({
      user: {
        id: p.userId,
        username: p.username,
        color: p.color,
      },
      cursor: p.cursor,
      selection: p.selection,
    }));

    return {
      sessionId,
      ydoc: session.ydoc,
      color,
      participants,
    };
  }

  /**
   * Handle document update from a participant
   * W-H16: Uses mutex to prevent race conditions in Yjs operations
   */
  async handleDocumentUpdate(
    sessionId: string,
    userId: string,
    update: Uint8Array
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // W-H16: Use mutex to handle Yjs race conditions
    await withYjsLock(sessionId, () => {
      // Apply update to the Yjs document
      applyUpdate(session.ydoc, update);
      session.lastActivity = new Date();

      // Broadcast update to all other participants
      // W-H17: Check readyState before sending
      session.participants.forEach((participant, participantId) => {
        if (participantId !== userId && participant.websocket.readyState === WebSocket.OPEN) {
          participant.websocket.send(JSON.stringify({
            type: 'document-update',
            data: Array.from(update),
          }));
        }
      });
    });
  }

  /**
   * Handle cursor position update from a participant
   */
  async handleCursorUpdate(
    sessionId: string,
    userId: string,
    cursor: { line: number; column: number }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    participant.cursor = cursor;
    participant.lastSeen = new Date();
    session.lastActivity = new Date();

    // Broadcast cursor update to all other participants
    session.participants.forEach((p, participantId) => {
      if (participantId !== userId && p.websocket.readyState === WebSocket.OPEN) {
        p.websocket.send(JSON.stringify({
          type: 'cursor-update',
          data: {
            userId,
            username: participant.username,
            color: participant.color,
            cursor,
          },
        }));
      }
    });
  }

  /**
   * Handle selection update from a participant
   */
  async handleSelectionUpdate(
    sessionId: string,
    userId: string,
    selection: { startLine: number; startColumn: number; endLine: number; endColumn: number }
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      throw new Error('Participant not found');
    }

    participant.selection = selection;
    participant.lastSeen = new Date();
    session.lastActivity = new Date();

    // Broadcast selection update to all other participants
    session.participants.forEach((p, participantId) => {
      if (participantId !== userId && p.websocket.readyState === WebSocket.OPEN) {
        p.websocket.send(JSON.stringify({
          type: 'selection-update',
          data: {
            userId,
            username: participant.username,
            color: participant.color,
            selection,
          },
        }));
      }
    });
  }

  /**
   * Handle participant leaving a session
   */
  async handleParticipantLeave(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const participant = session.participants.get(userId);
    if (!participant) {
      return;
    }

    // Remove participant from session
    session.participants.delete(userId);

    // Update database
    await db
      .update(sessionParticipants)
      .set({ active: false, leftAt: new Date() })
      .where(
        and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, userId)
        )
      );

    // Notify other participants
    session.participants.forEach(p => {
      if (p.websocket.readyState === WebSocket.OPEN) {
        p.websocket.send(JSON.stringify({
          type: 'participant-leave',
          data: {
            userId,
            username: participant.username,
          },
        }));
      }
    });

    // If no participants left, mark session as inactive after a configurable delay
    if (session.participants.size === 0) {
      setTimeout(async () => {
        const currentSession = this.sessions.get(sessionId);
        if (currentSession && currentSession.participants.size === 0) {
          await this.closeSession(sessionId);
        }
      }, EMPTY_SESSION_DELAY_MS);
    }
  }

  /**
   * Get current state of a session
   */
  async getSessionState(sessionId: string): Promise<{
    document: Uint8Array;
    participants: AwarenessState[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const documentState = encodeStateAsUpdate(session.ydoc);
    const participants = Array.from(session.participants.values()).map(p => ({
      user: {
        id: p.userId,
        username: p.username,
        color: p.color,
      },
      cursor: p.cursor,
      selection: p.selection,
    }));

    return {
      document: documentState,
      participants,
    };
  }

  /**
   * Close a collaborative session
   */
  private async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Close all participant connections
    session.participants.forEach(participant => {
      if (participant.websocket.readyState === WebSocket.OPEN) {
        participant.websocket.send(JSON.stringify({
          type: 'session-closed',
        }));
        participant.websocket.close();
      }
    });

    // Remove session from maps
    this.sessions.delete(sessionId);
    this.fileToSession.delete(session.fileId);

    // Mark session as inactive in database
    await db
      .update(collaborationSessions)
      .set({ active: false })
      .where(eq(collaborationSessions.id, sessionId));
  }

  /**
   * Cleanup inactive sessions (configurable threshold)
   */
  private async cleanupInactiveSessions(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const timeSinceActivity = now.getTime() - session.lastActivity.getTime();
      
      if (timeSinceActivity > INACTIVE_THRESHOLD_MS) {
        logger.info(`Cleaning up inactive session ${sessionId} (inactive for ${timeSinceActivity}ms)`);
        await this.closeSession(sessionId);
        cleanedCount++;
      } else {
        // Check for disconnected participants
        for (const [userId, participant] of session.participants) {
          if (participant.websocket.readyState !== WebSocket.OPEN) {
            logger.info(`Cleaning up disconnected participant ${userId} from session ${sessionId}`);
            await this.handleParticipantLeave(sessionId, userId);
          }
        }
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} inactive sessions`);
    }
  }

  /**
   * Generate a shareable collaboration link
   */
  async generateCollaborationLink(projectId: string, fileId: number): Promise<string> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store the token in database for verification (you might want to add a collaboration_tokens table)
    // For now, we'll return a simple link structure
    return `${baseUrl}/collaborate/${projectId}/${fileId}?token=${token}`;
  }

  /**
   * Cleanup on service shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down collaborative editing service...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
    
    logger.info('Collaborative editing service shut down');
  }
}

export const collaborativeEditingService = new CollaborativeEditingService();