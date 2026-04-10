import { createLogger } from '../utils/logger';

const logger = createLogger('ws-metrics');

interface WebSocketMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsPerService: Map<string, number>;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  bytesReceived: number;
  bytesSent: number;
  lastUpdated: Date;
}

interface ServiceMetric {
  connections: number;
  messagesIn: number;
  messagesOut: number;
  errors: number;
  bytesIn: number;
  bytesOut: number;
  lastActivity: Date;
}

class WsMetricsCollector {
  private metrics: WebSocketMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    connectionsPerService: new Map(),
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0,
    bytesReceived: 0,
    bytesSent: 0,
    lastUpdated: new Date(),
  };

  private serviceMetrics: Map<string, ServiceMetric> = new Map();
  private histogramBuckets = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  recordConnection(service: string): void {
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;
    this.metrics.lastUpdated = new Date();
    
    const current = this.metrics.connectionsPerService.get(service) || 0;
    this.metrics.connectionsPerService.set(service, current + 1);
    
    const sm = this.getOrCreateServiceMetric(service);
    sm.connections++;
    sm.lastActivity = new Date();

    logger.debug(`[WS Metrics] Connection opened for ${service}, total active: ${this.metrics.activeConnections}`);
  }

  recordDisconnection(service: string): void {
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    this.metrics.lastUpdated = new Date();
    
    const current = this.metrics.connectionsPerService.get(service) || 1;
    this.metrics.connectionsPerService.set(service, Math.max(0, current - 1));

    logger.debug(`[WS Metrics] Connection closed for ${service}, total active: ${this.metrics.activeConnections}`);
  }

  recordMessageReceived(service: string, bytes: number = 0): void {
    this.metrics.messagesReceived++;
    this.metrics.bytesReceived += bytes;
    this.metrics.lastUpdated = new Date();
    
    const sm = this.getOrCreateServiceMetric(service);
    sm.messagesIn++;
    sm.bytesIn += bytes;
    sm.lastActivity = new Date();
  }

  recordMessageSent(service: string, bytes: number = 0): void {
    this.metrics.messagesSent++;
    this.metrics.bytesSent += bytes;
    this.metrics.lastUpdated = new Date();
    
    const sm = this.getOrCreateServiceMetric(service);
    sm.messagesOut++;
    sm.bytesOut += bytes;
    sm.lastActivity = new Date();
  }

  recordError(service: string): void {
    this.metrics.errors++;
    this.metrics.lastUpdated = new Date();
    
    const sm = this.getOrCreateServiceMetric(service);
    sm.errors++;
  }

  private getOrCreateServiceMetric(service: string): ServiceMetric {
    if (!this.serviceMetrics.has(service)) {
      this.serviceMetrics.set(service, {
        connections: 0,
        messagesIn: 0,
        messagesOut: 0,
        errors: 0,
        bytesIn: 0,
        bytesOut: 0,
        lastActivity: new Date(),
      });
    }
    return this.serviceMetrics.get(service)!;
  }

  getPrometheusMetrics(): string {
    const lines: string[] = [];
    
    lines.push('# HELP ws_connections_total Total WebSocket connections');
    lines.push('# TYPE ws_connections_total counter');
    lines.push(`ws_connections_total ${this.metrics.totalConnections}`);
    
    lines.push('# HELP ws_connections_active Current active WebSocket connections');
    lines.push('# TYPE ws_connections_active gauge');
    lines.push(`ws_connections_active ${this.metrics.activeConnections}`);
    
    lines.push('# HELP ws_connections_by_service Active connections per service');
    lines.push('# TYPE ws_connections_by_service gauge');
    for (const [service, count] of this.metrics.connectionsPerService) {
      lines.push(`ws_connections_by_service{service="${service}"} ${count}`);
    }
    
    lines.push('# HELP ws_messages_received_total Total messages received');
    lines.push('# TYPE ws_messages_received_total counter');
    lines.push(`ws_messages_received_total ${this.metrics.messagesReceived}`);
    
    lines.push('# HELP ws_messages_sent_total Total messages sent');
    lines.push('# TYPE ws_messages_sent_total counter');
    lines.push(`ws_messages_sent_total ${this.metrics.messagesSent}`);
    
    lines.push('# HELP ws_errors_total Total WebSocket errors');
    lines.push('# TYPE ws_errors_total counter');
    lines.push(`ws_errors_total ${this.metrics.errors}`);
    
    lines.push('# HELP ws_bytes_received_total Total bytes received');
    lines.push('# TYPE ws_bytes_received_total counter');
    lines.push(`ws_bytes_received_total ${this.metrics.bytesReceived}`);
    
    lines.push('# HELP ws_bytes_sent_total Total bytes sent');
    lines.push('# TYPE ws_bytes_sent_total counter');
    lines.push(`ws_bytes_sent_total ${this.metrics.bytesSent}`);
    
    return lines.join('\n');
  }

  getMetricsSummary(): object {
    return {
      total: this.metrics.totalConnections,
      active: this.metrics.activeConnections,
      byService: Object.fromEntries(this.metrics.connectionsPerService),
      messagesReceived: this.metrics.messagesReceived,
      messagesSent: this.metrics.messagesSent,
      errors: this.metrics.errors,
      bytesReceived: this.metrics.bytesReceived,
      bytesSent: this.metrics.bytesSent,
      lastUpdated: this.metrics.lastUpdated.toISOString(),
    };
  }

  getServiceMetrics(service: string): ServiceMetric | undefined {
    return this.serviceMetrics.get(service);
  }

  reset(): void {
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      connectionsPerService: new Map(),
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      bytesReceived: 0,
      bytesSent: 0,
      lastUpdated: new Date(),
    };
    this.serviceMetrics.clear();
  }
}

export const wsMetrics = new WsMetricsCollector();

export function generateDeterministicColor(userId: string): string {
  const colors = [
    '#F26207', '#3B82F6', '#8B5CF6', '#10B981', '#EF4444',
    '#F59E0B', '#EC4899', '#14B8A6', '#6366F1', '#84CC16',
    '#0EA5E9', '#D946EF', '#22C55E', '#F97316', '#A855F7',
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
}
