import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { projectExtensions, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';

const router = Router();
const logger = createLogger('extensions');

const EXTENSION_CATEGORIES = ['themes', 'languages', 'tools', 'formatters', 'linters', 'snippets'] as const;

const MARKETPLACE_EXTENSIONS = [
  { extensionId: 'theme-dark-plus', name: 'Dark+ Theme', description: 'Visual Studio Code dark theme', author: 'Microsoft', version: '1.0.0', category: 'themes', icon: 'palette' },
  { extensionId: 'theme-monokai', name: 'Monokai Theme', description: 'Classic Monokai color theme', author: 'Monokai', version: '1.0.0', category: 'themes', icon: 'palette' },
  { extensionId: 'theme-solarized', name: 'Solarized Theme', description: 'Precision colors for machines and people', author: 'Ethan Schoonover', version: '1.0.0', category: 'themes', icon: 'palette' },
  { extensionId: 'lang-python', name: 'Python Language Support', description: 'Rich Python language support with IntelliSense', author: 'E-Code', version: '2.0.0', category: 'languages', icon: 'code' },
  { extensionId: 'lang-typescript', name: 'TypeScript Language Support', description: 'TypeScript/JavaScript language features', author: 'E-Code', version: '2.0.0', category: 'languages', icon: 'code' },
  { extensionId: 'lang-rust', name: 'Rust Language Support', description: 'Rust language support with rust-analyzer', author: 'E-Code', version: '1.5.0', category: 'languages', icon: 'code' },
  { extensionId: 'tool-git', name: 'Git Integration', description: 'Source control with Git', author: 'E-Code', version: '1.0.0', category: 'tools', icon: 'git-branch' },
  { extensionId: 'tool-docker', name: 'Docker Integration', description: 'Build, manage, and deploy containers', author: 'E-Code', version: '1.0.0', category: 'tools', icon: 'box' },
  { extensionId: 'formatter-prettier', name: 'Prettier', description: 'Code formatter using Prettier', author: 'Prettier', version: '3.0.0', category: 'formatters', icon: 'wand' },
  { extensionId: 'formatter-black', name: 'Black Formatter', description: 'Python code formatter', author: 'Python Software Foundation', version: '24.0.0', category: 'formatters', icon: 'wand' },
  { extensionId: 'linter-eslint', name: 'ESLint', description: 'JavaScript and TypeScript linter', author: 'ESLint', version: '9.0.0', category: 'linters', icon: 'check-circle' },
  { extensionId: 'linter-pylint', name: 'Pylint', description: 'Python static code analysis', author: 'Python Software Foundation', version: '3.0.0', category: 'linters', icon: 'check-circle' },
  { extensionId: 'snippets-react', name: 'React Snippets', description: 'React code snippets', author: 'E-Code', version: '1.0.0', category: 'snippets', icon: 'file-code' },
  { extensionId: 'snippets-python', name: 'Python Snippets', description: 'Python code snippets', author: 'E-Code', version: '1.0.0', category: 'snippets', icon: 'file-code' },
];

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

const installExtensionSchema = z.object({
  extensionId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  author: z.string().max(100).optional(),
  version: z.string().max(50).optional(),
  category: z.enum(EXTENSION_CATEGORIES).optional(),
  icon: z.string().max(50).optional(),
});

const toggleExtensionSchema = z.object({
  enabled: z.boolean(),
});

router.get('/', (_req, res) => {
  res.status(404).json({ error: 'Project ID required. Use /api/extensions/marketplace or /api/extensions/:projectId/installed' });
});

router.get('/marketplace', async (_req, res) => {
  try {
    res.json({
      extensions: MARKETPLACE_EXTENSIONS,
      categories: EXTENSION_CATEGORIES,
    });
  } catch (error: any) {
    logger.error('Failed to get marketplace extensions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:projectId/installed', ensureAuthenticated, async (req, res) => {
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
    
    const installed = await db.query.projectExtensions.findMany({
      where: eq(projectExtensions.projectId, projectIdNum)
    });

    res.json(installed);
  } catch (error: any) {
    logger.error('Failed to get installed extensions:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/install', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const data = installExtensionSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectIdNum = parseInt(projectId, 10);
    
    const existing = await db.query.projectExtensions.findFirst({
      where: and(
        eq(projectExtensions.projectId, projectIdNum),
        eq(projectExtensions.extensionId, data.extensionId)
      )
    });

    if (existing) {
      return res.status(409).json({ error: 'Extension already installed' });
    }

    const [created] = await db.insert(projectExtensions).values({
      projectId: projectIdNum,
      extensionId: data.extensionId,
      name: data.name,
      description: data.description ?? null,
      author: data.author ?? null,
      version: data.version ?? null,
      category: data.category ?? null,
      icon: data.icon ?? null,
      enabled: true,
    }).returning();

    logger.info('Extension installed', { projectId: projectIdNum, extensionId: data.extensionId });
    res.status(201).json(created);
  } catch (error: any) {
    logger.error('Failed to install extension:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/:extensionId', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const { projectId, extensionId } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectIdNum = parseInt(projectId, 10);
    
    const existing = await db.query.projectExtensions.findFirst({
      where: and(
        eq(projectExtensions.projectId, projectIdNum),
        eq(projectExtensions.extensionId, extensionId)
      )
    });

    if (!existing) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    await db.delete(projectExtensions).where(
      and(
        eq(projectExtensions.projectId, projectIdNum),
        eq(projectExtensions.extensionId, extensionId)
      )
    );

    logger.info('Extension uninstalled', { projectId: projectIdNum, extensionId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to uninstall extension:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:projectId/:extensionId', ensureAuthenticated, csrfProtection, async (req, res) => {
  try {
    const { projectId, extensionId } = req.params;
    const userId = req.user?.id;
    const data = toggleExtensionSchema.parse(req.body);
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const projectIdNum = parseInt(projectId, 10);
    
    const existing = await db.query.projectExtensions.findFirst({
      where: and(
        eq(projectExtensions.projectId, projectIdNum),
        eq(projectExtensions.extensionId, extensionId)
      )
    });

    if (!existing) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    const [updated] = await db.update(projectExtensions)
      .set({ enabled: data.enabled })
      .where(
        and(
          eq(projectExtensions.projectId, projectIdNum),
          eq(projectExtensions.extensionId, extensionId)
        )
      )
      .returning();

    logger.info('Extension toggled', { projectId: projectIdNum, extensionId, enabled: data.enabled });
    res.json(updated);
  } catch (error: any) {
    logger.error('Failed to toggle extension:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
