// @ts-nocheck
/**
 * Storage Metrics Collector Job
 * Collects and stores system metrics hourly for trend analysis
 */

import { db } from '../db';
import { storageMetricsHistory, projects, users, files } from '@shared/schema';
import { sql, count } from 'drizzle-orm';
import { dbPool } from '../db/index';
import { createLogger } from '../utils/logger';
import os from 'os';

const logger = createLogger('storage-metrics-collector');

let collectorInterval: NodeJS.Timeout | null = null;

export async function collectStorageMetrics(): Promise<void> {
  try {
    logger.info('Collecting storage metrics...');

    let databaseSizeBytes = '0';
    try {
      const sizeResult = await db.execute(sql`SELECT pg_database_size(current_database()) as size`);
      databaseSizeBytes = String(sizeResult.rows[0]?.size || 0);
    } catch (e) {
      logger.error('Failed to get database size:', e);
    }

    let totalProjectsCount = 0;
    let totalUsersCount = 0;
    let totalFilesCount = 0;

    try {
      const [projectsResult] = await db.select({ count: sql<number>`count(*)::int` }).from(projects);
      totalProjectsCount = projectsResult?.count || 0;

      const [usersResult] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
      totalUsersCount = usersResult?.count || 0;

      const [filesResult] = await db.select({ count: sql<number>`count(*)::int` }).from(files);
      totalFilesCount = filesResult?.count || 0;
    } catch (e) {
      logger.error('Failed to get entity counts:', e);
    }

    const poolMetrics = dbPool.getMetrics();
    const memoryUsage = process.memoryUsage();
    const loadAvg = os.loadaverage();

    await db.insert(storageMetricsHistory).values({
      databaseSizeBytes,
      totalProjects: totalProjectsCount,
      totalUsers: totalUsersCount,
      totalFiles: totalFilesCount,
      poolConnectionsActive: poolMetrics.poolStats?.total || 0,
      memoryHeapUsedBytes: String(memoryUsage.heapUsed),
      memoryRssBytes: String(memoryUsage.rss),
      cpuLoadAverage1m: loadAvg[0],
    });

    logger.info('Storage metrics collected successfully', {
      databaseSizeBytes,
      totalProjects: totalProjectsCount,
      totalUsers: totalUsersCount,
      totalFiles: totalFilesCount,
    });
  } catch (error) {
    logger.error('Failed to collect storage metrics:', error);
  }
}

export async function cleanupOldMetrics(): Promise<void> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db
      .delete(storageMetricsHistory)
      .where(sql`${storageMetricsHistory.recordedAt} < ${thirtyDaysAgo}`);

    logger.info('Cleaned up old metrics', { deletedCount: result.rowCount || 0 });
  } catch (error) {
    logger.error('Failed to cleanup old metrics:', error);
  }
}

export function startStorageMetricsCollector(): void {
  if (collectorInterval) {
    logger.warn('Storage metrics collector already running');
    return;
  }

  logger.info('Starting storage metrics collector (hourly)');

  collectStorageMetrics();

  collectorInterval = setInterval(async () => {
    await collectStorageMetrics();
    
    const now = new Date();
    if (now.getHours() === 0) {
      await cleanupOldMetrics();
    }
  }, 60 * 60 * 1000);

  logger.info('Storage metrics collector started');
}

export function stopStorageMetricsCollector(): void {
  if (collectorInterval) {
    clearInterval(collectorInterval);
    collectorInterval = null;
    logger.info('Storage metrics collector stopped');
  }
}

export async function getStorageGrowthRate(): Promise<{
  dailyGrowthBytes: number;
  dailyGrowthGB: number;
  weeklyGrowthBytes: number;
  weeklyGrowthGB: number;
  dataPoints: number;
  oldestRecord: Date | null;
  newestRecord: Date | null;
}> {
  try {
    const records = await db
      .select({
        recordedAt: storageMetricsHistory.recordedAt,
        databaseSizeBytes: storageMetricsHistory.databaseSizeBytes,
      })
      .from(storageMetricsHistory)
      .orderBy(storageMetricsHistory.recordedAt)
      .limit(1000);

    if (records.length < 2) {
      return {
        dailyGrowthBytes: 0,
        dailyGrowthGB: 0.05,
        weeklyGrowthBytes: 0,
        weeklyGrowthGB: 0.35,
        dataPoints: records.length,
        oldestRecord: records[0]?.recordedAt || null,
        newestRecord: records[records.length - 1]?.recordedAt || null,
      };
    }

    const oldest = records[0];
    const newest = records[records.length - 1];

    const oldestSize = Number(oldest.databaseSizeBytes);
    const newestSize = Number(newest.databaseSizeBytes);
    const sizeDiff = newestSize - oldestSize;

    const timeDiffMs = newest.recordedAt.getTime() - oldest.recordedAt.getTime();
    const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);

    if (timeDiffDays < 0.1) {
      return {
        dailyGrowthBytes: 0,
        dailyGrowthGB: 0.05,
        weeklyGrowthBytes: 0,
        weeklyGrowthGB: 0.35,
        dataPoints: records.length,
        oldestRecord: oldest.recordedAt,
        newestRecord: newest.recordedAt,
      };
    }

    const dailyGrowthBytes = sizeDiff / timeDiffDays;
    const dailyGrowthGB = dailyGrowthBytes / (1024 * 1024 * 1024);
    const weeklyGrowthBytes = dailyGrowthBytes * 7;
    const weeklyGrowthGB = dailyGrowthGB * 7;

    return {
      dailyGrowthBytes: Math.max(0, dailyGrowthBytes),
      dailyGrowthGB: Math.max(0, Number(dailyGrowthGB.toFixed(4))),
      weeklyGrowthBytes: Math.max(0, weeklyGrowthBytes),
      weeklyGrowthGB: Math.max(0, Number(weeklyGrowthGB.toFixed(4))),
      dataPoints: records.length,
      oldestRecord: oldest.recordedAt,
      newestRecord: newest.recordedAt,
    };
  } catch (error) {
    logger.error('Failed to calculate storage growth rate:', error);
    return {
      dailyGrowthBytes: 0,
      dailyGrowthGB: 0.05,
      weeklyGrowthBytes: 0,
      weeklyGrowthGB: 0.35,
      dataPoints: 0,
      oldestRecord: null,
      newestRecord: null,
    };
  }
}
