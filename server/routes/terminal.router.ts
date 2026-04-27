import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import type { InsertTerminalLog } from '@shared/schema';
import { bulkSyncProjectFiles, getProjectWorkspacePath } from '../utils/project-fs-sync';

const router = Router();

/**
 * GET /api/terminal/logs
 * Fetch console logs for a project from database (persistent)
 */
router.get('/logs', ensureAuthenticated, async (req, res) => {
  try {
    const projectIdParam = req.query.projectId;
    
    if (!projectIdParam) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const projectId = projectIdParam as string;
    
    // Check project access
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check access permissions
    if (String(project.ownerId) !== String(userId)) {
      const collaborators = await storage.getProjectCollaborators(projectId);
      const isCollaborator = collaborators.some((c: any) => String(c.userId) === String(userId));
      
      if (!isCollaborator) {
        return res.status(403).json({ error: "You don't have access to this project" });
      }
    }
    
    // Get logs from database (persistent storage)
    const logs = await storage.getTerminalLogs(projectId);
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching terminal logs:', error);
    res.status(500).json({ error: 'Failed to fetch terminal logs' });
  }
});

/**
 * POST /api/terminal/logs
 * Add a log entry to database (persistent storage)
 */
router.post('/logs', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, type, message, stack, source } = req.body;
    
    if (!projectId || !type || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check project access
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check access permissions
    if (String(project.ownerId) !== String(userId)) {
      const collaborators = await storage.getProjectCollaborators(projectId);
      const isCollaborator = collaborators.some((c: any) => String(c.userId) === String(userId));
      
      if (!isCollaborator) {
        return res.status(403).json({ error: "You don't have access to this project" });
      }
    }
    
    // Create log entry in database (persistent)
    const logEntry: InsertTerminalLog = {
      projectId,
      userId,
      type,
      message,
      stack,
      source: source || 'terminal'
    };
    
    const newLog = await storage.createTerminalLog(logEntry);
    
    res.json({ success: true, log: newLog });
  } catch (error) {
    console.error('Error adding terminal log:', error);
    res.status(500).json({ error: 'Failed to add terminal log' });
  }
});

/**
 * DELETE /api/terminal/logs
 * Clear logs for a project from database (persistent)
 */
router.delete('/logs', ensureAuthenticated, async (req, res) => {
  try {
    const projectIdParam = req.query.projectId;
    
    if (!projectIdParam) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const projectId = projectIdParam as string;
    
    // Check project access
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check access permissions
    if (String(project.ownerId) !== String(userId)) {
      const collaborators = await storage.getProjectCollaborators(projectId);
      const isCollaborator = collaborators.some((c: any) => String(c.userId) === String(userId));
      
      if (!isCollaborator) {
        return res.status(403).json({ error: "You don't have access to this project" });
      }
    }
    
    // Clear logs from database (persistent)
    await storage.clearTerminalLogs(projectId);
    
    res.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    console.error('Error clearing terminal logs:', error);
    res.status(500).json({ error: 'Failed to clear terminal logs' });
  }
});

router.post('/sync', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (String(project.ownerId) !== String(userId)) {
      return res.status(403).json({ error: "You don't have access to this project" });
    }
    
    const files = await storage.getFilesByProjectId(projectId);
    const workspacePath = await bulkSyncProjectFiles(projectId, files as any);
    
    res.json({
      success: true,
      workspacePath,
      fileCount: files.length
    });
  } catch (error) {
    console.error('Error syncing project files:', error);
    res.status(500).json({ error: 'Failed to sync project files' });
  }
});

router.get('/workspace-path', ensureAuthenticated, async (req, res) => {
  try {
    const projectId = req.query.projectId as string;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (String(project.ownerId) !== String(userId)) {
      return res.status(403).json({ error: "You don't have access to this project" });
    }
    
    res.json({
      workspacePath: getProjectWorkspacePath(projectId)
    });
  } catch (error) {
    console.error('Error getting workspace path:', error);
    res.status(500).json({ error: 'Failed to get workspace path' });
  }
});

export default router;
