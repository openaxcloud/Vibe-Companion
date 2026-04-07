/**
 * Voice/Video Collaboration Service using WebRTC
 * Provides real-time voice and video communication capabilities
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { db } from '../db';
import { voiceVideoSessions, voiceVideoParticipants } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface Peer {
  id: string;
  userId: number;
  username: string;
  socket: WebSocket;
  sessionId: number;
  audioEnabled: boolean;
  videoEnabled: boolean;
  screenSharing: boolean;
}

interface Room {
  id: string;
  sessionId: number;
  projectId: number;
  peers: Map<string, Peer>;
  hostId: number;
  type: 'voice' | 'video' | 'screen';
  recording: boolean;
  recordingStream?: any;
}

export class VoiceVideoService extends EventEmitter {
  private rooms: Map<string, Room> = new Map();
  private peerSocketMap: Map<WebSocket, string> = new Map();
  private getTurnServers() {
    const turnSecret = process.env.TURN_SECRET;
    const servers: Array<{urls: string[]; username?: string; credential?: string}> = [
      {
        urls: ['stun:stun.l.google.com:19302'],
      },
    ];
    
    // Only add TURN server if credential is configured
    if (turnSecret) {
      servers.push({
        urls: ['turn:turn.e-code.ai:3478'],
        username: 'ecode',
        credential: turnSecret,
      });
    }
    
    return servers;
  }
  
  private turnServers = this.getTurnServers();

  constructor() {
    super();
  }

  async createSession(
    projectId: number,
    hostUserId: number,
    sessionType: 'voice' | 'video' | 'screen',
    maxParticipants: number = 10
  ) {
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const [session] = await db.insert(voiceVideoSessions).values({
      projectId,
      roomId,
      hostUserId,
      sessionType,
      maxParticipants,
      status: 'active',
      recordingEnabled: false,
    }).returning();

    const room: Room = {
      id: roomId,
      sessionId: session.id,
      projectId,
      peers: new Map(),
      hostId: hostUserId,
      type: sessionType,
      recording: false,
    };

    this.rooms.set(roomId, room);
    
    return {
      roomId,
      sessionId: session.id,
      iceServers: this.turnServers,
    };
  }

  async joinSession(
    roomId: string,
    userId: number,
    username: string,
    socket: WebSocket
  ) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }

    // Check if room is full
    if (room.peers.size >= 10) {
      throw new Error('Room is full');
    }

    const peerId = `peer-${userId}-${Date.now()}`;
    
    // Add participant to database
    await db.insert(voiceVideoParticipants).values({
      sessionId: room.sessionId,
      userId,
      role: userId === room.hostId ? 'host' : 'participant',
    });

    const peer: Peer = {
      id: peerId,
      userId,
      username,
      socket,
      sessionId: room.sessionId,
      audioEnabled: true,
      videoEnabled: room.type === 'video',
      screenSharing: false,
    };

    room.peers.set(peerId, peer);
    this.peerSocketMap.set(socket, peerId);

    // Notify existing peers
    this.broadcastToPeers(room, peerId, {
      type: 'peer-joined',
      peerId,
      userId,
      username,
      isHost: userId === room.hostId,
    });

    // Send existing peers to new peer
    const existingPeers = Array.from(room.peers.values())
      .filter(p => p.id !== peerId)
      .map(p => ({
        peerId: p.id,
        userId: p.userId,
        username: p.username,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
        screenSharing: p.screenSharing,
        isHost: p.userId === room.hostId,
      }));

    this.sendToPeer(peer, {
      type: 'room-state',
      roomId,
      sessionType: room.type,
      peers: existingPeers,
      iceServers: this.turnServers,
    });

    return { peerId, roomId };
  }

  async leaveSession(socket: WebSocket) {
    const peerId = this.peerSocketMap.get(socket);
    if (!peerId) return;

    let room: Room | undefined;
    for (const [roomId, r] of this.rooms) {
      if (r.peers.has(peerId)) {
        room = r;
        break;
      }
    }

    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    // Update database
    await db.update(voiceVideoParticipants)
      .set({ leftAt: new Date() })
      .where(and(
        eq(voiceVideoParticipants.sessionId, room.sessionId),
        eq(voiceVideoParticipants.userId, peer.userId)
      ));

    room.peers.delete(peerId);
    this.peerSocketMap.delete(socket);

    // Notify other peers
    this.broadcastToPeers(room, peerId, {
      type: 'peer-left',
      peerId,
    });

    // If room is empty or host left, end session
    if (room.peers.size === 0 || peer.userId === room.hostId) {
      await this.endSession(room.id);
    }
  }

  async handleSignaling(socket: WebSocket, data: any) {
    const senderId = this.peerSocketMap.get(socket);
    if (!senderId) return;

    const room = this.getRoomByPeerId(senderId);
    if (!room) return;

    const targetPeer = room.peers.get(data.targetPeerId);
    if (!targetPeer) return;

    this.sendToPeer(targetPeer, {
      type: data.type,
      senderId,
      data: data.data,
    });
  }

  async toggleAudio(socket: WebSocket, enabled: boolean) {
    const peerId = this.peerSocketMap.get(socket);
    if (!peerId) return;

    const room = this.getRoomByPeerId(peerId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    peer.audioEnabled = enabled;

    this.broadcastToPeers(room, peerId, {
      type: 'audio-toggle',
      peerId,
      enabled,
    });
  }

  async toggleVideo(socket: WebSocket, enabled: boolean) {
    const peerId = this.peerSocketMap.get(socket);
    if (!peerId) return;

    const room = this.getRoomByPeerId(peerId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    peer.videoEnabled = enabled;

    this.broadcastToPeers(room, peerId, {
      type: 'video-toggle',
      peerId,
      enabled,
    });
  }

  async startScreenShare(socket: WebSocket) {
    const peerId = this.peerSocketMap.get(socket);
    if (!peerId) return;

    const room = this.getRoomByPeerId(peerId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    peer.screenSharing = true;

    this.broadcastToPeers(room, peerId, {
      type: 'screen-share-started',
      peerId,
    });
  }

  async stopScreenShare(socket: WebSocket) {
    const peerId = this.peerSocketMap.get(socket);
    if (!peerId) return;

    const room = this.getRoomByPeerId(peerId);
    if (!room) return;

    const peer = room.peers.get(peerId);
    if (!peer) return;

    peer.screenSharing = false;

    this.broadcastToPeers(room, peerId, {
      type: 'screen-share-stopped',
      peerId,
    });
  }

  async startRecording(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    if (userId !== room.hostId) {
      throw new Error('Only host can start recording');
    }

    room.recording = true;
    
    await db.update(voiceVideoSessions)
      .set({ recordingEnabled: true })
      .where(eq(voiceVideoSessions.id, room.sessionId));

    // In production, initialize actual recording here
    // For now, we'll simulate it
    
    this.broadcastToRoom(room, {
      type: 'recording-started',
    });
  }

  async stopRecording(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    if (userId !== room.hostId) {
      throw new Error('Only host can stop recording');
    }

    room.recording = false;

    // In production, stop recording and upload to storage
    const recordingUrl = `https://recordings.e-code.ai/${room.sessionId}.webm`;

    await db.update(voiceVideoSessions)
      .set({ 
        recordingEnabled: false,
        recordingUrl,
      })
      .where(eq(voiceVideoSessions.id, room.sessionId));

    this.broadcastToRoom(room, {
      type: 'recording-stopped',
      recordingUrl,
    });
  }

  private async endSession(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    await db.update(voiceVideoSessions)
      .set({ 
        status: 'ended',
        endedAt: new Date(),
      })
      .where(eq(voiceVideoSessions.id, room.sessionId));

    // Notify all peers
    this.broadcastToRoom(room, {
      type: 'session-ended',
    });

    // Clean up
    for (const peer of room.peers.values()) {
      this.peerSocketMap.delete(peer.socket);
    }
    
    this.rooms.delete(roomId);
  }

  private getRoomByPeerId(peerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.peers.has(peerId)) {
        return room;
      }
    }
    return undefined;
  }

  private sendToPeer(peer: Peer, message: any) {
    // Use numeric constant 1 for OPEN state (ws wrapper doesn't export OPEN)
    if (peer.socket.readyState === 1) {
      peer.socket.send(JSON.stringify(message));
    }
  }

  private broadcastToPeers(room: Room, excludePeerId: string, message: any) {
    for (const [peerId, peer] of room.peers) {
      if (peerId !== excludePeerId) {
        this.sendToPeer(peer, message);
      }
    }
  }

  private broadcastToRoom(room: Room, message: any) {
    for (const peer of room.peers.values()) {
      this.sendToPeer(peer, message);
    }
  }

  async getActiveSessions(projectId: number) {
    return await db.select()
      .from(voiceVideoSessions)
      .where(and(
        eq(voiceVideoSessions.projectId, projectId),
        eq(voiceVideoSessions.status, 'active')
      ));
  }

  async getSessionParticipants(sessionId: number) {
    return await db.select()
      .from(voiceVideoParticipants)
      .where(eq(voiceVideoParticipants.sessionId, sessionId));
  }

  getSession(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  async getSessionStats(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    const participants = await this.getSessionParticipants(room.sessionId);

    return {
      roomId,
      sessionId: room.sessionId,
      type: room.type,
      currentParticipants: room.peers.size,
      totalParticipants: participants.length,
      isRecording: room.recording,
      startedAt: participants[0]?.joinedAt,
      participants: Array.from(room.peers.values()).map(p => ({
        id: p.id,
        userId: p.userId,
        username: p.username,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
        screenSharing: p.screenSharing
      }))
    };
  }
}

// Export singleton instance
export const voiceVideoService = new VoiceVideoService();