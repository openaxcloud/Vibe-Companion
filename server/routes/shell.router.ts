import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const logger = createLogger('shell-router-per-project');

interface ProjectShellSession {
  id: string;
  sessionId: string;
  projectId: string | number;
  userId: number;
  createdAt: Date;
  status: 'active' | 'closed';
}

const projectShellSessions = new Map<string, ProjectShellSession>();

async function verifyProjectAccess(userId: number, projectId: string | number): Promise<boolean> {
  try {
    const project = await storage.getProject(projectId);
    if (!project) return false;
    
    if (String(project.ownerId) === String(userId)) return true;
    
    const collaborators = await storage.getProjectCollaborators(projectId);
    return collaborators.some((c: any) => String(c.userId) === String(userId));
  } catch (error) {
    logger.error('Failed to verify project access:', error);
    return false;
  }
}

router.post('/:projectId/shell/create', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const sessionId = `shell-${projectId}-${Date.now()}-${uuidv4().slice(0, 8)}`;
    
    const session: ProjectShellSession = {
      id: uuidv4(),
      sessionId,
      projectId,
      userId,
      createdAt: new Date(),
      status: 'active',
    };

    projectShellSessions.set(sessionId, session);

    logger.info('Created shell session', { sessionId, projectId, userId });

    res.json({ 
      sessionId,
      projectId,
      createdAt: session.createdAt,
    });
  } catch (error: any) {
    logger.error('Failed to create shell session:', error);
    res.status(500).json({ error: error.message || 'Failed to create shell session' });
  }
});

router.get('/:projectId/shell/sessions', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const sessions = Array.from(projectShellSessions.values())
      .filter(s => String(s.projectId) === String(projectId) && String(s.userId) === String(userId) && s.status === 'active')
      .map(s => ({
        id: s.id,
        sessionId: s.sessionId,
        createdAt: s.createdAt,
        status: s.status,
      }));

    res.json({ sessions });
  } catch (error: any) {
    logger.error('Failed to get shell sessions:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

router.delete('/:projectId/shell/:sessionId', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const session = projectShellSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (String(session.projectId) !== String(projectId)) {
      return res.status(403).json({ error: 'Session does not belong to this project' });
    }

    if (String(session.userId) !== String(userId)) {
      return res.status(403).json({ error: 'Not authorized to close this session' });
    }

    session.status = 'closed';
    projectShellSessions.delete(sessionId);

    logger.info('Closed shell session', { sessionId, projectId, userId });

    res.json({ success: true, message: 'Session closed' });
  } catch (error: any) {
    logger.error('Failed to close shell session:', error);
    res.status(500).json({ error: error.message || 'Failed to close session' });
  }
});

router.get('/:projectId/shell/:sessionId/status', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const hasAccess = await verifyProjectAccess(userId, projectId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    const session = projectShellSessions.get(sessionId);
    
    if (!session || String(session.projectId) !== String(projectId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.sessionId,
      status: session.status,
      createdAt: session.createdAt,
    });
  } catch (error: any) {
    logger.error('Failed to get session status:', error);
    res.status(500).json({ error: error.message || 'Failed to get session status' });
  }
});

setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  
  for (const [sessionId, session] of projectShellSessions.entries()) {
    if (now - session.createdAt.getTime() > maxAge) {
      projectShellSessions.delete(sessionId);
      logger.info('Cleaned up expired shell session', { sessionId });
    }
  }
}, 60 * 60 * 1000);

export default router;
