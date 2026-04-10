import * as os from 'os';
import { createLogger } from '../utils/logger';

const logger = createLogger('performance-monitor');

export interface PerformanceMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    usage: number;
    total: number;
    free: number;
    used: number;
  };
  disk: {
    usage?: number;
    total?: number;
    free?: number;
  };
  network: {
    bytesIn?: number;
    bytesOut?: number;
  };
  timestamp: Date;
}

export interface ApplicationMetrics {
  requestCount: number;
  responseTime: number;
  errorRate: number;
  activeConnections: number;
  databaseConnections: number;
  timestamp: Date;
}

class PerformanceMonitor {
  private metricsHistory: PerformanceMetrics[] = [];
  private appMetricsHistory: ApplicationMetrics[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 1000; // Keep last 1000 metrics entries

  constructor() {
    this.startMonitoring();
  }

  startMonitoring(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    logger.info(`Performance monitoring started with interval: ${intervalMs}ms`);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Performance monitoring stopped');
    }
  }

  private async collectMetrics(): Promise<void> {
    try {
      const cpuUsage = process.cpuUsage();
      const memoryUsage = process.memoryUsage();
      const systemMemory = {
        total: os.totalmem(),
        free: os.freemem(),
      };

      const metrics: PerformanceMetrics = {
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: os.loadavg(),
        },
        memory: {
          usage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          total: systemMemory.total,
          free: systemMemory.free,
          used: systemMemory.total - systemMemory.free,
        },
        disk: {
          // Disk usage would require additional libraries or native calls
        },
        network: {
          // Network metrics would require additional monitoring
        },
        timestamp: new Date(),
      };

      this.addMetrics(metrics);
    } catch (error) {
      logger.error(`Failed to collect performance metrics: ${error}`);
    }
  }

  private addMetrics(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }
  }

  addApplicationMetrics(metrics: ApplicationMetrics): void {
    this.appMetricsHistory.push(metrics);
    
    // Maintain history size limit
    if (this.appMetricsHistory.length > this.maxHistorySize) {
      this.appMetricsHistory = this.appMetricsHistory.slice(-this.maxHistorySize);
    }
  }

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metricsHistory[this.metricsHistory.length - 1] || null;
  }

  getMetricsHistory(limit?: number): PerformanceMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  getApplicationMetrics(limit?: number): ApplicationMetrics[] {
    if (limit) {
      return this.appMetricsHistory.slice(-limit);
    }
    return [...this.appMetricsHistory];
  }

  getAverageMetrics(timeRangeMs: number): Partial<PerformanceMetrics> | null {
    const cutoffTime = new Date(Date.now() - timeRangeMs);
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);

    if (relevantMetrics.length === 0) {
      return null;
    }

    const avgCpuUsage = relevantMetrics.reduce((sum, m) => sum + m.cpu.usage, 0) / relevantMetrics.length;
    const avgMemoryUsage = relevantMetrics.reduce((sum, m) => sum + m.memory.usage, 0) / relevantMetrics.length;

    return {
      cpu: {
        usage: avgCpuUsage,
        loadAverage: relevantMetrics[relevantMetrics.length - 1].cpu.loadAverage,
      },
      memory: {
        usage: avgMemoryUsage,
        total: relevantMetrics[relevantMetrics.length - 1].memory.total,
        free: relevantMetrics[relevantMetrics.length - 1].memory.free,
        used: relevantMetrics[relevantMetrics.length - 1].memory.used,
      },
      timestamp: new Date(),
    };
  }

  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
    metrics: PerformanceMetrics | null;
  } {
    const current = this.getCurrentMetrics();
    const issues: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (!current) {
      return {
        status: 'critical',
        issues: ['No performance metrics available'],
        metrics: null,
      };
    }

    // Check CPU usage
    if (current.cpu.usage > 90) {
      issues.push('High CPU usage');
      status = 'critical';
    } else if (current.cpu.usage > 70) {
      issues.push('Elevated CPU usage');
      if (status === 'healthy') status = 'warning';
    }

    // Check memory usage
    if (current.memory.usage > 90) {
      issues.push('High memory usage');
      status = 'critical';
    } else if (current.memory.usage > 80) {
      issues.push('Elevated memory usage');
      if (status === 'healthy') status = 'warning';
    }

    // Check load average (for first minute)
    const cpuCount = os.cpus().length;
    if (current.cpu.loadAverage[0] > cpuCount * 2) {
      issues.push('High system load');
      status = 'critical';
    } else if (current.cpu.loadAverage[0] > cpuCount) {
      issues.push('Elevated system load');
      if (status === 'healthy') status = 'warning';
    }

    return {
      status,
      issues,
      metrics: current,
    };
  }

  // Performance alert thresholds
  checkAlerts(): {
    alerts: Array<{
      type: 'cpu' | 'memory' | 'disk' | 'load';
      severity: 'warning' | 'critical';
      message: string;
      value: number;
      threshold: number;
    }>;
  } {
    const alerts: any[] = [];
    const current = this.getCurrentMetrics();

    if (!current) {
      return { alerts };
    }

    // CPU alerts
    if (current.cpu.usage > 90) {
      alerts.push({
        type: 'cpu',
        severity: 'critical',
        message: 'CPU usage is critically high',
        value: current.cpu.usage,
        threshold: 90,
      });
    } else if (current.cpu.usage > 70) {
      alerts.push({
        type: 'cpu',
        severity: 'warning',
        message: 'CPU usage is elevated',
        value: current.cpu.usage,
        threshold: 70,
      });
    }

    // Memory alerts
    if (current.memory.usage > 90) {
      alerts.push({
        type: 'memory',
        severity: 'critical',
        message: 'Memory usage is critically high',
        value: current.memory.usage,
        threshold: 90,
      });
    } else if (current.memory.usage > 80) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: 'Memory usage is elevated',
        value: current.memory.usage,
        threshold: 80,
      });
    }

    return { alerts };
  }

  // Clean up when shutting down
  destroy(): void {
    this.stopMonitoring();
    this.metricsHistory = [];
    this.appMetricsHistory = [];
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Graceful shutdown
process.on('SIGTERM', () => {
  performanceMonitor.destroy();
});

process.on('SIGINT', () => {
  performanceMonitor.destroy();
});

export { PerformanceMonitor };