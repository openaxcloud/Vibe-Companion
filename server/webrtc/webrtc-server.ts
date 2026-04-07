// @ts-nocheck
/**
 * WebRTC Server Setup
 * Initializes WebSocket server for WebRTC signaling and peer connections
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { VoiceVideoService } from './voice-video-service';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  username?: string;
  roomId?: string;
  isAlive?: boolean;
}

export function setupWebRTCServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: '/webrtc',
  });

  const voiceVideoService = new VoiceVideoService();

  wss.on('connection', async (ws: AuthenticatedWebSocket, request: any) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const userId = parseInt(url.searchParams.get('userId') || '0');
    const username = url.searchParams.get('username') || 'Anonymous';
    const roomId = url.searchParams.get('roomId') || '';

    if (!userId || !roomId) {
      ws.close(1008, 'Missing userId or roomId');
      return;
    }

    ws.userId = userId;
    ws.username = username;
    ws.roomId = roomId;
    ws.isAlive = true;

    // Join voice/video session
    try {
      await voiceVideoService.joinSession(roomId, userId, username, ws);
    } catch (error) {
      console.error('[WebRTC] Failed to join session:', error);
      ws.close(1008, error.message);
      return;
    }

    // Handle messages
    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await voiceVideoService.handleMessage(ws, data);
      } catch (error) {
        console.error('[WebRTC] Error handling message:', error);
      }
    });

    // Handle pong for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle disconnection
    ws.on('close', async () => {
      await voiceVideoService.leaveSession(ws);
    });

    ws.on('error', async (error) => {
      console.error('[WebRTC] WebSocket error:', error);
      await voiceVideoService.leaveSession(ws);
    });
  });

  // Heartbeat to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: AuthenticatedWebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // 30 seconds

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return voiceVideoService;
}
