/**
 * WebSocket Monitoring Service
 * Real-time monitoring data streaming
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createLogger } from '../utils/logger';
import { performanceMonitoringService } from '../services/performance-monitoring';
import { alertSystem } from '../services/alert-system';
import { metricsCollector } from '../services/metrics-collector';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';

const logger = createLogger('monitoring-ws');

// W-H3: Rate limiting utility for per-client throttling
const clientThrottles = new Map<string, Map<string, number>>();

function isThrottled(clientId: string, action: string, intervalMs: number): boolean {
  const now = Date.now();
  if (!clientThrottles.has(clientId)) {
    clientThrottles.set(clientId, new Map());
  }
  const clientActions = clientThrottles.get(clientId)!;
  const lastTime = clientActions.get(action) || 0;
  if (now - lastTime < intervalMs) return true;
  clientActions.set(action, now);
  return false;
}

function cleanupClientThrottles(clientId: string): void {
  clientThrottles.delete(clientId);
}

// W-H13: Message validation helper
function validateMessage(msg: any): boolean {
  return typeof msg === 'object' && msg !== null && typeof msg.type === 'string';
}

interface MonitoringClient {
  id: string;
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastActivity: Date;
}

export class MonitoringWebSocketService {
  private wss?: WebSocketServer;
  private clients: Map<string, MonitoringClient> = new Map();
  private broadcastInterval?: NodeJS.Timeout;
  private pingInterval?: NodeJS.Timeout;
  
  constructor() {
    this.setupEventListeners();
  }

  public initialize(server: any, path: string = '/ws/monitoring') {
    this.wss = new WebSocketServer({ 
      server,
      path,
      maxPayload: 10 * 1024 * 1024 // 10MB max message size
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Start broadcasting metrics
    this.startBroadcasting();
    
    // Start ping/pong to detect disconnected clients
    this.startPingInterval();

    logger.info('Monitoring WebSocket service initialized');
  }

  private handleConnection(ws: WebSocket, req: any) {
    const clientId = this.generateClientId();
    const client: MonitoringClient = {
      id: clientId,
      ws,
      subscriptions: new Set(['metrics', 'alerts']), // Default subscriptions
      lastActivity: new Date()
    };

    this.clients.set(clientId, client);
    
    logger.info(`New monitoring client connected: ${clientId}`);
    
    // Send initial data
    this.sendInitialData(client);

    // Handle messages - W-H13: Wrap in try-catch for error handling
    ws.on('message', async (data) => {
      try {
        await this.handleMessage(client, data.toString());
      } catch (error) {
        logger.error('Error in message handler:', error);
        this.sendError(client, 'Internal error processing message');
      }
    });

    // Handle pong responses
    ws.on('pong', () => {
      client.lastActivity = new Date();
    });

    // Handle disconnect
    ws.on('close', () => {
      // W-H6: Cleanup clients Map and throttles on disconnect
      this.clients.delete(clientId);
      cleanupClientThrottles(clientId);
      logger.info(`Monitoring client disconnected: ${clientId}`);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
      // W-H6: Cleanup clients Map and throttles on error
      this.clients.delete(clientId);
      cleanupClientThrottles(clientId);
    });
  }

  private async handleMessage(client: MonitoringClient, message: string) {
    try {
      const data = JSON.parse(message);
      
      // W-H13: Validate message schema
      if (!validateMessage(data)) {
        this.sendError(client, 'Invalid message schema');
        return;
      }
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(client, data.channels);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(client, data.channels);
          break;
        case 'get_metrics':
          // W-H3: 200ms throttle on metrics requests to prevent DoS
          if (isThrottled(client.id, 'get_metrics', 200)) {
            this.sendError(client, 'Rate limit exceeded, please slow down');
            break;
          }
          await this.handleGetMetrics(client, data.options);
          break;
        case 'get_alerts':
          this.handleGetAlerts(client);
          break;
        case 'acknowledge_alert':
          await this.handleAcknowledgeAlert(client, data.alertId, data.userId);
          break;
        case 'mute_alert':
          this.handleMuteAlert(client, data.alertId, data.duration);
          break;
        case 'ping':
          this.sendMessage(client, { type: 'pong', timestamp: Date.now() });
          break;
        case 'auth':
          await this.handleAuth(client, data);
          break;
        default:
          logger.warn(`Unknown message type: ${data.type}`);
      }
      
      client.lastActivity = new Date();
    } catch (error) {
      logger.error('Failed to handle message:', error);
      this.sendError(client, 'Invalid message format');
    }
  }

  private handleSubscribe(client: MonitoringClient, channels: string[]) {
    channels.forEach(channel => {
      client.subscriptions.add(channel);
    });
    
    this.sendMessage(client, {
      type: 'subscribed',
      channels,
      timestamp: Date.now()
    });
  }

  private handleUnsubscribe(client: MonitoringClient, channels: string[]) {
    channels.forEach(channel => {
      client.subscriptions.delete(channel);
    });
    
    this.sendMessage(client, {
      type: 'unsubscribed',
      channels,
      timestamp: Date.now()
    });
  }

  private async handleAuth(client: MonitoringClient, data: any) {
    try {
      if (!data.token) {
        this.sendError(client, 'Authentication token required');
        return;
      }

      let decoded: { userId: number };
      try {
        decoded = jwt.verify(data.token, process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET not configured'); })() : 'dev-secret')) as { userId: number };
      } catch (jwtError) {
        logger.warn('JWT verification failed:', jwtError);
        this.sendError(client, 'Invalid or expired token');
        return;
      }

      const user = await storage.getUser(decoded.userId);
      if (!user) {
        this.sendError(client, 'User not found');
        return;
      }

      client.userId = String(user.id);
      logger.info(`Client ${client.id} authenticated as user ${user.id} (${user.username})`);
      
      this.sendMessage(client, {
        type: 'auth_success',
        data: { userId: user.id, username: user.username },
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Authentication error:', error);
      this.sendError(client, 'Authentication failed');
    }
  }

  private async handleGetMetrics(client: MonitoringClient, options: any = {}) {
    const metrics = await performanceMonitoringService.getMetrics(options.timeRange);
    const summary = metricsCollector.getMetricsSummary();
    
    this.sendMessage(client, {
      type: 'metrics_snapshot',
      data: {
        current: summary,
        history: metrics
      },
      timestamp: Date.now()
    });
  }

  private handleGetAlerts(client: MonitoringClient) {
    const activeAlerts = alertSystem.getActiveAlerts();
    const alertRules = alertSystem.getAlertRules();
    
    this.sendMessage(client, {
      type: 'alerts_snapshot',
      data: {
        active: activeAlerts,
        rules: alertRules
      },
      timestamp: Date.now()
    });
  }

  private async handleAcknowledgeAlert(client: MonitoringClient, alertId: string, userId: string) {
    try {
      const alert = await alertSystem.acknowledgeAlert(alertId, userId);
      
      // Broadcast to all clients
      this.broadcast({
        type: 'alert_acknowledged',
        data: alert,
        timestamp: Date.now()
      }, 'alerts');
      
    } catch (error) {
      this.sendError(client, `Failed to acknowledge alert: ${error.message}`);
    }
  }

  private handleMuteAlert(client: MonitoringClient, alertId: string, duration?: number) {
    alertSystem.muteAlert(alertId, duration);
    
    this.broadcast({
      type: 'alert_muted',
      data: { alertId, duration },
      timestamp: Date.now()
    }, 'alerts');
  }

  private sendInitialData(client: MonitoringClient) {
    // Send current metrics
    if (client.subscriptions.has('metrics')) {
      this.handleGetMetrics(client);
    }
    
    // Send active alerts
    if (client.subscriptions.has('alerts')) {
      this.handleGetAlerts(client);
    }
  }

  private setupEventListeners() {
    // Listen to performance monitoring events
    performanceMonitoringService.on('metrics', (metrics) => {
      this.broadcast({
        type: 'metrics_update',
        data: metrics,
        timestamp: Date.now()
      }, 'metrics');
    });

    // Listen to alert events
    alertSystem.on('alert_triggered', (alert) => {
      this.broadcast({
        type: 'alert_triggered',
        data: alert,
        timestamp: Date.now()
      }, 'alerts');
    });

    alertSystem.on('alert_resolved', (alert) => {
      this.broadcast({
        type: 'alert_resolved',
        data: alert,
        timestamp: Date.now()
      }, 'alerts');
    });

    alertSystem.on('inapp_notification', (notification) => {
      this.broadcast({
        type: 'notification',
        data: notification,
        timestamp: Date.now()
      }, 'notifications');
    });
  }

  private startBroadcasting() {
    // Broadcast metrics every second
    this.broadcastInterval = setInterval(() => {
      const summary = metricsCollector.getMetricsSummary();
      
      this.broadcast({
        type: 'metrics_realtime',
        data: summary,
        timestamp: Date.now()
      }, 'metrics');
      
    }, 1000);
  }

  private startPingInterval() {
    // Ping clients every 30 seconds
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute timeout
      
      this.clients.forEach((client, id) => {
        // Check for inactive clients
        if (now - client.lastActivity.getTime() > timeout) {
          logger.warn(`Client ${id} timed out, disconnecting`);
          client.ws.close();
          this.clients.delete(id);
        } else {
          // Send ping
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        }
      });
      
      // Update metrics
      metricsCollector.updateWebSocketConnections(this.clients.size);
      
    }, 30000);
  }

  private broadcast(message: any, channel?: string) {
    const messageStr = JSON.stringify(message);
    let broadcastCount = 0;
    
    this.clients.forEach(client => {
      // Check if client is subscribed to the channel
      if (!channel || client.subscriptions.has(channel)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
          broadcastCount++;
        }
      }
    });
    
    if (broadcastCount > 0) {
      metricsCollector.recordWebSocketEvent('broadcast');
    }
  }

  private sendMessage(client: MonitoringClient, message: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
      metricsCollector.recordWebSocketEvent('send');
    }
  }

  private sendError(client: MonitoringClient, error: string) {
    this.sendMessage(client, {
      type: 'error',
      error,
      timestamp: Date.now()
    });
  }

  private generateClientId(): string {
    return `monitoring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getClientCount(): number {
    return this.clients.size;
  }

  public getClientInfo(): any[] {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      userId: client.userId,
      subscriptions: Array.from(client.subscriptions),
      lastActivity: client.lastActivity,
      connected: client.ws.readyState === WebSocket.OPEN
    }));
  }

  public stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Close all connections
    this.clients.forEach(client => {
      client.ws.close();
    });
    
    this.clients.clear();
    
    if (this.wss) {
      this.wss.close();
    }
    
    logger.info('Monitoring WebSocket service stopped');
  }
}

export const monitoringWebSocketService = new MonitoringWebSocketService();