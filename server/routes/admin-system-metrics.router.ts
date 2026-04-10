// @ts-nocheck
/**
 * Admin System Metrics Router (Fortune 500)
 * Comprehensive system monitoring dashboard endpoints
 */

import { Router } from 'express';
import { db } from '../db';
import { projects, users, files, conversations } from '@shared/schema';
import { sql, gte, count } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { dbPool } from '../db/index';
import os from 'os';
import { getStorageGrowthRate } from '../jobs/storage-metrics-collector';

const router = Router();

const STORAGE_LIMIT_GB = 10;
const STORAGE_LIMIT_BYTES = STORAGE_LIMIT_GB * 1024 * 1024 * 1024;
const POOL_MAX_CONNECTIONS = process.env.NODE_ENV === 'production' ? 20 : 10;

router.use(ensureAuthenticated);
router.use(ensureAdmin);

/**
 * GET /api/admin/system/overview
 * Real-time system metrics overview
 */
router.get('/overview', async (req, res) => {
  try {
    const memoryUsage = process.memoryUsage();
    const loadAvg = os.loadaverage();
    const uptime = process.uptime();
    
    const poolMetrics = dbPool.getMetrics();
    
    let dbStorageBytes = 0;
    try {
      const storageResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      dbStorageBytes = Number(storageResult.rows[0]?.size || 0);
    } catch (e) {
      console.error('Failed to get database size:', e);
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let projectStats = { total: 0, active: 0, avgStorageBytes: 0 };
    let userStats = { total: 0, active: 0, byTier: {} as Record<string, number> };

    try {
      const [totalProjects] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects);
      projectStats.total = totalProjects?.count || 0;

      const [activeProjects] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(gte(projects.updatedAt, sevenDaysAgo));
      projectStats.active = activeProjects?.count || 0;

      if (projectStats.total > 0) {
        projectStats.avgStorageBytes = Math.round(dbStorageBytes / projectStats.total);
      }
    } catch (e) {
      console.error('Failed to get project stats:', e);
    }

    try {
      const [totalUsers] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users);
      userStats.total = totalUsers?.count || 0;

      const [activeUsers] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(gte(users.lastLoginAt, thirtyDaysAgo));
      userStats.active = activeUsers?.count || 0;

      const tierCounts = await db
        .select({
          tier: users.subscriptionTier,
          count: sql<number>`count(*)::int`,
        })
        .from(users)
        .groupBy(users.subscriptionTier);

      for (const row of tierCounts) {
        if (row.tier) {
          userStats.byTier[row.tier] = row.count;
        }
      }
    } catch (e) {
      console.error('Failed to get user stats:', e);
    }

    res.json({
      timestamp: new Date().toISOString(),
      database: {
        pool: {
          total: poolMetrics.poolStats?.total || 0,
          idle: poolMetrics.poolStats?.idle || 0,
          waiting: poolMetrics.poolStats?.waiting || 0,
          max: POOL_MAX_CONNECTIONS,
          usagePercent: poolMetrics.poolStats 
            ? Math.round((poolMetrics.poolStats.total / POOL_MAX_CONNECTIONS) * 100) 
            : 0,
        },
        storage: {
          usedBytes: dbStorageBytes,
          limitBytes: STORAGE_LIMIT_BYTES,
          usedGB: Number((dbStorageBytes / (1024 * 1024 * 1024)).toFixed(2)),
          limitGB: STORAGE_LIMIT_GB,
          usagePercent: Math.round((dbStorageBytes / STORAGE_LIMIT_BYTES) * 100),
        },
        performance: {
          totalQueries: poolMetrics.totalQueries,
          totalErrors: poolMetrics.totalErrors,
          avgQueryTimeMs: Math.round(poolMetrics.avgQueryTime),
          slowQueriesCount: poolMetrics.slowQueries?.length || 0,
        },
      },
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external,
        heapUsedMB: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        heapTotalMB: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
        heapUsagePercent: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        loadAverage: {
          '1min': loadAvg[0],
          '5min': loadAvg[1],
          '15min': loadAvg[2],
        },
        cores: os.cpus().length,
        uptime: {
          seconds: uptime,
          formatted: formatUptime(uptime),
        },
      },
      projects: projectStats,
      users: userStats,
    });
  } catch (error) {
    console.error('Failed to fetch system overview:', error);
    res.status(500).json({ error: 'Failed to fetch system overview' });
  }
});

/**
 * GET /api/admin/system/storage
 * Detailed storage analysis
 */
router.get('/storage', async (req, res) => {
  try {
    let totalSizeBytes = 0;
    try {
      const sizeResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      totalSizeBytes = Number(sizeResult.rows[0]?.size || 0);
    } catch (e) {
      console.error('Failed to get database size:', e);
    }

    let tableStats: any[] = [];
    try {
      const tablesResult = await db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size_pretty,
          pg_total_relation_size(schemaname || '.' || tablename) as size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
        LIMIT 20
      `);
      tableStats = tablesResult.rows.map((row: any) => ({
        table: row.tablename,
        sizePretty: row.size_pretty,
        sizeBytes: Number(row.size_bytes),
        percentOfTotal: totalSizeBytes > 0 
          ? Number(((Number(row.size_bytes) / totalSizeBytes) * 100).toFixed(2)) 
          : 0,
      }));
    } catch (e) {
      console.error('Failed to get table stats:', e);
    }

    let topProjects: any[] = [];
    try {
      const projectsResult = await db
        .select({
          id: projects.id,
          name: projects.name,
          fileCount: sql<number>`(SELECT count(*)::int FROM files WHERE files.project_id = projects.id)`,
          updatedAt: projects.updatedAt,
        })
        .from(projects)
        .orderBy(sql`(SELECT count(*) FROM files WHERE files.project_id = projects.id) DESC`)
        .limit(10);

      topProjects = projectsResult.map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        name: p.name,
        fileCount: p.fileCount,
        estimatedSizeMB: Number((p.fileCount * 10 / 1024).toFixed(2)),
        lastUpdated: p.updatedAt,
      }));
    } catch (e) {
      console.error('Failed to get top projects:', e);
    }

    res.json({
      timestamp: new Date().toISOString(),
      total: {
        sizeBytes: totalSizeBytes,
        sizeGB: Number((totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)),
        limitGB: STORAGE_LIMIT_GB,
        usagePercent: Math.round((totalSizeBytes / STORAGE_LIMIT_BYTES) * 100),
        remainingGB: Number((STORAGE_LIMIT_GB - (totalSizeBytes / (1024 * 1024 * 1024))).toFixed(2)),
      },
      tables: tableStats,
      topProjects,
    });
  } catch (error) {
    console.error('Failed to fetch storage analysis:', error);
    res.status(500).json({ error: 'Failed to fetch storage analysis' });
  }
});

/**
 * GET /api/admin/system/alerts
 * Active system alerts based on thresholds
 */
router.get('/alerts', async (req, res) => {
  try {
    const alerts: Array<{
      level: 'info' | 'warning' | 'critical';
      category: string;
      message: string;
      value: number;
      threshold: number;
    }> = [];

    const poolMetrics = dbPool.getMetrics();
    const memoryUsage = process.memoryUsage();

    let storageUsagePercent = 0;
    try {
      const sizeResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      const dbStorageBytes = Number(sizeResult.rows[0]?.size || 0);
      storageUsagePercent = Math.round((dbStorageBytes / STORAGE_LIMIT_BYTES) * 100);
    } catch (e) {
      console.error('Failed to get database size for alerts:', e);
    }

    if (storageUsagePercent > 90) {
      alerts.push({
        level: 'critical',
        category: 'Storage',
        message: `Database storage critically high at ${storageUsagePercent}%`,
        value: storageUsagePercent,
        threshold: 90,
      });
    } else if (storageUsagePercent > 80) {
      alerts.push({
        level: 'warning',
        category: 'Storage',
        message: `Database storage usage high at ${storageUsagePercent}%`,
        value: storageUsagePercent,
        threshold: 80,
      });
    }

    const poolUsagePercent = poolMetrics.poolStats 
      ? Math.round((poolMetrics.poolStats.total / POOL_MAX_CONNECTIONS) * 100) 
      : 0;

    if (poolUsagePercent > 80) {
      alerts.push({
        level: 'warning',
        category: 'Database',
        message: `Connection pool usage high at ${poolUsagePercent}%`,
        value: poolUsagePercent,
        threshold: 80,
      });
    }

    const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    if (heapUsagePercent > 80) {
      alerts.push({
        level: 'warning',
        category: 'Memory',
        message: `Heap memory usage high at ${heapUsagePercent}%`,
        value: heapUsagePercent,
        threshold: 80,
      });
    }

    const slowQueriesCount = poolMetrics.slowQueries?.length || 0;
    if (slowQueriesCount > 10) {
      alerts.push({
        level: 'warning',
        category: 'Performance',
        message: `${slowQueriesCount} slow queries detected in the last hour`,
        value: slowQueriesCount,
        threshold: 10,
      });
    }

    const waitingConnections = poolMetrics.poolStats?.waiting || 0;
    if (waitingConnections > 5) {
      alerts.push({
        level: 'warning',
        category: 'Database',
        message: `${waitingConnections} connections waiting for pool`,
        value: waitingConnections,
        threshold: 5,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        level: 'info',
        category: 'System',
        message: 'All systems operating normally',
        value: 0,
        threshold: 0,
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      alerts: alerts.sort((a, b) => {
        const levelOrder = { critical: 0, warning: 1, info: 2 };
        return levelOrder[a.level] - levelOrder[b.level];
      }),
      summary: {
        critical: alerts.filter(a => a.level === 'critical').length,
        warning: alerts.filter(a => a.level === 'warning').length,
        info: alerts.filter(a => a.level === 'info').length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch system alerts:', error);
    res.status(500).json({ error: 'Failed to fetch system alerts' });
  }
});

/**
 * GET /api/admin/system/capacity-forecast
 * Capacity planning and recommendations
 */
router.get('/capacity-forecast', async (req, res) => {
  try {
    const poolMetrics = dbPool.getMetrics();
    const memoryUsage = process.memoryUsage();

    let storageUsagePercent = 0;
    let storageUsedGB = 0;
    try {
      const sizeResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      const dbStorageBytes = Number(sizeResult.rows[0]?.size || 0);
      storageUsedGB = dbStorageBytes / (1024 * 1024 * 1024);
      storageUsagePercent = Math.round((dbStorageBytes / STORAGE_LIMIT_BYTES) * 100);
    } catch (e) {
      console.error('Failed to get database size for forecast:', e);
    }

    const growthData = await getStorageGrowthRate();
    const dailyGrowthRateGB = growthData.dailyGrowthGB > 0 ? growthData.dailyGrowthGB : 0.05;
    const remainingGB = STORAGE_LIMIT_GB - storageUsedGB;
    const daysUntilFull = dailyGrowthRateGB > 0 
      ? Math.round(remainingGB / dailyGrowthRateGB) 
      : 999;

    const poolUsagePercent = poolMetrics.poolStats 
      ? Math.round((poolMetrics.poolStats.total / POOL_MAX_CONNECTIONS) * 100) 
      : 0;
    const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);

    const recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      category: string;
      recommendation: string;
      impact: string;
    }> = [];

    if (storageUsagePercent > 70) {
      recommendations.push({
        priority: 'high',
        category: 'Storage',
        recommendation: 'Consider archiving old projects or upgrading storage limit',
        impact: `Current usage at ${storageUsagePercent}%. Estimated ${daysUntilFull} days until limit.`,
      });
    }

    if (poolUsagePercent > 60) {
      recommendations.push({
        priority: 'medium',
        category: 'Database',
        recommendation: 'Consider increasing connection pool size',
        impact: `Pool at ${poolUsagePercent}% capacity. May cause delays during peak load.`,
      });
    }

    if (heapUsagePercent > 70) {
      recommendations.push({
        priority: 'medium',
        category: 'Memory',
        recommendation: 'Review memory-intensive operations or increase memory allocation',
        impact: `Heap at ${heapUsagePercent}%. May trigger garbage collection pauses.`,
      });
    }

    if ((poolMetrics.slowQueries?.length || 0) > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'Performance',
        recommendation: 'Review and optimize slow database queries',
        impact: 'Slow queries detected. Consider adding indexes or query optimization.',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        category: 'General',
        recommendation: 'System is healthy. Continue monitoring.',
        impact: 'All metrics within acceptable thresholds.',
      });
    }

    res.json({
      timestamp: new Date().toISOString(),
      currentUsage: {
        storage: {
          percent: storageUsagePercent,
          usedGB: Number(storageUsedGB.toFixed(2)),
          limitGB: STORAGE_LIMIT_GB,
        },
        connections: {
          percent: poolUsagePercent,
          current: poolMetrics.poolStats?.total || 0,
          max: POOL_MAX_CONNECTIONS,
        },
        memory: {
          percent: heapUsagePercent,
          usedMB: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
          totalMB: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
        },
      },
      forecast: {
        storageDaysRemaining: daysUntilFull,
        estimatedDailyGrowthGB: dailyGrowthRateGB,
        weeklyGrowthGB: growthData.weeklyGrowthGB,
        projectedFullDate: new Date(Date.now() + daysUntilFull * 24 * 60 * 60 * 1000).toISOString(),
        dataPoints: growthData.dataPoints,
        oldestDataPoint: growthData.oldestRecord?.toISOString() || null,
        newestDataPoint: growthData.newestRecord?.toISOString() || null,
        isEstimated: growthData.dataPoints < 24,
      },
      recommendations: recommendations.sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }),
    });
  } catch (error) {
    console.error('Failed to fetch capacity forecast:', error);
    res.status(500).json({ error: 'Failed to fetch capacity forecast' });
  }
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

export default router;
