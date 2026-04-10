// @ts-nocheck
import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { RealSecretManagementService } from '../services/real-secret-management';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';
import { withScopedTransaction } from '../services/persistence-engine';

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
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user?.id;
    const environment = req.query.environment as string | undefined;
    const search = req.query.search as string | undefined;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
      const envVars = await scopedQueries.getEnvVarsByProject(
        projectId,
        environment && environment !== 'all' ? environment : undefined
      );
      return envVars;
    });

    if (!result.success) {
      logger.error('Failed to get secrets', { error: result.error });
      return res.status(500).json({ error: 'Failed to retrieve secrets' });
    }

    let secrets = result.data || [];
    
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
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user?.id;
    const data = createSecretSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
      const existing = await scopedQueries.getEnvVarByKey(projectId, data.key, data.environment);
      if (existing) {
        throw new Error('SECRET_EXISTS');
      }

      let valueToStore = data.value;
      if (data.isSecret) {
        const encrypted = (secretService as any).encrypt(data.value);
        valueToStore = JSON.stringify(encrypted);
      }

      const secret = await scopedQueries.createEnvVar(projectId, {
        key: data.key,
        value: valueToStore,
        environment: data.environment,
        isSecret: data.isSecret
      });
      
      return secret;
    });

    if (!result.success) {
      if (result.error?.message === 'SECRET_EXISTS') {
        return res.status(409).json({ error: 'Secret already exists for this environment' });
      }
      if (result.error?.message?.includes('not found or access denied')) {
        return res.status(403).json({ error: 'Access denied' });
      }
      logger.error('Failed to create secret', { error: result.error });
      return res.status(500).json({ error: 'Failed to create secret' });
    }

    const response = {
      ...result.data,
      value: result.data!.isSecret ? '********' : result.data!.value
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Failed to create secret:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user?.id;
    const updates = updateSecretSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
      const envVars = await scopedQueries.getEnvVarsByProject(projectId);
      const secret = envVars.find(v => v.id === id);
      
      if (!secret) {
        throw new Error('SECRET_NOT_FOUND');
      }

      const isSecretFlag = updates.isSecret ?? secret.isSecret;
      let valueToStore = updates.value;
      const valueProvided = updates.value !== undefined;
      
      if (secret.isSecret && updates.isSecret === false && !valueProvided) {
        try {
          const encryptedData = JSON.parse(secret.value);
          valueToStore = (secretService as any).decrypt(encryptedData);
        } catch (err: any) { console.error("[catch]", err?.message || err);
          throw new Error('DECRYPT_FAILED');
        }
      } else if (!secret.isSecret && updates.isSecret === true && !valueProvided) {
        const encrypted = (secretService as any).encrypt(secret.value);
        valueToStore = JSON.stringify(encrypted);
      } else if (valueProvided && isSecretFlag) {
        const encrypted = (secretService as any).encrypt(valueToStore!);
        valueToStore = JSON.stringify(encrypted);
      } else if (!valueProvided) {
        valueToStore = secret.value;
      }

      const updated = await scopedQueries.updateEnvVar(projectId, id, {
        value: valueToStore,
        environment: updates.environment ?? secret.environment,
        isSecret: isSecretFlag
      });
      
      return updated;
    });

    if (!result.success) {
      if (result.error?.message === 'SECRET_NOT_FOUND') {
        return res.status(404).json({ error: 'Secret not found' });
      }
      if (result.error?.message === 'DECRYPT_FAILED') {
        return res.status(500).json({ error: 'Failed to downgrade secret' });
      }
      logger.error('Failed to update secret', { error: result.error });
      return res.status(500).json({ error: 'Failed to update secret' });
    }

    const response = {
      ...result.data,
      value: result.data!.isSecret ? '********' : result.data!.value
    };

    res.json(response);
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
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
      const envVars = await scopedQueries.getEnvVarsByProject(projectId);
      const secret = envVars.find(v => v.id === id);
      
      if (!secret) {
        throw new Error('SECRET_NOT_FOUND');
      }

      await scopedQueries.deleteEnvVar(projectId, id);
      return true;
    });

    if (!result.success) {
      if (result.error?.message === 'SECRET_NOT_FOUND') {
        return res.status(404).json({ error: 'Secret not found' });
      }
      logger.error('Failed to delete secret', { error: result.error });
      return res.status(500).json({ error: 'Failed to delete secret' });
    }

    res.json({ message: 'Secret deleted' });
  } catch (error: any) {
    logger.error('Failed to delete secret:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reveal', async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = parseInt(req.params.projectId, 10);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
      const envVars = await scopedQueries.getEnvVarsByProject(projectId);
      const secret = envVars.find(v => v.id === id);
      
      if (!secret) {
        throw new Error('SECRET_NOT_FOUND');
      }

      let value = secret.value;
      if (secret.isSecret) {
        try {
          const encryptedData = JSON.parse(secret.value);
          value = (secretService as any).decrypt(encryptedData);
        } catch (err: any) { console.error("[catch]", err?.message || err);
          throw new Error('DECRYPT_FAILED');
        }
      }

      logger.warn('Secret revealed', {
        userId,
        secretId: id,
        key: secret.key,
        projectId: secret.projectId
      });

      return { value, secret };
    });

    if (!result.success) {
      if (result.error?.message === 'SECRET_NOT_FOUND') {
        return res.status(404).json({ error: 'Secret not found' });
      }
      if (result.error?.message === 'DECRYPT_FAILED') {
        return res.status(500).json({ error: 'Failed to decrypt secret' });
      }
      logger.error('Failed to reveal secret', { error: result.error });
      return res.status(500).json({ error: 'Failed to reveal secret' });
    }

    res.json({ 
      value: result.data!.value,
      expiresIn: 60
    });
  } catch (error: any) {
    logger.error('Failed to reveal secret:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
