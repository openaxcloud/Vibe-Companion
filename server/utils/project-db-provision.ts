import { pool } from '../db';
import { createLogger } from './logger';

const logger = createLogger('project-db-provision');

function sanitizeSchemaName(projectId: string): string {
  return `proj_${projectId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

export async function autoProvisionProjectDatabase(
  projectId: string,
  userId: string
): Promise<{ success: boolean; schemaName: string; connectionUrl: string }> {
  const schemaName = sanitizeSchemaName(projectId);

  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    logger.info(`Schema "${schemaName}" ensured for project ${projectId}`);
  } finally {
    client.release();
  }

  const platformUrl = process.env.DATABASE_URL || '';
  let projectUrl = '';

  if (platformUrl) {
    try {
      const url = new URL(platformUrl);
      url.searchParams.set('options', `-csearch_path=${schemaName}`);
      projectUrl = url.toString();
    } catch {
      projectUrl = `${platformUrl}?options=-csearch_path%3D${schemaName}`;
    }
  }

  let secretsStored = false;

  if (projectUrl) {
    try {
      const { db } = await import('../db');
      const { projectEnvVars } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      const { encrypt } = await import('../encryption');

      const existing = await db.select()
        .from(projectEnvVars)
        .where(and(
          eq(projectEnvVars.projectId, projectId),
          eq(projectEnvVars.key, 'DATABASE_URL')
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(projectEnvVars).values({
          projectId,
          key: 'DATABASE_URL',
          encryptedValue: encrypt(projectUrl),
        });
        logger.info(`DATABASE_URL secret stored for project ${projectId}`);
      }

      const pgSchemaExisting = await db.select()
        .from(projectEnvVars)
        .where(and(
          eq(projectEnvVars.projectId, projectId),
          eq(projectEnvVars.key, 'PGSCHEMA')
        ))
        .limit(1);

      if (pgSchemaExisting.length === 0) {
        await db.insert(projectEnvVars).values({
          projectId,
          key: 'PGSCHEMA',
          encryptedValue: encrypt(schemaName),
        });
      }

      secretsStored = true;
    } catch (err: any) {
      logger.error(`Failed to store DATABASE_URL secret for project ${projectId}: ${err.message}`);
      return { success: false, schemaName, connectionUrl: projectUrl };
    }
  }

  return { success: secretsStored, schemaName, connectionUrl: projectUrl };
}

export async function ensureProjectDatabaseProvisioned(
  projectId: string,
  userId?: string
): Promise<string> {
  const schemaName = sanitizeSchemaName(projectId);

  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  } finally {
    client.release();
  }

  return schemaName;
}

export function getProjectSchemaName(projectId: string): string {
  return sanitizeSchemaName(projectId);
}
