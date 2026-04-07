import { DatabaseStorage } from '../storage';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // bytes
    used: number; // bytes
    available: number; // bytes
    percentage: number;
  };
  disk: {
    total: number; // bytes
    used: number; // bytes
    available: number; // bytes
    percentage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  };
}

export interface ProjectMetrics {
  projectId: number;
  userId: number;
  containerStats: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkBytesIn: number;
    networkBytesOut: number;
  };
  processCount: number;
  uptime: number; // seconds
  lastActivity: Date;
}

export class RealTimeMonitoringService {
  private storage: DatabaseStorage;
  private metricsInterval: NodeJS.Timeout | null = null;
  private activeProjects: Map<number, ProjectMetrics> = new Map();
  private previousNetworkStats: any = null;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  // Start real-time monitoring
  start(): void {
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        const metrics = await this.collectSystemMetrics();
        await this.storeSystemMetrics(metrics);
        
        // Update project-specific metrics
        await this.updateProjectMetrics();
        
        // Calculate and track usage for active sessions
        await this.trackActiveUsage();
      } catch (error) {
        console.error('[monitoring] Error collecting metrics:', error);
      }
    }, 30000);
  }

  // Stop monitoring
  stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  // Collect system-wide metrics
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    // CPU usage
    const cpus = os.cpus();
    const loadAverage = os.loadavg();
    
    // Calculate CPU usage percentage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const cpuUsage = 100 - ~~(100 * idle / total);

    // Memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // Disk usage (approximate for project directory)
    let diskStats = { total: 0, used: 0, available: 0 };
    try {
      const stats = await fs.stat('./');
      const projectSize = await this.getDirectorySize('./');
      diskStats = {
        total: 50 * 1024 * 1024 * 1024, // 50GB default
        used: projectSize,
        available: 50 * 1024 * 1024 * 1024 - projectSize
      };
    } catch (error) {
      console.warn('[monitoring] Could not get disk stats:', error);
    }

    // Network stats (simplified)
    const networkStats = await this.getNetworkStats();

    return {
      timestamp: new Date(),
      cpu: {
        usage: cpuUsage,
        cores: cpus.length,
        loadAverage
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        available: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      disk: {
        total: diskStats.total,
        used: diskStats.used,
        available: diskStats.available,
        percentage: (diskStats.used / diskStats.total) * 100
      },
      network: networkStats
    };
  }

  // Get directory size recursively
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          if (!item.startsWith('.') && item !== 'node_modules') {
            size += await this.getDirectorySize(itemPath);
          }
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    
    return size;
  }

  private readProcNetDev(): { bytesReceived: number; bytesSent: number; packetsReceived: number; packetsSent: number } | null {
    try {
      const data = require('fs').readFileSync('/proc/net/dev', 'utf8');
      const lines = data.split('\n').slice(2);
      let bytesReceived = 0, bytesSent = 0, packetsReceived = 0, packetsSent = 0;
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;
        const iface = parts[0].replace(':', '');
        if (iface === 'lo') continue;
        bytesReceived += parseInt(parts[1], 10) || 0;
        packetsReceived += parseInt(parts[2], 10) || 0;
        bytesSent += parseInt(parts[9], 10) || 0;
        packetsSent += parseInt(parts[10], 10) || 0;
      }
      return { bytesReceived, bytesSent, packetsReceived, packetsSent };
    } catch {
      return null;
    }
  }

  private getNetworkStatsViaOsModule(): { bytesReceived: number; bytesSent: number; packetsReceived: number; packetsSent: number } {
    const interfaces = os.networkInterfaces();
    let activeAddresses = 0;
    for (const name in interfaces) {
      if (name === 'lo' || name === 'lo0') continue;
      const addrs = interfaces[name];
      if (addrs) {
        for (const addr of addrs) {
          if (!addr.internal) activeAddresses++;
        }
      }
    }
    return { bytesReceived: 0, bytesSent: 0, packetsReceived: 0, packetsSent: 0 };
  }

  private async getNetworkStats(): Promise<any> {
    const currentStats = this.readProcNetDev() || this.getNetworkStatsViaOsModule();

    if (this.previousNetworkStats) {
      const delta = {
        bytesReceived: Math.max(0, currentStats.bytesReceived - this.previousNetworkStats.bytesReceived),
        bytesSent: Math.max(0, currentStats.bytesSent - this.previousNetworkStats.bytesSent),
        packetsReceived: Math.max(0, currentStats.packetsReceived - this.previousNetworkStats.packetsReceived),
        packetsSent: Math.max(0, currentStats.packetsSent - this.previousNetworkStats.packetsSent)
      };
      this.previousNetworkStats = currentStats;
      return delta;
    }

    this.previousNetworkStats = currentStats;
    return { bytesReceived: 0, bytesSent: 0, packetsReceived: 0, packetsSent: 0 };
  }

  // Store system metrics
  private async storeSystemMetrics(metrics: SystemMetrics): Promise<void> {
    // Store in database for historical analysis
    try {
      // This would store system-wide metrics for admin monitoring
    } catch (error) {
      console.error('[monitoring] Failed to store system metrics:', error);
    }
  }

  // Update project-specific metrics
  private async updateProjectMetrics(): Promise<void> {
    // In a real implementation, this would:
    // 1. Get list of active projects/containers
    // 2. Collect metrics for each container
    // 3. Update the activeProjects map
    // 4. Track usage per project
    
    for (const [projectId, metrics] of this.activeProjects) {
      try {
        // Track compute usage (CPU time)
        const computeHours = metrics.containerStats.cpuUsage / 100 * (30 / 3600); // 30 seconds in hours
        
        await this.storage.trackUsage(
          String(metrics.userId),
          'compute',
          computeHours,
          {
            projectId: metrics.projectId,
            source: 'real_time_monitoring',
            containerStats: metrics.containerStats
          }
        );

        // Track storage usage
        const storageGB = metrics.containerStats.diskUsage / (1024 * 1024 * 1024);
        
        await this.storage.trackUsage(
          String(metrics.userId),
          'storage',
          storageGB,
          {
            projectId: metrics.projectId,
            source: 'real_time_monitoring'
          }
        );

        // Track bandwidth usage
        const bandwidthGB = (metrics.containerStats.networkBytesIn + metrics.containerStats.networkBytesOut) / (1024 * 1024 * 1024);
        
        await this.storage.trackUsage(
          String(metrics.userId),
          'bandwidth',
          bandwidthGB,
          {
            projectId: metrics.projectId,
            source: 'real_time_monitoring',
            direction: 'bidirectional'
          }
        );
        
      } catch (error) {
        console.error(`[monitoring] Failed to track usage for project ${projectId}:`, error);
      }
    }
  }

  // Track active usage for billing
  private async trackActiveUsage(): Promise<void> {
    // This would integrate with the usage tracking service
    // to automatically track resource consumption
  }

  // Register active project
  registerProject(projectId: number, userId: number): void {
    this.activeProjects.set(projectId, {
      projectId,
      userId,
      containerStats: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkBytesIn: 0,
        networkBytesOut: 0
      },
      processCount: 1,
      uptime: 0,
      lastActivity: new Date()
    });
  }

  // Unregister project
  unregisterProject(projectId: number): void {
    this.activeProjects.delete(projectId);
  }

  // Get current metrics for a project
  getProjectMetrics(projectId: number): ProjectMetrics | null {
    return this.activeProjects.get(projectId) || null;
  }

  // Get system health status
  async getSystemHealth(): Promise<any> {
    const metrics = await this.collectSystemMetrics();
    
    return {
      status: 'healthy',
      timestamp: metrics.timestamp,
      cpu: {
        usage: metrics.cpu.usage,
        status: metrics.cpu.usage > 80 ? 'warning' : 'good'
      },
      memory: {
        usage: metrics.memory.percentage,
        status: metrics.memory.percentage > 80 ? 'warning' : 'good'
      },
      disk: {
        usage: metrics.disk.percentage,
        status: metrics.disk.percentage > 80 ? 'warning' : 'good'
      },
      activeProjects: this.activeProjects.size
    };
  }
}