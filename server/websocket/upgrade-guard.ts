/**
 * WebSocket Upgrade Guard - Production-Ready Socket Management
 * 
 * Implements the kUpgradeHandled symbol pattern to prevent orphan socket leaks
 * while maintaining compatibility with multiple WebSocket services.
 * 
 * Architecture (Nov 20, 2025):
 * 1. Each WebSocket service marks sockets as handled: socket[kUpgradeHandled] = true
 * 2. Final catch-all guard destroys untagged sockets after deferred check
 * 3. Prevents resource exhaustion from typos, probing, malicious requests
 * 
 * @see Architect feedback: Fortune 500-safe pattern for multi-service environments
 */

import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { Duplex } from 'stream';
import { createLogger } from '../utils/logger';

const logger = createLogger('upgrade-guard');

/**
 * Symbol used to mark sockets that have been successfully upgraded
 * All WebSocket services MUST set this on successful handshake
 */
export const kUpgradeHandled = Symbol('websocket.upgrade.handled');

/**
 * TypeScript augmentation note:
 * We use `as any` casting for kUpgradeHandled access since Socket.Duplex
 * types don't support symbol indexing. This is intentional for flexibility
 * in handling both Socket and Duplex streams from HTTP upgrade events.
 */

/**
 * Mark a socket as successfully handled by a WebSocket service
 * 
 * Tags BOTH the request.socket and raw socket (if provided) to handle
 * the case where ws library nulls out request.socket before the connection callback
 * 
 * @param request - HTTP upgrade request
 * @param socket - Raw TCP socket (optional, for upgrade handlers)
 * 
 * @example
 * // In upgrade handler (preferred - tags both)
 * httpServer.prependListener('upgrade', (request, socket, head) => {
 *   markSocketAsHandled(request, socket);
 *   wss.handleUpgrade(request, socket, head, ...);
 * });
 * 
 * // In connection handler (fallback - only tags request.socket if still available)
 * wss.on('connection', (ws, request) => {
 *   markSocketAsHandled(request);
 * });
 */
export function markSocketAsHandled(request: IncomingMessage, socket?: Socket | Duplex): void {
  // Tag the request.socket (if still available)
  if (request.socket) {
    (request.socket as any)[kUpgradeHandled] = true;
  }
  
  // Tag the raw socket (critical for upgrade handlers)
  if (socket) {
    (socket as any)[kUpgradeHandled] = true;
  }
}

/**
 * Check if a socket has been marked as handled
 * 
 * Checks BOTH request.socket and raw socket (if provided) to handle
 * the case where ws library nulls out request.socket
 * 
 * @param request - HTTP upgrade request
 * @param socket - Raw TCP socket (optional, for upgrade guards)
 * @returns true if the socket has been marked as handled
 */
export function isSocketHandled(request: IncomingMessage, socket?: Socket | Duplex): boolean {
  // Check request.socket first (most common case)
  if (request.socket && (request.socket as any)[kUpgradeHandled] === true) {
    return true;
  }
  
  // Fallback to raw socket (for upgrade guards where request.socket is null)
  if (socket && (socket as any)[kUpgradeHandled] === true) {
    return true;
  }
  
  return false;
}

/**
 * Wrap a WebSocketServer to auto-mark sockets as handled
 * Use this for services using standard { server, path } mode
 * 
 * @param wss - WebSocketServer instance
 * @returns The same instance with auto-tagging enabled
 * 
 * @example
 * const wss = new WebSocketServer({ server, path: '/terminal' });
 * wrapWebSocketServer(wss); // Auto-tags all connections
 */
export function wrapWebSocketServer(wss: any): any {
  const originalConnectionHandler = wss.on.bind(wss);
  
  wss.on = function(event: string, handler: any) {
    if (event === 'connection') {
      // Wrap the connection handler to auto-tag sockets
      const wrappedHandler = (ws: any, req: IncomingMessage) => {
        markSocketAsHandled(req);
        handler(ws, req);
      };
      return originalConnectionHandler('connection', wrappedHandler);
    }
    return originalConnectionHandler(event, handler);
  };
  
  return wss;
}

// Paths that use { server, path } mode in WebSocketServer or Socket.IO
// These paths are handled internally by ws library or Socket.IO and don't use manual socket marking
// The upgrade guard must skip these to avoid destroying valid connections
// NOTE: /ws/agent now uses noServer + central dispatcher + markSocketAsHandled, so it's removed from this list
// NOTE: /ws/background-tests now uses noServer + central dispatcher + markSocketAsHandled (Dec 6, 2025)
// NOTE: /api/runtime/logs/ws now uses noServer + central dispatcher + markSocketAsHandled
// NOTE: All collaboration WebSocket paths now use noServer + central dispatcher (Dec 6, 2025):
//       - /ws/yjs, /collaborate, /yjs, /collaboration, /ws/collaboration
const WS_MANAGED_PATHS = new Set([
  '/socket.io',             // Socket.IO default path
  '/socket.io/',            // Socket.IO with trailing slash
]);

/**
 * Check if the request is a Vite HMR connection
 * Vite HMR connects on "/" with a token parameter
 */
function isViteHMRConnection(request: IncomingMessage): boolean {
  try {
    const url = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);
    // Vite HMR uses / path with a token query parameter
    if (url.pathname === '/' && url.searchParams.has('token')) {
      return true;
    }
    return false;
  } catch (err: any) { console.error("[catch]", err?.message || err);
    return false;
  }
}

/**
 * Final catch-all upgrade guard that destroys untagged sockets
 * 
 * Register this LAST after all WebSocket services to prevent socket leaks
 * Uses setImmediate to allow all legitimate handlers to tag their sockets first
 * 
 * @param request - HTTP upgrade request
 * @param socket - TCP socket
 * 
 * @example
 * httpServer.on('upgrade', installFinalUpgradeGuard);
 */
export function installFinalUpgradeGuard(
  request: IncomingMessage,
  socket: Socket
): void {
  const pathname = extractPathname(request);
  
  // ✅ CRITICAL FIX (Dec 1, 2025): Skip paths managed by WebSocketServer { server, path } mode
  // These services use ws library's built-in upgrade handling which doesn't mark sockets
  if (WS_MANAGED_PATHS.has(pathname)) {
    logger.debug(`[Upgrade Guard] Skipping ${pathname} - managed by ws library`);
    return;
  }
  
  // ✅ FIX (Dec 10, 2025): Skip Vite HMR connections on "/" with token parameter
  // These are legitimate development connections handled by Vite internally
  if (isViteHMRConnection(request)) {
    logger.debug(`[Upgrade Guard] Skipping Vite HMR connection on ${pathname}`);
    return;
  }
  
  // ✅ DEBUG LOGGING (Nov 20, 2025): Track socket handling lifecycle
  logger.debug(`[Upgrade Guard] Checking socket for ${pathname} (remoteAddress: ${socket.remoteAddress})`);
  logger.debug(`[Upgrade Guard] request.socket marked: ${!!(request.socket as any)?.[kUpgradeHandled]}`);
  logger.debug(`[Upgrade Guard] raw socket marked: ${!!(socket as any)?.[kUpgradeHandled]}`);
  
  // Defer check to next tick to allow all upgrade handlers to run first
  setImmediate(() => {
    // Check both request.socket and raw socket (ws library may null out request.socket)
    const isHandled = isSocketHandled(request, socket);
    
    logger.debug(`[Upgrade Guard] setImmediate check for ${pathname}: isHandled=${isHandled}`);
    logger.debug(`[Upgrade Guard] setImmediate - request.socket marked: ${!!(request.socket as any)?.[kUpgradeHandled]}`);
    logger.debug(`[Upgrade Guard] setImmediate - raw socket marked: ${!!(socket as any)?.[kUpgradeHandled]}`);
    
    if (!isHandled) {
      logger.warn(`[Upgrade Guard] Destroying unhandled WebSocket upgrade: ${pathname}`);
      
      // Send HTTP 404 response before destroying socket
      socket.write(
        'HTTP/1.1 404 Not Found\r\n' +
        'Connection: close\r\n' +
        'Content-Type: text/plain\r\n' +
        'Content-Length: 28\r\n' +
        '\r\n' +
        'WebSocket endpoint not found'
      );
      
      socket.destroy();
    } else {
      logger.debug(`[Upgrade Guard] Socket for ${pathname} is correctly handled - preserving`);
    }
  });
}

/**
 * Safe pathname extraction with fallback
 * Prevents crashes on malformed upgrade requests
 */
function extractPathname(request: IncomingMessage): string {
  try {
    const url = new URL(request.url!, `http://${request.headers.host || 'localhost'}`);
    return url.pathname;
  } catch (error) {
    return request.url || '<unknown>';
  }
}
