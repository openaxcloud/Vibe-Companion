import { db } from "../db";
import { usageTracking } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// Import after the class is defined to avoid circular dependency
let stripeBillingService: any;

interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkIn: number;
  networkOut: number;
  timestamp: Date;
}

interface ProjectResources {
  projectId: number;
  userId: number;
  cpuSeconds: number;
  memoryMBSeconds: number;
  storageBytes: number;
  bandwidthBytesIn: number;
  bandwidthBytesOut: number;
  databaseQueries: number;
  databaseStorageBytes: number;
}

export class ResourceMonitor {
  private static instance: ResourceMonitor;
  private monitoringIntervals: Map<number, NodeJS.Timeout> = new Map();
  private projectMetrics: Map<number, ProjectResources> = new Map();
  private lastNetworkStats: Map<string, { bytesIn: number; bytesOut: number }> = new Map();
  
  private constructor() {}
  
  static getInstance(): ResourceMonitor {
    if (!ResourceMonitor.instance) {
      ResourceMonitor.instance = new ResourceMonitor();
    }
    return ResourceMonitor.instance;
  }

  // Start monitoring resources for a project
  async startProjectMonitoring(projectId: number, userId: number): Promise<void> {
    // Initialize project metrics
    this.projectMetrics.set(projectId, {
      projectId,
      userId,
      cpuSeconds: 0,
      memoryMBSeconds: 0,
      storageBytes: 0,
      bandwidthBytesIn: 0,
      bandwidthBytesOut: 0,
      databaseQueries: 0,
      databaseStorageBytes: 0
    });

    // Monitor every 5 seconds
    const interval = setInterval(async () => {
      await this.collectMetrics(projectId);
    }, 5000);

    this.monitoringIntervals.set(projectId, interval);
  }

  // Stop monitoring and save final metrics
  async stopProjectMonitoring(projectId: number): Promise<void> {
    const interval = this.monitoringIntervals.get(projectId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(projectId);
    }

    // Save final metrics to database
    await this.saveMetrics(projectId);
    this.projectMetrics.delete(projectId);
  }

  // Collect current resource metrics
  private async collectMetrics(projectId: number): Promise<void> {
    const metrics = this.projectMetrics.get(projectId);
    if (!metrics) return;

    try {
      // CPU Usage
      const cpuUsage = await this.getCPUUsage();
      metrics.cpuSeconds += (cpuUsage / 100) * 5; // 5 second interval

      // Memory Usage
      const memoryUsage = await this.getMemoryUsage();
      metrics.memoryMBSeconds += (memoryUsage / 1024 / 1024) * 5;

      // Storage Usage
      const storageUsage = await this.getProjectStorageUsage(projectId);
      metrics.storageBytes = storageUsage;

      // Network Usage
      const networkStats = await this.getNetworkUsage();
      const lastStats = this.lastNetworkStats.get(`project-${projectId}`) || { bytesIn: 0, bytesOut: 0 };
      
      if (lastStats.bytesIn > 0) {
        metrics.bandwidthBytesIn += networkStats.bytesIn - lastStats.bytesIn;
        metrics.bandwidthBytesOut += networkStats.bytesOut - lastStats.bytesOut;
      }
      
      this.lastNetworkStats.set(`project-${projectId}`, networkStats);

      // Database Usage
      const dbStats = await this.getDatabaseUsage(projectId);
      metrics.databaseQueries = dbStats.queryCount;
      metrics.databaseStorageBytes = dbStats.storageBytes;

    } catch (error) {
      console.error(`[ResourceMonitor] Error collecting metrics for project ${projectId}:`, error);
    }
  }

  // Get CPU usage percentage
  private async getCPUUsage(): Promise<number> {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);
    
    return usage;
  }

  // Get memory usage in bytes
  private async getMemoryUsage(): Promise<number> {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    return totalMemory - freeMemory;
  }

  // Get project storage usage
  private async getProjectStorageUsage(projectId: number): Promise<number> {
    const projectPath = path.join(process.cwd(), 'projects', projectId.toString());
    
    try {
      const { stdout } = await execAsync(`du -sb "${projectPath}" 2>/dev/null || echo "0"`);
      const size = parseInt(stdout.split('\t')[0]) || 0;
      return size;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return 0;
    }
  }

  // Get network usage (simplified - in production would use proper network monitoring)
  private async getNetworkUsage(): Promise<{ bytesIn: number; bytesOut: number }> {
    try {
      const { stdout } = await execAsync(`cat /proc/net/dev 2>/dev/null || echo ""`);
      const lines = stdout.split('\n');
      let totalBytesIn = 0;
      let totalBytesOut = 0;

      lines.forEach(line => {
        if (line.includes(':') && !line.includes('lo:')) {
          const parts = line.split(':')[1].trim().split(/\s+/);
          totalBytesIn += parseInt(parts[0]) || 0;
          totalBytesOut += parseInt(parts[8]) || 0;
        }
      });

      return { bytesIn: totalBytesIn, bytesOut: totalBytesOut };
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return { bytesIn: 0, bytesOut: 0 };
    }
  }

  // Get database usage for a project
  private async getDatabaseUsage(projectId: number): Promise<{ queryCount: number; storageBytes: number }> {
    try {
      // Get query count from database logs (simplified)
      const result = await db.select({
        count: sql<number>`COUNT(*)::int`
      })
      .from(usageTracking)
      .where(and(
        eq(usageTracking.userId, projectId), // Using userId as a proxy for now
        eq(usageTracking.metricType, 'database_queries')
      ));

      // Get database size (simplified - in production would query actual DB size)
      const dbSize = await execAsync(`du -sb "./database-instances/${projectId}" 2>/dev/null || echo "0"`);
      const storageBytes = parseInt(dbSize.stdout.split('\t')[0]) || 0;

      return {
        queryCount: result[0]?.count || 0,
        storageBytes
      };
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return { queryCount: 0, storageBytes: 0 };
    }
  }

  // Save metrics to usage tracking
  private async saveMetrics(projectId: number): Promise<void> {
    const metrics = this.projectMetrics.get(projectId);
    if (!metrics) return;

    const timestamp = new Date();

    try {
      const billingPeriodStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1);
      const billingPeriodEnd = new Date(timestamp.getFullYear(), timestamp.getMonth() + 1, 0);

      // Save CPU usage
      if (metrics.cpuSeconds > 0) {
        await db.insert(usageTracking).values({
          userId: metrics.userId,
          metricType: 'compute_cpu',
          value: metrics.cpuSeconds.toString(),
          unit: 'seconds',
          timestamp,
          billingPeriodStart,
          billingPeriodEnd
        });
      }

      // Save memory usage
      if (metrics.memoryMBSeconds > 0) {
        await db.insert(usageTracking).values({
          userId: metrics.userId,
          metricType: 'compute_memory',
          value: (metrics.memoryMBSeconds / 1024).toFixed(2), // Convert to GB-seconds
          unit: 'GB-seconds',
          timestamp,
          billingPeriodStart,
          billingPeriodEnd
        });
      }

      // Save storage usage
      if (metrics.storageBytes > 0) {
        const storageGB = metrics.storageBytes / (1024 * 1024 * 1024);
        await db.insert(usageTracking).values({
          userId: metrics.userId,
          metricType: 'storage',
          value: storageGB.toFixed(2),
          unit: 'GB',
          timestamp,
          billingPeriodStart,
          billingPeriodEnd
        });
      }

      // Save bandwidth usage
      const bandwidthGB = (metrics.bandwidthBytesIn + metrics.bandwidthBytesOut) / (1024 * 1024 * 1024);
      if (bandwidthGB > 0) {
        await db.insert(usageTracking).values({
          userId: metrics.userId,
          metricType: 'bandwidth',
          value: bandwidthGB.toFixed(2),
          unit: 'GB',
          timestamp,
          billingPeriodStart,
          billingPeriodEnd
        });
      }

      // Save database usage
      if (metrics.databaseQueries > 0) {
        await db.insert(usageTracking).values({
          userId: metrics.userId,
          metricType: 'database_queries',
          value: metrics.databaseQueries.toString(),
          unit: 'queries',
          timestamp,
          billingPeriodStart,
          billingPeriodEnd
        });
      }

      if (metrics.databaseStorageBytes > 0) {
        const dbStorageGB = metrics.databaseStorageBytes / (1024 * 1024 * 1024);
        await db.insert(usageTracking).values({
          userId: metrics.userId,
          metricType: 'database_storage',
          value: dbStorageGB.toFixed(2),
          unit: 'GB',
          timestamp,
          billingPeriodStart,
          billingPeriodEnd
        });
      }

      // Report usage to Stripe for billing
      if (!stripeBillingService && typeof require !== 'undefined') {
        try {
          stripeBillingService = require('./stripe-billing-service').stripeBillingService;
        } catch (error) {
          console.warn('[ResourceMonitor] Stripe billing service not available');
        }
      }

      if (stripeBillingService) {
        try {
          // Report CPU usage to Stripe
          if (metrics.cpuSeconds > 0) {
            await stripeBillingService.reportUsage(metrics.userId, 'compute_cpu', metrics.cpuSeconds / 3600); // Convert to hours
          }
          
          // Report storage usage to Stripe
          if (metrics.storageBytes > 0) {
            const storageGB = metrics.storageBytes / (1024 * 1024 * 1024);
            await stripeBillingService.reportUsage(metrics.userId, 'storage', storageGB);
          }
          
          // Report bandwidth usage to Stripe
          const bandwidthGB = (metrics.bandwidthBytesIn + metrics.bandwidthBytesOut) / (1024 * 1024 * 1024);
          if (bandwidthGB > 0) {
            await stripeBillingService.reportUsage(metrics.userId, 'bandwidth', bandwidthGB);
          }
          
          // Report database usage to Stripe
          if (metrics.databaseStorageBytes > 0) {
            const dbStorageGB = metrics.databaseStorageBytes / (1024 * 1024 * 1024);
            await stripeBillingService.reportUsage(metrics.userId, 'database_storage', dbStorageGB);
          }
        } catch (error) {
          console.error('[ResourceMonitor] Error reporting to Stripe:', error);
        }
      }

    } catch (error) {
      console.error(`[ResourceMonitor] Error saving metrics:`, error);
    }
  }

  // Get current resource usage for a project
  async getCurrentUsage(projectId: number): Promise<ProjectResources | null> {
    return this.projectMetrics.get(projectId) || null;
  }

  // Monitor deployment resources
  async trackDeploymentResources(deploymentId: number, projectId: number, userId: number, deploymentType: string): Promise<void> {
    // Base deployment costs by type
    const deploymentCosts: Record<string, number> = {
      'static': 0.50,        // $0.50 per deployment
      'autoscale': 2.00,     // $2.00 per deployment
      'reserved_vm': 5.00,   // $5.00 per deployment
      'serverless': 1.00,    // $1.00 per deployment
      'scheduled': 0.75      // $0.75 per deployment
    };

    const cost = deploymentCosts[deploymentType] || 1.00;

    const timestamp = new Date();
    const billingPeriodStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), 1);
    const billingPeriodEnd = new Date(timestamp.getFullYear(), timestamp.getMonth() + 1, 0);

    await db.insert(usageTracking).values({
      userId,
      metricType: 'deployments',
      value: '1',
      unit: `${deploymentType}_deployment`,
      timestamp,
      billingPeriodStart,
      billingPeriodEnd
    });
  }
}

// Export singleton instance
export const resourceMonitor = ResourceMonitor.getInstance();