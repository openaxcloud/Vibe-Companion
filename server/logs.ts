import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { log } from './vite';
import { attachToProjectLogs } from './runtime';

// Set up WebSocket server for project logs
export function setupLogsWebsocket(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/logs'
  });
  
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const projectId = url.searchParams.get('projectId');
    
    if (!projectId) {
      ws.close(1008, 'Missing projectId parameter');
      return;
    }
    
    log(`Logs client connected for project ${projectId}`, 'logs');
    
    // Attach to project logs
    const detachLogs = attachToProjectLogs(
      parseInt(projectId),
      // On stdout
      (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'stdout',
            content: data
          }));
        }
      },
      // On stderr
      (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'stderr',
            content: data
          }));
        }
      }
    );
    
    // Handle client disconnect
    ws.on('close', () => {
      detachLogs();
      log(`Logs client disconnected for project ${projectId}`, 'logs');
    });
    
    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connected',
      projectId: parseInt(projectId)
    }));
  });
  
  return wss;
}