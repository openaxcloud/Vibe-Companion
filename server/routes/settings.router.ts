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
const logger = createLogger('settings');

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

const updateSettingsSchema = z.object({
  fontSize: z.string().optional(),
  tabSize: z.string().optional(),
  wordWrap: z.boolean().optional(),
  lineNumbers: z.boolean().optional(),
  minimap: z.boolean().optional(),
  autoSave: z.boolean().optional(),
  formatOnSave: z.boolean().optional(),
  editorTheme: z.string().optional(),
  projectName: z.string().max(100).optional(),
  projectDescription: z.string().max(500).optional(),
  projectPrivacy: z.enum(['public', 'private', 'unlisted']).optional(),
  themeId: z.string().max(50).optional(),
  customColors: z.record(z.string()).optional(),
  borderRadius: z.number().int().min(0).max(24).optional(),
});

export type ProjectSettingsData = z.infer<typeof updateSettingsSchema>;

const defaultSettings: ProjectSettingsData = {
  fontSize: '14',
  tabSize: '2',
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoSave: true,
  formatOnSave: true,
  editorTheme: 'vs-light',
  projectName: 'My Project',
  projectDescription: 'A Replit project',
  projectPrivacy: 'public',
  themeId: 'light',
  customColors: {},
  borderRadius: 4,
};

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
        ...defaultSettings,
      });
    }

    const customColors = settings.customColors as Record<string, any> || {};
    
    res.json({
      projectId: projectIdNum,
      fontSize: customColors.fontSize ?? defaultSettings.fontSize,
      tabSize: customColors.tabSize ?? defaultSettings.tabSize,
      wordWrap: customColors.wordWrap ?? defaultSettings.wordWrap,
      lineNumbers: customColors.lineNumbers ?? defaultSettings.lineNumbers,
      minimap: customColors.minimap ?? defaultSettings.minimap,
      autoSave: customColors.autoSave ?? defaultSettings.autoSave,
      formatOnSave: customColors.formatOnSave ?? defaultSettings.formatOnSave,
      editorTheme: customColors.editorTheme ?? defaultSettings.editorTheme,
      projectName: customColors.projectName ?? defaultSettings.projectName,
      projectDescription: customColors.projectDescription ?? defaultSettings.projectDescription,
      projectPrivacy: customColors.projectPrivacy ?? defaultSettings.projectPrivacy,
      themeId: settings.themeId ?? defaultSettings.themeId,
      customColors: customColors.colors ?? defaultSettings.customColors,
      borderRadius: settings.borderRadius ?? defaultSettings.borderRadius,
    });
  } catch (error: any) {
    logger.error('Failed to get project settings:', error);
    res.status(500).json({ error: error.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = updateSettingsSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectIdNum = parseInt(projectId, 10);
    
    const customColorsData = {
      fontSize: data.fontSize,
      tabSize: data.tabSize,
      wordWrap: data.wordWrap,
      lineNumbers: data.lineNumbers,
      minimap: data.minimap,
      autoSave: data.autoSave,
      formatOnSave: data.formatOnSave,
      editorTheme: data.editorTheme,
      projectName: data.projectName,
      projectDescription: data.projectDescription,
      projectPrivacy: data.projectPrivacy,
      colors: data.customColors,
    };

    const existing = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.projectId, projectIdNum)
    });

    if (existing) {
      const existingCustomColors = existing.customColors as Record<string, any> || {};
      
      const [updated] = await db.update(projectSettings)
        .set({
          themeId: data.themeId ?? existing.themeId,
          fontSize: data.fontSize ? parseInt(data.fontSize, 10) : existing.fontSize,
          borderRadius: data.borderRadius ?? existing.borderRadius,
          customColors: { ...existingCustomColors, ...customColorsData },
          updatedAt: new Date()
        })
        .where(eq(projectSettings.projectId, projectIdNum))
        .returning();

      const returnData = {
        projectId: projectIdNum,
        fontSize: customColorsData.fontSize ?? defaultSettings.fontSize,
        tabSize: customColorsData.tabSize ?? defaultSettings.tabSize,
        wordWrap: customColorsData.wordWrap ?? defaultSettings.wordWrap,
        lineNumbers: customColorsData.lineNumbers ?? defaultSettings.lineNumbers,
        minimap: customColorsData.minimap ?? defaultSettings.minimap,
        autoSave: customColorsData.autoSave ?? defaultSettings.autoSave,
        formatOnSave: customColorsData.formatOnSave ?? defaultSettings.formatOnSave,
        editorTheme: customColorsData.editorTheme ?? defaultSettings.editorTheme,
        projectName: customColorsData.projectName ?? defaultSettings.projectName,
        projectDescription: customColorsData.projectDescription ?? defaultSettings.projectDescription,
        projectPrivacy: customColorsData.projectPrivacy ?? defaultSettings.projectPrivacy,
        themeId: updated.themeId ?? defaultSettings.themeId,
        customColors: customColorsData.colors ?? defaultSettings.customColors,
        borderRadius: updated.borderRadius ?? defaultSettings.borderRadius,
      };

      return res.json(returnData);
    }

    const [created] = await db.insert(projectSettings).values({
      projectId: projectIdNum,
      themeId: data.themeId ?? 'light',
      fontSize: data.fontSize ? parseInt(data.fontSize, 10) : 14,
      borderRadius: data.borderRadius ?? 4,
      customColors: customColorsData,
    }).returning();

    res.status(201).json({
      projectId: projectIdNum,
      fontSize: data.fontSize ?? defaultSettings.fontSize,
      tabSize: data.tabSize ?? defaultSettings.tabSize,
      wordWrap: data.wordWrap ?? defaultSettings.wordWrap,
      lineNumbers: data.lineNumbers ?? defaultSettings.lineNumbers,
      minimap: data.minimap ?? defaultSettings.minimap,
      autoSave: data.autoSave ?? defaultSettings.autoSave,
      formatOnSave: data.formatOnSave ?? defaultSettings.formatOnSave,
      editorTheme: data.editorTheme ?? defaultSettings.editorTheme,
      projectName: data.projectName ?? defaultSettings.projectName,
      projectDescription: data.projectDescription ?? defaultSettings.projectDescription,
      projectPrivacy: data.projectPrivacy ?? defaultSettings.projectPrivacy,
      themeId: created.themeId ?? defaultSettings.themeId,
      customColors: data.customColors ?? defaultSettings.customColors,
      borderRadius: created.borderRadius ?? defaultSettings.borderRadius,
    });
  } catch (error: any) {
    logger.error('Failed to update project settings:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
