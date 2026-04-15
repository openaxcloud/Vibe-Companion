// @ts-nocheck
import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { RealSecretManagementService } from '../services/real-secret-management';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { db } from '../db';
import { environmentVariables, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router({ mergeParams: true });
const logger = createLogger('secrets');
const secretService = new RealSecretManagementService();

router.use(ensureAuthenticated);

router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

const createSecretSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9_]*$/, 'Must be UPPERCASE with underscores'),
  value: z.string().max(10000),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  isSecret: z.boolean().default(true)
});

const updateSecretSchema = z.object({
  value: z.string().max(10000).optional(),
  environment: z.enum(['development', 'staging', 'production']).optional(),
  isSecret: z.boolean().optional()
});

router.get('/', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const environment = req.query.environment as string | undefined;
    const search = req.query.search as string | undefined;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId))
    });
    if (!project) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let conditions = [eq(environmentVariables.projectId, projectId)];
    if (environment && environment !== 'all') {
      conditions.push(eq(environmentVariables.environment, environment));
    }

    let secrets = await db.query.environmentVariables.findMany({
      where: and(...conditions),
      orderBy: (ev, { asc }) => [asc(ev.key)]
    });
    
    if (search) {
      const searchLower = search.toLowerCase();
      secrets = secrets.filter(s => s.key.toLowerCase().includes(searchLower));
    }

    const maskedSecrets = secrets.map(secret => ({
      ...secret,
      value: secret.isSecret ? '********' : secret.value
    }));

    res.json({ secrets: maskedSecrets });
  } catch (error: any) {
    logger.error('Failed to get secrets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = createSecretSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId))
    });
    if (!project) return res.status(403).json({ error: 'Access denied' });

    const existing = await db.query.environmentVariables.findFirst({
      where: and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.key, data.key)
      )
    });
    if (existing) return res.status(409).json({ error: 'Secret already exists for this environment' });

    let valueToStore = data.value;
    if (data.isSecret) {
      try { valueToStore = JSON.stringify((secretService as any).encrypt(data.value)); } catch (err) {
        logger.error('Encryption failed for secret', { key: data.key, error: err });
        return res.status(500).json({ error: 'Failed to encrypt secret value' });
      }
    }

    const [secret] = await db.insert(environmentVariables).values({
      projectId,
      key: data.key,
      value: valueToStore,
      environment: data.environment || 'development',
      isSecret: data.isSecret || false
    }).returning();

    res.status(201).json({ ...secret, value: secret.isSecret ? '********' : secret.value });
  } catch (error: any) {
    logger.error('Failed to create secret:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/account', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { db } = await import('../db');
    const { accountEnvVars, accountEnvVarLinks } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');

    const projectId = req.params.projectId;

    const accountVars = await db.select().from(accountEnvVars).where(eq(accountEnvVars.userId, String(userId)));

    let linkedIds = new Set<string>();
    if (projectId) {
      const links = await db.select().from(accountEnvVarLinks).where(eq(accountEnvVarLinks.projectId, projectId));
      linkedIds = new Set(links.map(l => l.accountEnvVarId));
    }

    const secrets = accountVars.map(v => {
      return {
        id: v.id,
        key: v.key,
        value: '********',
        isSecret: true,
        scope: 'account' as const,
        linked: projectId ? linkedIds.has(v.id) : undefined,
        createdAt: v.createdAt,
      };
    });

    res.json({ secrets });
  } catch (error: any) {
    logger.error('Failed to list account secrets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/account', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const data = z.object({
      key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9_]*$/),
      value: z.string().max(10000),
    }).parse(req.body);

    const { db } = await import('../db');
    const { accountEnvVars } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');
    const { encrypt } = await import('../encryption');

    const existing = await db.select().from(accountEnvVars)
      .where(and(eq(accountEnvVars.userId, String(userId)), eq(accountEnvVars.key, data.key)));
    if (existing.length > 0) {
      return res.status(409).json({ error: `Account secret "${data.key}" already exists` });
    }

    const [created] = await db.insert(accountEnvVars).values({
      userId: String(userId),
      key: data.key,
      encryptedValue: encrypt(data.value),
    }).returning();

    res.status(201).json({ id: created.id, key: created.key });
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: error.errors });
    logger.error('Failed to create account secret:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/account/:accountSecretId', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { accountSecretId } = req.params;
    const { db } = await import('../db');
    const { accountEnvVars, accountEnvVarLinks } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const [existing] = await db.select().from(accountEnvVars)
      .where(and(eq(accountEnvVars.id, accountSecretId), eq(accountEnvVars.userId, String(userId))));
    if (!existing) return res.status(404).json({ error: 'Account secret not found' });

    await db.delete(accountEnvVarLinks).where(eq(accountEnvVarLinks.accountEnvVarId, accountSecretId));
    await db.delete(accountEnvVars).where(eq(accountEnvVars.id, accountSecretId));

    res.json({ message: 'Account secret deleted' });
  } catch (error: any) {
    logger.error('Failed to delete account secret:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/account/:accountSecretId/link', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { accountSecretId } = req.params;
    const projectId = req.params.projectId;
    if (!projectId) return res.status(400).json({ error: 'Project ID required' });

    const { db } = await import('../db');
    const { accountEnvVars, accountEnvVarLinks, projects } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const [project] = await db.select({ id: projects.id, userId: projects.userId }).from(projects).where(eq(projects.id, projectId));
    if (!project || String(project.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const [existing] = await db.select().from(accountEnvVars)
      .where(and(eq(accountEnvVars.id, accountSecretId), eq(accountEnvVars.userId, String(userId))));
    if (!existing) return res.status(404).json({ error: 'Account secret not found' });

    await db.insert(accountEnvVarLinks).values({
      accountEnvVarId: accountSecretId,
      projectId,
    }).onConflictDoNothing();

    res.json({ message: 'Linked to project' });
  } catch (error: any) {
    logger.error('Failed to link account secret:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/account/:accountSecretId/link', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { accountSecretId } = req.params;
    const projectId = req.params.projectId;
    if (!projectId) return res.status(400).json({ error: 'Project ID required' });

    const { db } = await import('../db');
    const { accountEnvVarLinks, projects } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const [project] = await db.select({ id: projects.id, userId: projects.userId }).from(projects).where(eq(projects.id, projectId));
    if (!project || String(project.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    await db.delete(accountEnvVarLinks).where(
      and(eq(accountEnvVarLinks.accountEnvVarId, accountSecretId), eq(accountEnvVarLinks.projectId, projectId))
    );

    res.json({ message: 'Unlinked from project' });
  } catch (error: any) {
    logger.error('Failed to unlink account secret:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const updates = updateSecretSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId))
    });
    if (!project) return res.status(403).json({ error: 'Access denied' });

    const secret = await db.query.environmentVariables.findFirst({
      where: and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId))
    });
    if (!secret) return res.status(404).json({ error: 'Secret not found' });

    const isSecretFlag = updates.isSecret ?? secret.isSecret;
    let valueToStore = updates.value;
    const valueProvided = updates.value !== undefined;

    if (secret.isSecret && updates.isSecret === false && !valueProvided) {
      try { valueToStore = (secretService as any).decrypt(JSON.parse(secret.value)); } catch { return res.status(500).json({ error: 'Failed to downgrade secret' }); }
    } else if (!secret.isSecret && updates.isSecret === true && !valueProvided) {
      valueToStore = JSON.stringify((secretService as any).encrypt(secret.value));
    } else if (valueProvided && isSecretFlag) {
      valueToStore = JSON.stringify((secretService as any).encrypt(valueToStore!));
    } else if (!valueProvided) {
      valueToStore = secret.value;
    }

    const [updated] = await db.update(environmentVariables)
      .set({ value: valueToStore, environment: updates.environment ?? secret.environment, isSecret: isSecretFlag })
      .where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)))
      .returning();

    res.json({ ...updated, value: updated.isSecret ? '********' : updated.value });
  } catch (error: any) {
    logger.error('Failed to update secret:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId))
    });
    if (!project) return res.status(403).json({ error: 'Access denied' });

    const secret = await db.query.environmentVariables.findFirst({
      where: and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId))
    });
    if (!secret) return res.status(404).json({ error: 'Secret not found' });

    await db.delete(environmentVariables).where(and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId)));
    res.json({ message: 'Secret deleted' });
  } catch (error: any) {
    logger.error('Failed to delete secret:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reveal', async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.params.projectId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!projectId) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId))
    });
    if (!project) return res.status(403).json({ error: 'Access denied' });

    const secret = await db.query.environmentVariables.findFirst({
      where: and(eq(environmentVariables.id, id), eq(environmentVariables.projectId, projectId))
    });
    if (!secret) return res.status(404).json({ error: 'Secret not found' });

    let value = secret.value;
    if (secret.isSecret) {
      try { value = (secretService as any).decrypt(JSON.parse(secret.value)); }
      catch { return res.status(500).json({ error: 'Failed to decrypt secret' }); }
    }

    logger.warn('Secret revealed', { userId, secretId: id, key: secret.key, projectId: secret.projectId });
    res.json({ value, expiresIn: 60 });
  } catch (error: any) {
    logger.error('Failed to reveal secret:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
