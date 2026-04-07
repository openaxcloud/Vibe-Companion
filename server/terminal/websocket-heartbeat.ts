/**
 * WebSocket Heartbeat Manager - Fortune 500 Monitoring
 * Detects dead connections and maintains connection health
 */

import { WebSocket } from 'ws';
import { createLogger } from '../utils/logger';

const logger = createLogger('ws-heartbeat');

// Heartbeat configuration
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 35000; // 35 seconds (slightly longer than interval)

interface HeartbeatClient {
  ws: WebSocket;
  isAlive: boolean;
  lastPing: number;
  sessionId: string;
  missedPings: number;
}

export class WebSocketHeartbeatManager {
  private clients: Map<WebSocket, HeartbeatClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metrics = {
    totalPings: 0,
    totalPongs: 0,
    deadConnectionsDetected: 0,
    activeConnections: 0
  };

  /**
   * Start heartbeat monitoring
   */
  start(): void {
    if (this.heartbeatInterval) {
      logger.warn('Heartbeat already running');
      return;
    }

    logger.info(`Starting WebSocket heartbeat (interval: ${HEARTBEAT_INTERVAL_MS}ms)`);

    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stop heartbeat monitoring
   */
  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat stopped');
    }
  }

  /**
   * Register a WebSocket client for heartbeat monitoring
   */
  registerClient(ws: WebSocket, sessionId: string): void {
    const client: HeartbeatClient = {
      ws,
      isAlive: true,
      lastPing: Date.now(),
      sessionId,
      missedPings: 0
    };

    this.clients.set(ws, client);
    this.metrics.activeConnections = this.clients.size;

    logger.debug(`Client registered for heartbeat: ${sessionId}`);

    // Listen for pong messages
    ws.on('pong', () => {
      const client = this.clients.get(ws);
      if (client) {
        client.isAlive = true;
        client.lastPing = Date.now();
        this.metrics.totalPongs++;
        logger.debug(`Pong received from ${client.sessionId}`);
      }
    });

    // Clean up on close
    ws.on('close', () => {
      this.unregisterClient(ws);
    });
  }

  /**
   * Unregister a WebSocket client
   */
  unregisterClient(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
      this.metrics.activeConnections = this.clients.size;
      logger.debug(`Client unregistered: ${client.sessionId}`);
    }
  }

  /**
   * Check heartbeats and terminate dead connections
   * Wait for 2-3 missed pings before disconnecting to handle transient network issues
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    let deadConnections = 0;
    const MAX_MISSED_PINGS = 3;

    this.clients.forEach((client, ws) => {
      // Check if connection is dead (no pong received after multiple attempts)
      if (!client.isAlive) {
        client.missedPings++;
        
        if (client.missedPings >= MAX_MISSED_PINGS) {
          const timeSinceLastPing = now - client.lastPing;
          logger.warn(`Dead connection detected: ${client.sessionId} (missed ${client.missedPings} pings, no pong for ${timeSinceLastPing}ms)`);
          
          // Terminate connection
          try {
            ws.terminate();
          } catch (error) {
            logger.error(`Failed to terminate dead connection: ${error}`);
          }
          
          this.clients.delete(ws);
          deadConnections++;
          this.metrics.deadConnectionsDetected++;
        } else {
          // Not dead yet, send another ping
          try {
            ws.ping();
            this.metrics.totalPings++;
            logger.debug(`Ping retry ${client.missedPings}/${MAX_MISSED_PINGS} for ${client.sessionId}`);
          } catch (error) {
            logger.error(`Failed to ping client ${client.sessionId}: ${error}`);
            this.clients.delete(ws);
            deadConnections++;
          }
        }
      } else {
        // Connection is alive, reset missed pings counter and send new ping
        client.isAlive = false;
        client.missedPings = 0;
        client.lastPing = now;

        try {
          ws.ping();
          this.metrics.totalPings++;
        } catch (error) {
          logger.error(`Failed to ping client ${client.sessionId}: ${error}`);
          this.clients.delete(ws);
          deadConnections++;
        }
      }
    });

    if (deadConnections > 0) {
      logger.info(`Cleaned up ${deadConnections} dead connection(s)`);
    }

    this.metrics.activeConnections = this.clients.size;
  }

  /**
   * Get heartbeat metrics
   */
  getMetrics(): {
    activeConnections: number;
    totalPings: number;
    totalPongs: number;
    deadConnectionsDetected: number;
    pongSuccessRate: string;
  } {
    const successRate = this.metrics.totalPings > 0
      ? ((this.metrics.totalPongs / this.metrics.totalPings) * 100).toFixed(2)
      : 'N/A';

    return {
      ...this.metrics,
      pongSuccessRate: successRate + '%'
    };
  }

  /**
   * Check if a client is alive
   */
  isClientAlive(ws: WebSocket): boolean {
    const client = this.clients.get(ws);
    return client ? client.isAlive : false;
  }

  /**
   * Get number of active connections
   */
  getActiveConnectionCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const websocketHeartbeatManager = new WebSocketHeartbeatManager();

// Start heartbeat monitoring
websocketHeartbeatManager.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received - stopping heartbeat');
  websocketHeartbeatManager.stop();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received - stopping heartbeat');
  websocketHeartbeatManager.stop();
});
