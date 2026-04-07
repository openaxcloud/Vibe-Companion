// @ts-nocheck
import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { projectSettings, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';

const router = Router({ mergeParams: true });
const logger = createLogger('themes');

router.use(ensureAuthenticated);

router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

async function verifyProjectOwnership(userId: number | string, projectId: number | string): Promise<boolean> {
  try {
    const userIdNum = typeof userId === 'number' ? userId : parseInt(String(userId), 10);
    const projectIdNum = typeof projectId === 'number' ? projectId : parseInt(String(projectId), 10);
    
    if (isNaN(userIdNum) || isNaN(projectIdNum) || userIdNum <= 0 || projectIdNum <= 0) {
      return false;
    }
    
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectIdNum),
        eq(projects.ownerId, userIdNum)
      )
    });
    return !!project;
  } catch (error) {
    logger.error('Project ownership verification failed', { userId, projectId, error });
    return false;
  }
}

const updateThemeSchema = z.object({
  themeId: z.string().max(50).optional(),
  customColors: z.record(z.string()).optional(),
  fontSize: z.number().int().min(8).max(32).optional(),
  borderRadius: z.number().int().min(0).max(24).optional(),
});

router.get('/', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const projectIdNum = parseInt(projectId, 10);
    
    const settings = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, projectIdNum)
    });

    if (!settings) {
      return res.json({
        projectId: projectIdNum,
        themeId: 'light',
        customColors: {},
        fontSize: 14,
        borderRadius: 4,
      });
    }

    res.json(settings);
  } catch (error: any) {
    logger.error('Failed to get theme settings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = updateThemeSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectIdNum = parseInt(projectId, 10);
    
    const existing = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, projectIdNum)
    });

    if (existing) {
      const [updated] = await db.update(projectSettings)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(projectSettings.projectId, projectIdNum))
        .returning();

      return res.json(updated);
    }

    const [created] = await db.insert(projectSettings).values({
      projectId: projectIdNum,
      themeId: data.themeId ?? 'light',
      customColors: data.customColors ?? {},
      fontSize: data.fontSize ?? 14,
      borderRadius: data.borderRadius ?? 4,
    }).returning();

    res.status(201).json(created);
  } catch (error: any) {
    logger.error('Failed to update theme settings:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
