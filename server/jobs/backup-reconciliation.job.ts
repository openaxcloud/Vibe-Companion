import { createLogger } from '../utils/logger';
import { db } from '../db';
import { projectDatabases, projectDatabaseBackups } from '@shared/schema';
import { eq, and, lt, isNotNull } from 'drizzle-orm';
import { projectDatabaseService } from '../services/project-database-provisioning.service';

const logger = createLogger('BackupReconciliationJob');

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

export async function runScheduledBackups(): Promise<void> {
  if (isRunning) {
    logger.info('Scheduled backup job already running, skipping');
    return;
  }

  isRunning = true;
  logger.info('Starting scheduled backup job');

  try {
    const databases = await db
      .select()
      .from(projectDatabases)
      .where(and(
        eq(projectDatabases.status, 'running'),
        eq(projectDatabases.autoBackup, true)
      ));

    logger.info(`Found ${databases.length} databases with auto-backup enabled`);

    for (const database of databases) {
      try {
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        if (database.lastBackupAt && database.lastBackupAt > oneDayAgo) {
          continue;
        }

        logger.info(`Creating scheduled backup for project ${database.projectId}`);
        
        await projectDatabaseService.createBackup(database.projectId, {
          name: `scheduled-${new Date().toISOString().split('T')[0]}`,
          backupType: 'scheduled',
          initiatedBy: 'system'
        });

        logger.info(`Scheduled backup completed for project ${database.projectId}`);
      } catch (error) {
        logger.error(`Failed to create scheduled backup for project ${database.projectId}:`, error);
      }
    }
  } catch (error) {
    logger.error('Scheduled backup job failed:', error);
  } finally {
    isRunning = false;
  }
}

export async function pruneExpiredBackups(): Promise<void> {
  logger.info('Starting expired backup pruning job');

  try {
    const prunedCount = await projectDatabaseService.pruneExpiredBackups();
    logger.info(`Pruned ${prunedCount} expired backups`);
  } catch (error) {
    logger.error('Expired backup pruning job failed:', error);
  }
}

export async function reconcileBackupStatus(): Promise<void> {
  logger.info('Starting backup status reconciliation job');

  try {
    const pendingBackups = await db
      .select()
      .from(projectDatabaseBackups)
      .where(and(
        eq(projectDatabaseBackups.status, 'pending'),
        isNotNull(projectDatabaseBackups.providerBackupId)
      ));

    logger.info(`Found ${pendingBackups.length} pending backups to reconcile`);

    for (const backup of pendingBackups) {
      const fiveMinutesAgo = new Date();
      fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
      
      if (backup.createdAt > fiveMinutesAgo) {
        continue;
      }

      await db
        .update(projectDatabaseBackups)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(projectDatabaseBackups.id, backup.id));
    }
  } catch (error) {
    logger.error('Backup status reconciliation job failed:', error);
  }
}

export function startBackupJobs(): void {
  const BACKUP_INTERVAL = 6 * 60 * 60 * 1000;
  const PRUNE_INTERVAL = 24 * 60 * 60 * 1000;

  logger.info('Starting backup job scheduler');

  intervalId = setInterval(async () => {
    await runScheduledBackups();
    await reconcileBackupStatus();
  }, BACKUP_INTERVAL);

  setInterval(async () => {
    await pruneExpiredBackups();
  }, PRUNE_INTERVAL);

  setTimeout(async () => {
    await pruneExpiredBackups();
  }, 60 * 1000);
}

export function stopBackupJobs(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Backup job scheduler stopped');
  }
}
