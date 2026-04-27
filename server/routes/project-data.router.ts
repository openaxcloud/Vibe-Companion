import { Router, Request, Response, NextFunction } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { getStorage } from '../storage';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/schema';
import type { User } from '@shared/schema';

const projectDataRouter = Router();

/**
 * Project Data API Router
 * 
 * Provides project-scoped database access for regular users
 * Returns structured data about files, deployments, environment variables, etc.
 * 
 * Security: Project-scoped, authenticated users with project access
 * Use Case: IDE database panel for regular users (like Replit)
 */

/**
 * Middleware to ensure user has access to the project
 * Checks: owner, collaborator, or public project
 */
const ensureProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const userId = (req.user as User).id;
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        error: 'Invalid project ID'
      });
    }

    const storage = getStorage();
    
    // Get the project
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({
        error: 'Project not found'
      });
    }

    // Check if user is owner
    if (String(project.ownerId) === String(userId)) {
      return next();
    }

    // Check if user is collaborator
    const collaborators = await storage.getProjectCollaborators(projectId);
    const isCollaborator = collaborators.some(c => String(c.userId) === String(userId));
    
    if (isCollaborator) {
      return next();
    }

    // Check if user is admin - admins have access to all projects
    const user = await storage.getUser(userId.toString());
    if (user && user.role === 'admin') {
      return next();
    }

    // Public projects: Deny access to sensitive data (secrets, deployments)
    // Users can only view public project data through Files API
    if (project.visibility === 'public') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Public projects do not expose internal data. Use Files API instead.'
      });
    }

    // Access denied - user is not owner, collaborator, or admin
    return res.status(403).json({
      error: 'Access denied',
      message: 'You do not have permission to access this project data'
    });
  } catch (error: any) {
    console.error('[Project Data API] Access check error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to verify project access'
    });
  }
};

/**
 * GET /api/projects/:projectId/data/tables
 * Liste les "tables" de données du projet (files, deployments, env_vars, etc.)
 */
projectDataRouter.get('/:projectId/data/tables', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const storage = getStorage();
    
    // Verify project access
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get counts for each data type
    const files = await storage.getFilesByProjectId(projectId);
    const deployments = await storage.getProjectDeployments(projectId);
    const secrets = await storage.getProjectSecrets(projectId);

    const tables = [
      {
        name: 'files',
        displayName: 'Files',
        rowCount: files.length,
        description: 'Project files and directories',
        icon: 'FileText'
      },
      {
        name: 'deployments',
        displayName: 'Deployments',
        rowCount: deployments.length,
        description: 'Deployment history',
        icon: 'Rocket'
      },
      {
        name: 'secrets',
        displayName: 'Secrets & Environment Variables',
        rowCount: secrets.length,
        description: 'Environment configuration and API keys',
        icon: 'Key'
      }
    ];

    return res.json({
      projectId,
      projectName: project.name,
      tables,
      totalTables: tables.length
    });
  } catch (error: any) {
    console.error('[Project Data API] Get tables error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get project tables' });
  }
});

/**
 * GET /api/projects/:projectId/data/:tableName/schema
 * Retourne le schéma d'une "table" de données
 */
projectDataRouter.get('/:projectId/data/:tableName/schema', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId, tableName } = req.params;
    const storage = getStorage();

    // Verify project access
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Define schemas for each data type
    const schemas: Record<string, any> = {
      files: {
        tableName: 'files',
        columns: [
          { name: 'id', type: 'varchar', nullable: false, isPrimaryKey: true },
          { name: 'path', type: 'text', nullable: false },
          { name: 'content', type: 'text', nullable: true },
          { name: 'size', type: 'integer', nullable: true },
          { name: 'type', type: 'varchar', nullable: false },
          { name: 'createdAt', type: 'timestamp', nullable: false },
          { name: 'updatedAt', type: 'timestamp', nullable: false }
        ]
      },
      deployments: {
        tableName: 'deployments',
        columns: [
          { name: 'id', type: 'varchar', nullable: false, isPrimaryKey: true },
          { name: 'url', type: 'text', nullable: false },
          { name: 'status', type: 'varchar', nullable: false },
          { name: 'environment', type: 'varchar', nullable: false },
          { name: 'createdAt', type: 'timestamp', nullable: false },
          { name: 'updatedAt', type: 'timestamp', nullable: false }
        ]
      },
      secrets: {
        tableName: 'secrets',
        columns: [
          { name: 'id', type: 'integer', nullable: false, isPrimaryKey: true },
          { name: 'key', type: 'varchar', nullable: false },
          { name: 'description', type: 'text', nullable: true },
          { name: 'value', type: 'text', nullable: false },
          { name: 'createdAt', type: 'timestamp', nullable: false },
          { name: 'updatedAt', type: 'timestamp', nullable: false }
        ]
      }
    };

    if (!schemas[tableName]) {
      return res.status(404).json({ error: 'Table not found' });
    }

    return res.json(schemas[tableName]);
  } catch (error: any) {
    console.error('[Project Data API] Get schema error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get table schema' });
  }
});

/**
 * GET /api/projects/:projectId/data/:tableName/data
 * Retourne les données d'une "table" avec pagination
 */
projectDataRouter.get('/:projectId/data/:tableName/data', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId, tableName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
    const offset = (page - 1) * limit;
    
    const storage = getStorage();

    // Verify project access
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let rows: any[] = [];
    let total = 0;

    // Fetch data based on table name
    switch (tableName) {
      case 'files': {
        const files = await storage.getFilesByProjectId(projectId);
        total = files.length;
        rows = files.slice(offset, offset + limit).map(f => ({
          id: f.id,
          path: f.path,
          content: f.content ? f.content.substring(0, 100) + '...' : null, // Truncate content
          size: f.content?.length || 0,
          type: f.path.includes('.') ? f.path.split('.').pop() : 'file',
          createdAt: f.createdAt,
          updatedAt: f.updatedAt
        }));
        break;
      }
      case 'deployments': {
        const deployments = await storage.getProjectDeployments(projectId);
        total = deployments.length;
        rows = deployments.slice(offset, offset + limit);
        break;
      }
      case 'secrets': {
        const secrets = await storage.getProjectSecrets(projectId);
        total = secrets.length;
        rows = secrets.slice(offset, offset + limit).map((secret: any) => ({
          id: secret.id,
          key: secret.key,
          description: secret.description,
          value: '***ENCRYPTED***', // Never expose secret values
          createdAt: secret.created_at || secret.createdAt,
          updatedAt: secret.updated_at || secret.updatedAt
        }));
        break;
      }
      default:
        return res.status(404).json({ error: 'Table not found' });
    }

    return res.json({
      tableName,
      projectId,
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: offset + limit < total,
        hasPrevPage: page > 1
      }
    });
  } catch (error: any) {
    console.error('[Project Data API] Get data error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get table data' });
  }
});

/**
 * GET /api/projects/:projectId/data/stats
 * Retourne les statistiques du projet
 */
projectDataRouter.get('/:projectId/data/stats', ensureAuthenticated, ensureProjectAccess, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const storage = getStorage();

    // Verify project access
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get counts
    const files = await storage.getFilesByProjectId(projectId);
    const deployments = await storage.getProjectDeployments(projectId);
    const secrets = await storage.getProjectSecrets(projectId);

    // Calculate total size
    const totalSize = files.reduce((acc, f) => acc + (f.content?.length || 0), 0);

    return res.json({
      projectId,
      projectName: project.name,
      stats: {
        totalFiles: files.length,
        totalDeployments: deployments.length,
        totalSecrets: secrets.length,
        totalSizeBytes: totalSize,
        totalSizeKB: Math.round(totalSize / 1024),
        lastDeployment: deployments.length > 0 ? deployments[deployments.length - 1].createdAt : null,
        projectCreated: project.createdAt,
        projectUpdated: project.updatedAt
      }
    });
  } catch (error: any) {
    console.error('[Project Data API] Get stats error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get project stats' });
  }
});

export default projectDataRouter;
