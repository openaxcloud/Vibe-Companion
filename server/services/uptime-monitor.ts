import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';

interface Incident {
  type: string;
  message: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

const logger = createLogger('uptime-monitor');

class UptimeMonitor extends EventEmitter {
  private readonly startedAt = Date.now();
  private readonly heartbeatInterval = parseInt(process.env.UPTIME_HEARTBEAT_INTERVAL_MS || '60000', 10);
  private incidents: Incident[] = [];
  private lastHeartbeat = Date.now();
  private totalDowntimeMs = 0;
  private outageStart: number | null = null;

  constructor() {
    super();
    this.initialize();
  }

  private initialize() {
    setInterval(() => this.recordHeartbeat(), this.heartbeatInterval).unref();

    process.on('uncaughtException', (error) => {
      this.recordIncident('uncaughtException', error instanceof Error ? error.message : String(error));
    });

    process.on('unhandledRejection', (reason) => {
      this.recordIncident('unhandledRejection', reason instanceof Error ? reason.message : String(reason));
    });

    this.on('downtime:start', () => {
      if (!this.outageStart) {
        this.outageStart = Date.now();
        logger.warn('Downtime detected by uptime monitor');
      }
    });

    this.on('downtime:end', () => {
      if (this.outageStart) {
        const duration = Date.now() - this.outageStart;
        this.totalDowntimeMs += duration;
        logger.info('Downtime resolved', { duration });
        this.outageStart = null;
      }
    });
  }

  private recordHeartbeat() {
    this.lastHeartbeat = Date.now();
    this.emit('heartbeat', { timestamp: this.lastHeartbeat });
  }

  recordIncident(type: string, message: string, metadata?: Record<string, any>) {
    const incident: Incident = {
      type,
      message,
      metadata,
      timestamp: Date.now(),
    };

    this.incidents.push(incident);
    if (this.incidents.length > 100) {
      this.incidents.shift();
    }

    logger.error('Uptime incident recorded', incident);
    this.emit('incident', incident);
  }

  startDowntime(metadata?: Record<string, any>) {
    this.emit('downtime:start', metadata);
  }

  endDowntime(metadata?: Record<string, any>) {
    this.emit('downtime:end', metadata);
  }

  getSummary() {
    const now = Date.now();
    const uptimeMs = now - this.startedAt - this.totalDowntimeMs - (this.outageStart ? now - this.outageStart : 0);
    const totalMs = now - this.startedAt;
    const availability = totalMs === 0 ? 100 : Math.max(0, 100 - ((this.totalDowntimeMs / totalMs) * 100));

    return {
      startedAt: this.startedAt,
      uptimeMs,
      downtimeMs: this.totalDowntimeMs,
      availability: Number(availability.toFixed(4)),
      lastHeartbeat: this.lastHeartbeat,
      incidents: [...this.incidents].reverse().slice(0, 20),
      outageInProgress: this.outageStart !== null,
    };
  }
}

export const uptimeMonitor = new UptimeMonitor();
