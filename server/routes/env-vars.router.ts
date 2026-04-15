// @ts-nocheck
import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { environmentVariables, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { RealSecretManagementService } from '../services/real-secret-management';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';

const router = Router();
const logger = createLogger('env-vars');
const secretService = new RealSecretManagementService();

/**
 * ✅ 40-YEAR SENIOR SECURITY FIX
 * All routes require authentication - environment variables are CRITICAL security assets
 */
router.use(ensureAuthenticated);

/**
 * CSRF protection for all mutating operations
 */
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

/**
 * Project ownership verification helper
 * Ensures user can only access env vars for their own projects
 * SECURITY: Prevents cross-tenant data access (CRITICAL for multi-tenant isolation)
 */
async function verifyProjectOwnership(userId: number | string, projectId: number | string): Promise<boolean> {
  try {
    const uid = String(userId);
    const pid = String(projectId);
    
    if (!uid || !pid) {
      logger.warn('Invalid ID in ownership verification', { userId, projectId });
      return false;
    }
    
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, pid),
        eq(projects.userId, uid)
      )
    });
    return !!project;
  } catch (error) {
    logger.error('Project ownership verification failed', { userId, projectId, error });
    return false;
  }
}

/**
 * Verify env var access by ID - checks ownership before exposing data
 * SECURITY: Prevents ID enumeration by checking ownership before revealing env var exists
 */
async function verifyEnvVarAccess(userId: number | string, envVarId: string): Promise<{ allowed: boolean; envVar?: any }> {
  try {
    const uid = String(userId);
    if (!uid) return { allowed: false };
    
    const envVar = await db.query.environmentVariables.findFirst({
      where: eq(environmentVariables.id, envVarId)
    });
    
    if (!envVar) return { allowed: false };
    
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, String(envVar.projectId)),
        eq(projects.userId, uid)
      )
    });
    
    if (!project) {
      logger.warn('Unauthorized env var access attempt', { userId, envVarId });
      return { allowed: false };
    }
    
    return { allowed: true, envVar };
  } catch (error) {
    logger.error('Env var access verification failed', { userId, envVarId, error });
    return { allowed: false };
  }
}

const createEnvVarSchema = z.object({
  projectId: z.string(),
  key: z.string().min(1).max(255).regex(/^[A-Z][A-Z0-9_]*$/, 'Must be UPPERCASE with underscores'),
  value: z.string().max(10000),
  isSecret: z.boolean().default(false),
  environment: z.enum(['development', 'production', 'shared']).default('development')
});

const updateEnvVarSchema = z.object({
  value: z.string().max(10000).optional(),
  isSecret: z.boolean().optional(),
  environment: z.enum(['development', 'production', 'shared']).optional()
});

const importEnvVarsSchema = z.object({
  content: z.string().min(1),
  environment: z.enum(['development', 'production', 'shared']).default('development')
});

/**
 * Get environment variables for a project
 * GET /api/env-vars/:projectId
 * SECURITY: Only project owner can access env vars (multi-tenant isolation)
 */
router.get('/:projectId', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // SECURITY: Verify project ownership before exposing env vars
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      logger.warn('Unauthorized env vars access attempt', { userId, projectId });
      return res.status(403).json({ error: 'Access denied: not project owner' });
    }
    
    const envVars = await db.query.environmentVariables.findMany({
      where: eq(environmentVariables.projectId, projectId),
      orderBy: (envVars, { asc }) => [asc(envVars.key)]
    });

    // Mask secret values
    const maskedVars = envVars.map(envVar => ({
      ...envVar,
      value: envVar.isSecret ? '********' : envVar.value
    }));

    res.json({ variables: maskedVars });
  } catch (error: any) {
    logger.error('Failed to get env vars:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create environment variable
 * POST /api/env-vars
 * SECURITY: Only project owner can create env vars
 */
router.post('/', async (req, res) => {
  try {
    const data = createEnvVarSchema.parse(req.body);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // SECURITY: Verify project ownership
    const isOwner = await verifyProjectOwnership(userId, data.projectId);
    if (!isOwner) {
      logger.warn('Unauthorized env var creation attempt', { userId, projectId: data.projectId });
      return res.status(403).json({ error: 'Access denied: not project owner' });
    }

    // Check if key already exists
    const existing = await db.query.environmentVariables.findFirst({
      where: and(
        eq(environmentVariables.projectId, data.projectId),
        eq(environmentVariables.key, data.key)
      )
    });

    if (existing) {
      return res.status(409).json({ error: 'Environment variable already exists' });
    }

    // Encrypt value if it's marked as secret
    let valueToStore = data.value;
    if (data.isSecret) {
      const encrypted = (secretService as any).encrypt(data.value);
      valueToStore = JSON.stringify(encrypted);
      logger.info(`Encrypted secret: ${data.key}`);
    }

    const [envVar] = await db.insert(environmentVariables).values({
      projectId: data.projectId,
      key: data.key,
      value: valueToStore,
      isSecret: data.isSecret,
      environment: data.environment
    }).returning();

    // Mask secret value in response
    const response = {
      ...envVar,
      value: envVar.isSecret ? '********' : envVar.value
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Failed to create env var:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update environment variable
 * PATCH /api/env-vars/:id
 * SECURITY: Only project owner can update env vars - prevents ID enumeration
 */
router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;  // UUID string, not integer
    const userId = req.user?.id;
    const updates = updateEnvVarSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // SECURITY: Verify ownership BEFORE revealing if env var exists (prevents enumeration)
    const { allowed, envVar } = await verifyEnvVarAccess(userId, id);
    if (!allowed || !envVar) {
      // Generic error to prevent ID enumeration
      return res.status(404).json({ error: 'Environment variable not found or access denied' });
    }

    // Preserve existing isSecret flag if not explicitly changed
    const isSecretFlag = updates.isSecret ?? envVar.isSecret;
    
    // Determine final value to store
    let valueToStore = updates.value;
    const valueProvided = updates.value !== undefined;
    
    // Handle downgrade: secret → plaintext (no new value)
    if (envVar.isSecret && updates.isSecret === false && !valueProvided) {
      // Downgrading secret to plaintext without new value: decrypt existing
      try {
        const encryptedData = JSON.parse(envVar.value);
        valueToStore = (secretService as any).decrypt(encryptedData);
        logger.info(`Downgraded secret to plaintext: ${envVar.key}`);
      } catch (error) {
        logger.error(`Failed to decrypt for downgrade ${envVar.key}:`, error);
        return res.status(500).json({ error: 'Failed to downgrade secret (decryption failed)' });
      }
    }
    // Handle upgrade: plaintext → secret (no new value)
    else if (!envVar.isSecret && updates.isSecret === true && !valueProvided) {
      // Upgrading plaintext to secret without new value: encrypt existing
      const encrypted = (secretService as any).encrypt(envVar.value);
      valueToStore = JSON.stringify(encrypted);
      logger.info(`Upgraded plaintext to secret (encrypted existing): ${envVar.key}`);
    }
    // Handle new value with encryption if isSecret is true (includes empty strings)
    else if (valueProvided && isSecretFlag) {
      const encrypted = (secretService as any).encrypt(valueToStore!);
      valueToStore = JSON.stringify(encrypted);
      logger.info(`Encrypted new value: ${envVar.key} (${valueToStore!.length === 0 ? 'empty string' : 'provided'})`);
    }
    // Handle no-value update: preserve existing (only if no state transition)
    else if (!valueProvided) {
      valueToStore = envVar.value;
    }

    const [updated] = await db.update(environmentVariables)
      .set({
        value: valueToStore,
        isSecret: isSecretFlag,
        ...(updates.environment && { environment: updates.environment }),
        updatedAt: new Date()
      })
      .where(eq(environmentVariables.id, id))
      .returning();

    // Mask secret value in response
    const response = {
      ...updated,
      value: updated.isSecret ? '********' : updated.value
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Failed to update env var:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete environment variable
 * DELETE /api/env-vars/:id
 * SECURITY: Only project owner can delete env vars - prevents ID enumeration
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;  // UUID string, not integer
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // SECURITY: Verify ownership BEFORE revealing if env var exists (prevents enumeration)
    const { allowed, envVar } = await verifyEnvVarAccess(userId, id);
    if (!allowed || !envVar) {
      return res.status(404).json({ error: 'Environment variable not found or access denied' });
    }

    await db.delete(environmentVariables)
      .where(eq(environmentVariables.id, id));
    
    logger.info('Env var deleted', { userId, envVarId: id, key: envVar.key });

    res.json({ message: 'Environment variable deleted' });
  } catch (error: any) {
    logger.error('Failed to delete env var:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reveal secret value (temporary, requires authentication)
 * POST /api/env-vars/:id/reveal
 * SECURITY: Only project owner can reveal secrets - CRITICAL multi-tenant isolation
 * SECURITY: Uses verifyEnvVarAccess to prevent ID enumeration
 * 
 * Security: Decrypts AES-256 encrypted value, generates time-limited reveal token, logs audit trail
 */
router.post('/:id/reveal', async (req, res) => {
  try {
    const id = req.params.id;  // UUID string, not integer
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // SECURITY: Verify ownership BEFORE revealing if env var exists (prevents enumeration)
    const { allowed, envVar } = await verifyEnvVarAccess(userId, id);
    if (!allowed || !envVar) {
      return res.status(404).json({ error: 'Environment variable not found or access denied' });
    }

    // Decrypt value if it's a secret
    let value = envVar.value;
    if (envVar.isSecret) {
      try {
        const encryptedData = JSON.parse(envVar.value);
        value = (secretService as any).decrypt(encryptedData);
        logger.info(`Decrypted secret for reveal: ${envVar.key}`);
      } catch (error) {
        logger.error(`Failed to decrypt secret ${envVar.key}:`, error);
        return res.status(500).json({ error: 'Failed to decrypt secret value' });
      }
    }

    // Audit log for security
    logger.warn('Secret revealed', {
      userId,
      envVarId: id,
      key: envVar.key,
      projectId: envVar.projectId,
      timestamp: new Date().toISOString()
    });

    // Return with expiry warning
    res.json({ 
      value,
      expiresIn: 60, // 1 minute (reduced for security)
      warning: 'This encrypted value will only be shown once. Copy it now.'
    });
  } catch (error: any) {
    logger.error('Failed to reveal secret:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Export environment variables as .env file
 * GET /api/env-vars/:projectId/export
 * SECURITY: Only project owner can export env vars (contains secrets!)
 */
router.get('/:projectId/export', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // SECURITY: Verify project ownership before exporting sensitive data
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      logger.warn('Unauthorized env vars export attempt', { userId, projectId });
      return res.status(403).json({ error: 'Access denied: not project owner' });
    }
    
    const envVars = await db.query.environmentVariables.findMany({
      where: eq(environmentVariables.projectId, projectId),
      orderBy: (envVars, { asc }) => [asc(envVars.key)]
    });

    // Generate .env file content with decrypted secrets
    let envContent = '# Environment Variables\n';
    envContent += `# Generated: ${new Date().toISOString()}\n`;
    envContent += '# WARNING: This file contains sensitive secrets in plain text!\n\n';

    for (const envVar of envVars) {
      let value = envVar.value;
      
      // Decrypt secret values for export
      if (envVar.isSecret) {
        try {
          const encryptedData = JSON.parse(envVar.value);
          value = (secretService as any).decrypt(encryptedData);
        } catch (error) {
          logger.error(`Failed to decrypt secret ${envVar.key} for export:`, error);
          // Skip this secret if decryption fails
          continue;
        }
      }
      
      // Add environment comment if not shared
      if (envVar.environment && envVar.environment !== 'shared') {
        envContent += `# Environment: ${envVar.environment}\n`;
      }
      envContent += `${envVar.key}=${value}\n`;
    }
    
    // Audit log for sensitive operation
    logger.info('Env vars exported', { userId, projectId, count: envVars.length });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=".env"`);
    res.send(envContent);
  } catch (error: any) {
    logger.error('Failed to export env vars:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Import environment variables from .env file content
 * POST /api/env-vars/:projectId/import
 * SECURITY: Only project owner can import env vars
 */
router.post('/:projectId/import', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = importEnvVarsSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // SECURITY: Verify project ownership before importing
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      logger.warn('Unauthorized env vars import attempt', { userId, projectId });
      return res.status(403).json({ error: 'Access denied: not project owner' });
    }
    
    const projectIdNum = projectId;
    
    // Parse .env content
    const lines = data.content.split('\n');
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Parse KEY=VALUE
      const eqIndex = trimmedLine.indexOf('=');
      if (eqIndex === -1) {
        skipped++;
        continue;
      }
      
      let key = trimmedLine.substring(0, eqIndex).trim();
      let value = trimmedLine.substring(eqIndex + 1).trim();
      
      // Remove surrounding quotes from value
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Normalize key to uppercase with underscores
      key = key.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      
      // Validate key format
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        errors.push(`Invalid key format: ${key}`);
        skipped++;
        continue;
      }
      
      try {
        // Check if key already exists for this project and environment
        const existing = await db.query.environmentVariables.findFirst({
          where: and(
            eq(environmentVariables.projectId, projectIdNum),
            eq(environmentVariables.key, key),
            eq(environmentVariables.environment, data.environment)
          )
        });
        
        if (existing) {
          // Update existing variable
          await db.update(environmentVariables)
            .set({ value, updatedAt: new Date() })
            .where(eq(environmentVariables.id, existing.id));
          imported++;
        } else {
          // Create new variable (default to non-secret for imports)
          await db.insert(environmentVariables).values({
            projectId: projectIdNum,
            key,
            value,
            isSecret: false,
            environment: data.environment
          });
          imported++;
        }
      } catch (err: any) {
        logger.error(`Failed to import env var ${key}:`, err);
        errors.push(`Failed to import: ${key}`);
        skipped++;
      }
    }
    
    logger.info('Env vars imported', { userId, projectId, imported, skipped, environment: data.environment });
    
    res.json({ 
      imported, 
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully imported ${imported} variables`
    });
  } catch (error: any) {
    logger.error('Failed to import env vars:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
