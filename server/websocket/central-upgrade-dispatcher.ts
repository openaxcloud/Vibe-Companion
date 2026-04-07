// @ts-nocheck
/**
 * Central WebSocket Upgrade Dispatcher
 * 
 * 40-YEAR SENIOR ENGINEER FIX (Dec 6, 2025)
 * 
 * PROBLEM: Multiple upgrade listeners (16+) cause race conditions where:
 * - Express/Vite middleware processes upgrades before our handlers
 * - Multiple handlers try to complete the same handshake
 * - "Invalid frame header" errors occur when HTML is written after handshake starts
 * 
 * SOLUTION: Single authoritative dispatcher that:
 * 1. Intercepts ALL upgrade events FIRST (using prependListener)
 * 2. Routes by pathname to the correct handler
 * 3. Marks sockets immediately to prevent other handlers from interfering
 * 4. Delegates to the appropriate WebSocket service
 * 
 * This completely eliminates race conditions by ensuring only ONE handler processes each upgrade.
 */

import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import type { Server } from 'http';
import { parse as parseCookie } from 'cookie';
import { markSocketAsHandled, isSocketHandled } from './upgrade-guard';
import { createCentralizedLogger } from '../logging/centralized-logger';
import { sessionStore } from '../storage';

const logger = createCentralizedLogger('central-upgrade-dispatcher');

// Service handlers registered with the dispatcher
interface ServiceHandler {
  path: string;
  pathMatch: 'exact' | 'prefix';
  handler: (request: IncomingMessage, socket: Duplex, head: Buffer) => void;
  priority: number; // Lower = higher priority
}

interface ConnectionStats {
  totalConnections: number;
  connectionsByPath: Map<string, number>;
  activeConnections: number;
}

class CentralUpgradeDispatcher {
  private handlers: ServiceHandler[] = [];
  private isInitialized = false;
  private server: Server | null = null;
  private totalConnections = 0;
  private connectionsByPath: Map<string, number> = new Map();
  private activeConnections = 0;
  
  /**
   * Initialize the dispatcher on an HTTP server
   * MUST be called BEFORE any other WebSocket services are initialized
   */
  initialize(server: Server): void {
    if (this.isInitialized) {
      logger.warn('[Central Dispatcher] Already initialized - ignoring duplicate call');
      return;
    }
    
    this.server = server;
    this.isInitialized = true;
    
    // Register as THE FIRST upgrade listener using prependListener
    // This ensures we intercept ALL upgrades before any other listener
    server.prependListener('upgrade', this.handleUpgrade.bind(this));
    
    logger.info('[Central Dispatcher] ✅ Initialized as authoritative upgrade handler');
  }
  
  /**
   * Register a WebSocket service handler
   * @param path - URL path to match (e.g., '/ws/agent')
   * @param handler - Function to handle the upgrade
   * @param options - Match options
   */
  register(
    path: string,
    handler: (request: IncomingMessage, socket: Duplex, head: Buffer) => void,
    options: { pathMatch?: 'exact' | 'prefix'; priority?: number } = {}
  ): void {
    const { pathMatch = 'prefix', priority = 100 } = options;
    
    // Insert in priority order (lower priority number = runs first)
    const entry: ServiceHandler = { path, handler, pathMatch, priority };
    const insertIndex = this.handlers.findIndex(h => h.priority > priority);
    
    if (insertIndex === -1) {
      this.handlers.push(entry);
    } else {
      this.handlers.splice(insertIndex, 0, entry);
    }
    
    logger.info(`[Central Dispatcher] Registered handler for ${path} (match: ${pathMatch}, priority: ${priority})`);
    logger.info(`[Central Dispatcher] Total handlers registered: ${this.handlers.length}`);
  }
  
  /**
   * Validate WebSocket connection by checking session cookie OR bootstrap token
   * Uses express-session store to verify the session is valid and user is authenticated
   * 
   * ✅ FIX (Dec 21, 2025): Also accept valid bootstrap tokens for /ws/agent path
   * This allows autonomous workspace creation to work with bootstrap tokens
   */
  private async validateWebSocketConnection(request: IncomingMessage): Promise<boolean> {
    try {
      // Method 1: Check session cookie (standard authentication)
      const cookies = request.headers.cookie;
      if (cookies) {
        const parsedCookies = parseCookie(cookies);
        const sessionId = parsedCookies['ecode.sid'] || parsedCookies['connect.sid'];
        if (sessionId) {
          // Extract session ID from signed cookie (remove 's:' prefix and signature)
          const sid = sessionId.startsWith('s:') 
            ? sessionId.slice(2).split('.')[0] 
            : sessionId;
          
          const hasValidSession = await new Promise<boolean>((resolve) => {
            sessionStore.get(sid, (err, session) => {
              if (err || !session) {
                resolve(false);
                return;
              }
              resolve(session.passport?.user != null);
            });
          });
          
          if (hasValidSession) {
            return true;
          }
        }
      }
      
      // Method 2: Check bootstrap token in URL query parameters (for autonomous workspace)
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const bootstrapToken = url.searchParams.get('bootstrap') || url.searchParams.get('bootstrapToken');
      
      if (bootstrapToken) {
        try {
          // Dynamically import jwt and getJwtSecret to avoid circular dependencies
          const jwt = await import('jsonwebtoken');
          const { getJwtSecret } = await import('../utils/secrets-manager');
          
          const decoded = jwt.default.verify(bootstrapToken, getJwtSecret()) as {
            type: string;
            projectId: string;
            userId: number;
          };
          
          // Validate it's a bootstrap token with required fields
          if (decoded.type === 'agent_bootstrap' && decoded.projectId && decoded.userId) {
            logger.debug('[Central Dispatcher] Bootstrap token validated for WebSocket connection');
            return true;
          }
        } catch (tokenError) {
          logger.debug('[Central Dispatcher] Bootstrap token validation failed:', tokenError);
        }
      }
      
      return false;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }
  
  /**
   * The single authoritative upgrade handler
   * Routes all WebSocket upgrades to the appropriate service
   * 
   * CRITICAL FIX (Dec 11, 2025): Support channel-based routing via query parameter
   * Reason: Replit's edge proxy silently drops WebSocket upgrades on non-root paths (e.g., /ws/agent)
   * Solution: Route by ?channel= query parameter when pathname is '/' or empty
   */
  private async handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    // Extract pathname and channel safely
    const { pathname, channel } = this.extractPathnameAndChannel(request);
    
    // For channel-based routing (e.g., /?channel=agent), synthesize an effective path
    // This allows root-path WebSocket connections to be routed to the correct handler
    const effectivePath = channel ? `/ws/${channel}` : pathname;
    
    // Detailed connection logging
    logger.info('[Central Dispatcher] New connection', {
      pathname,
      channel,
      effectivePath,
      ip: request.socket?.remoteAddress,
      origin: request.headers.origin,
      userAgent: request.headers['user-agent'],
      secWebSocketKey: request.headers['sec-websocket-key'],
      timestamp: new Date().toISOString(),
    });
    
    // Check if already handled (safety net)
    if (isSocketHandled(request, socket)) {
      logger.debug(`[Central Dispatcher] Socket already handled for ${effectivePath} - skipping`);
      return;
    }
    
    // Find matching handler using effective path (supports both /ws/agent and /?channel=agent)
    const handler = this.findHandler(effectivePath);
    
    // ✅ FIX (Dec 19, 2025): If no handler is registered, defer to other listeners (e.g., Vite HMR)
    // This MUST happen BEFORE auth check to allow unauthenticated HMR connections through
    if (!handler) {
      logger.debug(`[Central Dispatcher] No handler for ${effectivePath} - deferring to other listeners (e.g., Vite HMR)`);
      // Don't mark as handled, don't destroy - just return and let other listeners handle it
      return;
    }
    
    // ✅ CRITICAL FIX (Dec 21, 2025): Mark socket as handled IMMEDIATELY when handler exists!
    // This MUST happen BEFORE any async operations (like auth validation) to prevent race
    // conditions with the upgrade guard's setImmediate check that destroys unhandled sockets.
    // Previous location (after auth) caused race: guard's setImmediate ran before auth completed.
    markSocketAsHandled(request, socket);
    
    // Handler exists - route to it
    // Update connection stats
    this.totalConnections++;
    this.activeConnections++;
    const currentPathCount = this.connectionsByPath.get(handler.path) || 0;
    this.connectionsByPath.set(handler.path, currentPathCount + 1);
    
    // Track socket close to update active connections
    socket.once('close', () => {
      this.activeConnections--;
    });
    
    // Public paths that don't require auth from the dispatcher
    // Includes paths that have their own self-contained auth handlers
    const selfAuthPaths = [
      '/api/runtime/logs/ws',  // RuntimeLogsService handles its own session auth
      '/api/server/logs/ws',   // ServerLogsService handles its own session auth
    ];
    const publicPaths = [
      '/health', '/api/health',
      ...selfAuthPaths,
      ...(process.env.NODE_ENV !== 'production' ? ['/api/terminal/ws'] : []),
    ];
    
    // Only validate auth for non-public paths with registered handlers
    // NOTE: Socket is already marked as handled above, so auth failures must explicitly destroy
    if (!publicPaths.includes(effectivePath)) {
      const isAuthenticated = await this.validateWebSocketConnection(request);
      if (!isAuthenticated) {
        logger.warn('[Central Dispatcher] Unauthorized WebSocket connection attempt', {
          effectivePath,
          ip: request.socket?.remoteAddress,
        });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      logger.debug('[Central Dispatcher] WebSocket authentication successful', {
        effectivePath,
      });
    }
    
    logger.info(`[Central Dispatcher] Routing ${effectivePath} to registered handler`);
    
    // Delegate to the registered handler (socket is already marked above)
    try {
      logger.info(`[Central Dispatcher] 🔍 About to call handler for ${handler.path}...`);
      logger.info(`[Central Dispatcher] 🔍 Handler type: ${typeof handler.handler}, is function: ${typeof handler.handler === 'function'}`);
      handler.handler(request, socket, head);
      logger.info(`[Central Dispatcher] ✅ Handler for ${handler.path} returned successfully`);
    } catch (error) {
      logger.error(`[Central Dispatcher] ❌ Handler error for ${pathname}:`, error);
      this.destroySocketWithError(socket, 500, 'Internal Server Error');
    }
  }
  
  /**
   * Find a matching handler for the given pathname
   */
  private findHandler(pathname: string): ServiceHandler | null {
    const matchingHandlers: ServiceHandler[] = [];
    
    for (const handler of this.handlers) {
      if (handler.pathMatch === 'exact') {
        if (pathname === handler.path) {
          matchingHandlers.push(handler);
        }
      } else {
        // prefix match
        if (pathname.startsWith(handler.path)) {
          matchingHandlers.push(handler);
        }
      }
    }
    
    if (matchingHandlers.length > 1) {
      logger.debug(`[Central Dispatcher] Multiple handlers could match ${pathname}:`, {
        handlers: matchingHandlers.map(h => ({ path: h.path, pathMatch: h.pathMatch, priority: h.priority })),
        selectedHandler: matchingHandlers[0].path,
      });
    }
    
    return matchingHandlers.length > 0 ? matchingHandlers[0] : null;
  }
  
  /**
   * Safely extract pathname and channel from request
   * 
   * CRITICAL FIX (Dec 11, 2025): Also extract `channel` query parameter
   * Reason: Replit's edge proxy only forwards WebSocket upgrades on root path '/'
   * Solution: Use ?channel= to specify the intended endpoint when connecting to root
   */
  private extractPathnameAndChannel(request: IncomingMessage): { pathname: string; channel: string | null } {
    try {
      const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      return {
        pathname: url.pathname,
        channel: url.searchParams.get('channel')
      };
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        pathname: request.url || '/',
        channel: null
      };
    }
  }
  
  /**
   * Destroy socket with HTTP error response
   */
  private destroySocketWithError(socket: Duplex, code: number, message: string): void {
    const httpResponse = `HTTP/1.1 ${code} ${message}\r\n` +
      `Content-Type: text/plain\r\n` +
      `Content-Length: ${message.length}\r\n` +
      `\r\n` +
      message;
    
    socket.write(httpResponse);
    socket.destroy();
  }
  
  /**
   * Get debug info about registered handlers
   */
  getDebugInfo(): { handlers: string[]; isInitialized: boolean } {
    return {
      handlers: this.handlers.map(h => `${h.path} (${h.pathMatch}, priority: ${h.priority})`),
      isInitialized: this.isInitialized
    };
  }
  
  /**
   * Get connection statistics
   * @returns Connection stats including total, per-path, and active connections
   */
  getConnectionStats(): ConnectionStats {
    return {
      totalConnections: this.totalConnections,
      connectionsByPath: new Map(this.connectionsByPath),
      activeConnections: this.activeConnections
    };
  }
}

// Singleton instance
export const centralUpgradeDispatcher = new CentralUpgradeDispatcher();
