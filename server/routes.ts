import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { insertProjectSchema, insertFileSchema, insertProjectCollaboratorSchema, insertDeploymentSchema, type EnvironmentVariable } from "@shared/schema";
import * as z from "zod";
import { devAuthBypass, setupAuthBypass } from "./dev-auth-bypass";
import { WebSocketServer, WebSocket } from "ws";
import * as os from 'os';
import { 
  generateCompletion, 
  generateExplanation, 
  convertCode, 
  generateDocumentation, 
  generateTests 
} from "./ai";
import { setupTerminalWebsocket } from "./terminal";
import { startProject, stopProject, getProjectStatus, attachToProjectLogs, checkRuntimeDependencies } from "./runtime";
import { setupLogsWebsocket } from "./logs";
// import { deployProject, stopDeployment, getDeploymentStatus, getDeploymentLogs } from "./deployment";
import { 
  initRepo, 
  isGitRepo, 
  getRepoStatus, 
  addFiles, 
  commit, 
  addRemote, 
  push, 
  pull, 
  cloneRepo, 
  getCommitHistory 
} from "./git";
import {
  getRuntimeDependencies,
  startProjectRuntime,
  stopProjectRuntime,
  getProjectRuntimeStatus,
  executeProjectCommand,
  getProjectRuntimeLogs,
  getLanguageRecommendations
} from "./runtimes/api";
import * as runtimeHealth from "./runtimes/runtime-health";
import { CodeExecutor } from "./execution/executor";
import { GitManager } from "./version-control/git-manager";
import { collaborationServer } from "./realtime/collaboration-server";
import { replitDB } from "./database/replitdb";
import { searchEngine } from "./search/search-engine";
import { extensionManager } from "./extensions/extension-manager";
import { apiManager } from "./api/api-manager";
import { projectExporter } from "./import-export/exporter";
import { deploymentManager } from "./deployment";
import * as path from "path";

// Middleware to ensure a user is authenticated
const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  console.log('ensureAuthenticated check, isAuthenticated:', req.isAuthenticated());
  console.log('session user:', req.user);
  console.log('session ID:', req.sessionID);
  console.log('cookies:', req.headers.cookie);
  
  if (req.isAuthenticated()) {
    return next();
  }
  
  console.log('Authentication failed in ensureAuthenticated middleware');
  res.status(401).json({ message: "Unauthorized" });
};

// Middleware to ensure a user has access to a project
const ensureProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const userId = req.user!.id;
  const projectId = parseInt(req.params.projectId || req.params.id);
  
  // Check if projectId is valid
  if (isNaN(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }
  
  // Get the project
  const project = await storage.getProject(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }
  
  // Check if user is owner
  if (project.ownerId === userId) {
    return next();
  }
  
  // Check if user is collaborator
  const collaborators = await storage.getProjectCollaborators(projectId);
  const isCollaborator = collaborators.some(c => c.userId === userId);
  
  if (isCollaborator) {
    return next();
  }
  
  res.status(403).json({ message: "You don't have access to this project" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  
  // Add debug middleware for all API routes
  app.use('/api', (req, res, next) => {
    console.log(`[Auth Debug] Request to ${req.path}, isAuthenticated: ${req.isAuthenticated()}`);
    console.log(`[Auth Debug] Session ID: ${req.sessionID}, user ID: ${req.user?.id || 'not logged in'}`);
    next();
  });
  
  // API Routes for Projects
  app.get('/api/projects', ensureAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getProjectsByUser(req.user!.id);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  // Get recent projects (same as all projects for now)
  app.get('/api/projects/recent', ensureAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getProjectsByUser(req.user!.id);
      // Sort by updatedAt to show most recent first
      const recentProjects = projects.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      res.json(recentProjects);
    } catch (error) {
      console.error('Error fetching recent projects:', error);
      res.status(500).json({ error: 'Failed to fetch recent projects' });
    }
  });

  // Templates API
  app.get('/api/templates', async (req, res) => {
    try {
      // For now, return mock data - this would connect to a templates database
      const templates = [
        {
          id: 'nextjs-blog',
          name: 'Next.js Blog Starter',
          description: 'A modern blog with MDX support, dark mode, and SEO optimization',
          category: 'web',
          tags: ['nextjs', 'react', 'blog', 'mdx'],
          author: { name: 'Replit Team', verified: true },
          stats: { uses: 15420, stars: 892, forks: 234 },
          language: 'TypeScript',
          framework: 'Next.js',
          difficulty: 'beginner',
          estimatedTime: '5 mins',
          features: ['MDX blog posts', 'Dark mode', 'SEO optimized', 'RSS feed'],
          isFeatured: true,
          isOfficial: true,
          createdAt: '2024-01-15'
        },
        {
          id: 'express-api',
          name: 'Express REST API',
          description: 'Production-ready REST API with authentication and PostgreSQL',
          category: 'api',
          tags: ['express', 'nodejs', 'api', 'postgresql'],
          author: { name: 'Replit Team', verified: true },
          stats: { uses: 23100, stars: 1243, forks: 567 },
          language: 'JavaScript',
          framework: 'Express.js',
          difficulty: 'intermediate',
          estimatedTime: '10 mins',
          features: ['JWT auth', 'PostgreSQL', 'API docs', 'Rate limiting'],
          isFeatured: true,
          isOfficial: true,
          createdAt: '2024-01-10'
        }
      ];
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.post('/api/projects/from-template', ensureAuthenticated, async (req, res) => {
    try {
      const { templateId, name } = req.body;
      const userId = req.user!.id;
      
      if (!templateId || !name) {
        return res.status(400).json({ error: 'Template ID and name are required' });
      }

      // Create project from template
      // In a real implementation, this would copy files and configuration from the template
      const project = await storage.createProject({
        name,
        description: `Created from template: ${templateId}`,
        language: 'nodejs', // This would come from the template
        visibility: 'private',
        ownerId: userId
      });

      res.json(project);
    } catch (error) {
      console.error('Error creating project from template:', error);
      res.status(500).json({ error: 'Failed to create project from template' });
    }
  });

  app.get('/api/projects/:id', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const project = await storage.getProject(projectId);
      
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  app.post('/api/projects', ensureAuthenticated, async (req, res) => {
    try {
      const result = insertProjectSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors });
      }
      
      const newProject = await storage.createProject({
        ...result.data,
        ownerId: req.user!.id,
      });
      
      // Create default files for the project
      const defaultFiles = [
        {
          name: 'index.js',
          content: '// Welcome to your new project!\nconsole.log("Hello, world!");',
          isFolder: false,
          parentId: null,
          projectId: newProject.id,
        },
        {
          name: 'README.md',
          content: `# ${newProject.name}\n\n${newProject.description || 'A new project'}\n`,
          isFolder: false,
          parentId: null,
          projectId: newProject.id,
        }
      ];
      
      for (const file of defaultFiles) {
        await storage.createFile(file);
      }
      
      res.status(201).json(newProject);
    } catch (error) {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  });

  app.delete('/api/projects/:id', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      await storage.deleteProject(projectId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  // API Routes for Project Files
  app.get('/api/projects/:id/files', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = await storage.getFilesByProject(projectId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Failed to fetch files' });
    }
  });

  app.post('/api/projects/:id/files', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const fileData = {
        name: req.body.name,
        projectId: projectId,
        content: req.body.content || null,
        isFolder: req.body.isFolder || false,
        parentId: req.body.parentId || null
      };
      
      const result = insertFileSchema.safeParse(fileData);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors });
      }
      
      const newFile = await storage.createFile(result.data);
      res.status(201).json(newFile);
    } catch (error) {
      console.error('Error creating file:', error);
      res.status(500).json({ error: 'Failed to create file' });
    }
  });

  app.get('/api/files/:id', ensureAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Ensure user has access to the project this file belongs to
      const project = await storage.getProject(file.projectId);
      if (!project || project.ownerId !== req.user!.id) {
        const isCollaborator = await storage.isProjectCollaborator(file.projectId, req.user!.id);
        if (!isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      res.json(file);
    } catch (error) {
      console.error('Error fetching file:', error);
      res.status(500).json({ error: 'Failed to fetch file' });
    }
  });

  app.patch('/api/files/:id', ensureAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Ensure user has access to the project this file belongs to
      const project = await storage.getProject(file.projectId);
      if (!project || project.ownerId !== req.user!.id) {
        const isCollaborator = await storage.isProjectCollaborator(file.projectId, req.user!.id);
        if (!isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      const updatedFile = await storage.updateFile(fileId, req.body);
      res.json(updatedFile);
    } catch (error) {
      console.error('Error updating file:', error);
      res.status(500).json({ error: 'Failed to update file' });
    }
  });

  app.delete('/api/files/:id', ensureAuthenticated, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Ensure user has access to the project this file belongs to
      const project = await storage.getProject(file.projectId);
      if (!project || project.ownerId !== req.user!.id) {
        const isCollaborator = await storage.isProjectCollaborator(file.projectId, req.user!.id);
        if (!isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      await storage.deleteFile(fileId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  // API Routes for Project Status and Runtime
  app.get('/api/projects/:id/status', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const status = getProjectStatus(projectId);
      res.json(status);
    } catch (error) {
      console.error('Error fetching project status:', error);
      res.status(500).json({ error: 'Failed to fetch project status' });
    }
  });

  app.post('/api/projects/:id/start', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const result = await startProject(projectId);
      res.json(result);
    } catch (error) {
      console.error('Error starting project:', error);
      res.status(500).json({ error: 'Failed to start project' });
    }
  });

  app.post('/api/projects/:id/stop', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const result = await stopProject(projectId);
      res.json(result);
    } catch (error) {
      console.error('Error stopping project:', error);
      res.status(500).json({ error: 'Failed to stop project' });
    }
  });

  // Additional editor routes for Monaco integration
  app.post('/api/projects/:id/run', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { command, file } = req.body;
      
      // This would typically trigger the actual project execution
      const result = await startProject(projectId);
      res.json({ 
        ...result,
        command: command || 'npm start',
        file: file || null
      });
    } catch (error) {
      console.error('Error running project:', error);
      res.status(500).json({ error: 'Failed to run project' });
    }
  });

  // API Routes for Deployments
  app.get('/api/projects/:id/deployments', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const deployments = await storage.getDeployments(projectId);
      res.json(deployments);
    } catch (error) {
      console.error('Error fetching deployments:', error);
      res.status(500).json({ error: 'Failed to fetch deployments' });
    }
  });

  app.post('/api/projects/:id/deploy', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      // const result = await deployProject(projectId);
      // For now, return a mock deployment response
      res.json({ 
        deploymentId: Math.floor(Math.random() * 1000000).toString(),
        status: 'deploying',
        url: `https://project-${projectId}.replit.app`
      });
    } catch (error) {
      console.error('Error deploying project:', error);
      res.status(500).json({ error: 'Failed to deploy project' });
    }
  });

  app.get('/api/deployments/:id/status', ensureAuthenticated, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      // Need to get deployments by project, not deployment ID
      const allProjects = await storage.getProjectsByUser(req.user!.id);
      let deployment = null;
      for (const project of allProjects) {
        const projectDeployments = await storage.getDeployments(project.id);
        const found = projectDeployments.find(d => d.id === deploymentId);
        if (found) {
          deployment = found;
          break;
        }
      }
      
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      
      // Ensure user has access to the project this deployment belongs to
      const project = await storage.getProject(deployment.projectId);
      if (!project || !req.user || project.ownerId !== req.user.id) {
        const collaborators = await storage.getProjectCollaborators(deployment.projectId);
        const isCollaborator = req.user ? collaborators.some(c => c.userId === req.user!.id) : false;
        if (!isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      // const status = getDeploymentStatus(deploymentId);
      res.json({ 
        ...deployment, 
        status: 'deployed',
        health: 'healthy'
      });
    } catch (error) {
      console.error('Error fetching deployment status:', error);
      res.status(500).json({ error: 'Failed to fetch deployment status' });
    }
  });

  app.get('/api/deployments/:id/logs', ensureAuthenticated, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      // Need to get deployments by project, not deployment ID
      const allProjects = await storage.getProjectsByUser(req.user!.id);
      let deployment = null;
      for (const project of allProjects) {
        const projectDeployments = await storage.getDeployments(project.id);
        const found = projectDeployments.find(d => d.id === deploymentId);
        if (found) {
          deployment = found;
          break;
        }
      }
      
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      
      // Ensure user has access to the project this deployment belongs to
      const project = await storage.getProject(deployment.projectId);
      if (!project || !req.user || project.ownerId !== req.user.id) {
        const collaborators = await storage.getProjectCollaborators(deployment.projectId);
        const isCollaborator = req.user ? collaborators.some(c => c.userId === req.user!.id) : false;
        if (!isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      // const logs = getDeploymentLogs(deploymentId);
      res.json({ 
        logs: ['Deployment started...', 'Building...', 'Deployed successfully'] 
      });
    } catch (error) {
      console.error('Error fetching deployment logs:', error);
      res.status(500).json({ error: 'Failed to fetch deployment logs' });
    }
  });

  app.post('/api/deployments/:id/stop', ensureAuthenticated, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      // Get all deployments and find the specific one
      const allProjects = await storage.getProjectsByUser(req.user!.id);
      let deployment = null;
      for (const project of allProjects) {
        const projectDeployments = await storage.getDeployments(project.id);
        const found = projectDeployments.find(d => d.id === deploymentId);
        if (found) {
          deployment = found;
          break;
        }
      }
      
      if (!deployment) {
        return res.status(404).json({ error: 'Deployment not found' });
      }
      
      // Ensure user has access to the project this deployment belongs to
      const project = await storage.getProject(deployment.projectId);
      if (!project || project.ownerId !== req.user?.id) {
        const collaborators = await storage.getProjectCollaborators(deployment.projectId);
        const isCollaborator = collaborators.some(c => c.userId === req.user?.id);
        if (!isCollaborator) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      
      // const result = await stopDeployment(deploymentId);
      res.json({ 
        success: true,
        message: 'Deployment stopped'
      });
    } catch (error) {
      console.error('Error stopping deployment:', error);
      res.status(500).json({ error: 'Failed to stop deployment' });
    }
  });
  
  // Removed duplicate deployment logs route
  
  // Version Control Routes (Git)
  const gitManager = new GitManager();
  
  app.get('/api/projects/:id/git/status', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const status = await gitManager.getStatus(projectId);
      res.json(status);
    } catch (error) {
      console.error('Error getting git status:', error);
      res.status(500).json({ error: 'Failed to get git status' });
    }
  });

  app.get('/api/projects/:id/git/branches', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const branches = await gitManager.getBranches(projectId);
      res.json(branches);
    } catch (error) {
      console.error('Error getting git branches:', error);
      res.status(500).json({ error: 'Failed to get branches' });
    }
  });

  app.get('/api/projects/:id/git/commits', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      const commits = await gitManager.getCommits(projectId, limit);
      res.json(commits);
    } catch (error) {
      console.error('Error getting git commits:', error);
      res.status(500).json({ error: 'Failed to get commits' });
    }
  });

  app.post('/api/projects/:id/git/init', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const success = await gitManager.initRepository(projectId);
      if (success) {
        res.json({ message: 'Repository initialized successfully' });
      } else {
        res.status(500).json({ error: 'Failed to initialize repository' });
      }
    } catch (error) {
      console.error('Error initializing repository:', error);
      res.status(500).json({ error: 'Failed to initialize repository' });
    }
  });

  app.post('/api/projects/:id/git/commit', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { message, files } = req.body;
      const result = await gitManager.commit(projectId, message, files || []);
      res.json({ hash: result });
    } catch (error) {
      console.error('Error committing:', error);
      res.status(500).json({ error: 'Failed to commit' });
    }
  });

  app.post('/api/projects/:id/git/stage', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { files } = req.body;
      // Stage files is handled by commit with specific files
      res.json({ message: 'Files marked for staging' });
    } catch (error) {
      console.error('Error staging files:', error);
      res.status(500).json({ error: 'Failed to stage files' });
    }
  });

  app.post('/api/projects/:id/git/push', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { remote = 'origin', branch = 'main' } = req.body;
      await gitManager.push(projectId, remote, branch);
      res.json({ message: 'Pushed successfully' });
    } catch (error) {
      console.error('Error pushing:', error);
      res.status(500).json({ error: 'Failed to push' });
    }
  });

  app.post('/api/projects/:id/git/pull', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { remote = 'origin', branch = 'main' } = req.body;
      await gitManager.pull(projectId, remote, branch);
      res.json({ message: 'Pulled successfully' });
    } catch (error) {
      console.error('Error pulling:', error);
      res.status(500).json({ error: 'Failed to pull' });
    }
  });

  // Code Execution Routes
  app.post('/api/projects/:id/execute', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { mainFile, stdin, timeout } = req.body;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Get project files
      const projectObj = await storage.getProject(projectId);
      const allFiles = await storage.getProjectsByUser(req.user!.id);
      const files: any[] = [];
      
      // Get files for this project
      const fileMap: Record<string, string> = {};
      
      for (const file of files) {
        if (file.content && file.path) {
          fileMap[file.path] = file.content;
        }
      }
      
      // Create a new executor instance
      const executor = new CodeExecutor();
      
      const result = await executor.execute({
        projectId: projectId,
        userId: req.user!.id,
        language: project.language || 'nodejs',
        mainFile,
        stdin,
        timeout: timeout || 30000
      });

      res.json(result);
    } catch (error) {
      console.error('Error executing code:', error);
      res.status(500).json({ error: 'Failed to execute code' });
    }
  });

  app.post('/api/projects/:id/stop', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const { executionId } = req.body;
      // const stopped = await codeExecutor.stop(executionId);
      const stopped = true;
      res.json({ stopped });
    } catch (error) {
      console.error('Error stopping execution:', error);
      res.status(500).json({ error: 'Failed to stop execution' });
    }
  });

  // ReplitDB Routes
  app.get('/api/projects/:id/db/:key', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const value = await replitDB.get(projectId, req.params.key);
      res.json({ value });
    } catch (error) {
      console.error('Error getting DB value:', error);
      res.status(500).json({ error: 'Failed to get value' });
    }
  });

  app.post('/api/projects/:id/db/:key', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      await replitDB.set(projectId, req.params.key, req.body.value);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting DB value:', error);
      res.status(500).json({ error: 'Failed to set value' });
    }
  });

  app.delete('/api/projects/:id/db/:key', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const deleted = await replitDB.delete(projectId, req.params.key);
      res.json({ deleted });
    } catch (error) {
      console.error('Error deleting DB value:', error);
      res.status(500).json({ error: 'Failed to delete value' });
    }
  });

  app.get('/api/projects/:id/db', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const prefix = req.query.prefix as string | undefined;
      const keys = await replitDB.keys(projectId, prefix);
      res.json({ keys });
    } catch (error) {
      console.error('Error listing DB keys:', error);
      res.status(500).json({ error: 'Failed to list keys' });
    }
  });

  // Search Routes
  app.post('/api/search', ensureAuthenticated, async (req, res) => {
    try {
      const results = await searchEngine.search({
        ...req.body,
        userId: req.user!.id
      });
      res.json({ results });
    } catch (error) {
      console.error('Error searching:', error);
      res.status(500).json({ error: 'Failed to search' });
    }
  });

  // Extensions Routes
  app.get('/api/extensions', ensureAuthenticated, async (req, res) => {
    try {
      const extensions = await extensionManager.getAvailableExtensions();
      res.json(extensions);
    } catch (error) {
      console.error('Error getting extensions:', error);
      res.status(500).json({ error: 'Failed to get extensions' });
    }
  });

  app.get('/api/user/extensions', ensureAuthenticated, async (req, res) => {
    try {
      const extensions = await extensionManager.getUserExtensions(req.user!.id);
      res.json(extensions);
    } catch (error) {
      console.error('Error getting user extensions:', error);
      res.status(500).json({ error: 'Failed to get user extensions' });
    }
  });

  app.post('/api/extensions/:id/install', ensureAuthenticated, async (req, res) => {
    try {
      const success = await extensionManager.installExtension(req.user!.id, req.params.id);
      res.json({ success });
    } catch (error) {
      console.error('Error installing extension:', error);
      res.status(500).json({ error: 'Failed to install extension' });
    }
  });

  // API Key Management Routes
  app.post('/api/keys', ensureAuthenticated, async (req, res) => {
    try {
      const { name, permissions, expiresInDays } = req.body;
      const result = await apiManager.generateAPIKey(
        req.user!.id,
        name,
        permissions,
        expiresInDays
      );
      res.json(result);
    } catch (error) {
      console.error('Error generating API key:', error);
      res.status(500).json({ error: 'Failed to generate API key' });
    }
  });

  app.get('/api/keys', ensureAuthenticated, async (req, res) => {
    try {
      const keys = await apiManager.getUserAPIKeys(req.user!.id);
      res.json(keys);
    } catch (error) {
      console.error('Error getting API keys:', error);
      res.status(500).json({ error: 'Failed to get API keys' });
    }
  });

  app.delete('/api/keys/:id', ensureAuthenticated, async (req, res) => {
    try {
      const success = await apiManager.revokeAPIKey(req.user!.id, req.params.id);
      res.json({ success });
    } catch (error) {
      console.error('Error revoking API key:', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  });

  // Export Routes
  app.post('/api/projects/:id/export', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const result = await projectExporter.exportProject({
        projectId,
        ...req.body
      });
      res.json(result);
    } catch (error) {
      console.error('Error exporting project:', error);
      res.status(500).json({ error: 'Failed to export project' });
    }
  });

  app.get('/api/exports/:filename', ensureAuthenticated, async (req, res) => {
    try {
      const exportPath = path.join(process.cwd(), '.exports', req.params.filename);
      res.download(exportPath);
    } catch (error) {
      console.error('Error downloading export:', error);
      res.status(500).json({ error: 'Failed to download export' });
    }
  });
  
  // Create HTTP server and WebSocket servers
  const httpServer = createServer(app);
  
  // WebSocket for real-time collaboration
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // WebSocket for terminal connections
  const terminalWss = setupTerminalWebsocket(httpServer);
  
  // WebSocket for project logs
  const logsWss = setupLogsWebsocket(httpServer);
  
  // Define WebSocket client interface for collaboration
  interface CollaborationClient extends WebSocket {
    userId?: number;
    username?: string;
    projectId?: number;
    fileId?: number;
    color?: string;
    isAlive: boolean;
  }
  
  // Message types for collaboration
  type CollaborationMessage = {
    type: 'cursor_move' | 'edit' | 'user_joined' | 'user_left' | 'chat_message' | 'pong';
    data: any;
    userId: number;
    username: string;
    projectId: number;
    fileId: number;
    timestamp: number;
  };
  
  // Handle WebSocket connections for real-time collaboration
  const clients = new Map<WebSocket, any>(); // Map to store clients and their project/file info
  const projectClients = new Map<number, Set<WebSocket>>(); // Map projects to connected clients
  
  // Set up ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const collaborationWs = ws as CollaborationClient;
      
      if (collaborationWs.isAlive === false) {
        collaborationWs.terminate();
        return;
      }
      
      collaborationWs.isAlive = false;
      collaborationWs.send(JSON.stringify({ type: 'ping' }));
    });
  }, 30000);
  
  wss.on('close', () => {
    clearInterval(pingInterval);
  });
  
  wss.on("connection", (ws: WebSocket) => {
    const collaborationWs = ws as CollaborationClient;
    collaborationWs.isAlive = true;
    
    let clientInfo = {
      userId: null,
      username: null,
      projectId: null,
      fileId: null,
      color: null
    };
    
    // Handle incoming messages from clients
    collaborationWs.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle pong responses
        if (data.type === 'pong') {
          collaborationWs.isAlive = true;
          return;
        }
        
        // Update client info for the first message
        if (data.userId && !clientInfo.userId) {
          clientInfo = {
            userId: data.userId,
            username: data.username,
            projectId: data.projectId,
            fileId: data.fileId,
            color: data.data?.color || null
          };
          
          // Store client info for broadcasting to specific rooms
          clients.set(collaborationWs, clientInfo);
          
          // Add to project clients map
          if (!projectClients.has(data.projectId)) {
            projectClients.set(data.projectId, new Set());
          }
          projectClients.get(data.projectId)?.add(collaborationWs);
          
          // If first join, send list of current collaborators
          if (data.type === 'user_joined') {
            // Send current collaborators to new user
            const currentCollaborators = [];
            
            for (const [client, info] of Array.from(clients.entries())) {
              if (client !== collaborationWs && info.projectId === data.projectId) {
                currentCollaborators.push({
                  userId: info.userId,
                  username: info.username,
                  color: info.color
                });
              }
            }
            
            if (currentCollaborators.length > 0) {
              collaborationWs.send(JSON.stringify({
                type: 'current_collaborators',
                data: { collaborators: currentCollaborators },
                userId: 0, // System message
                username: 'System',
                projectId: data.projectId,
                fileId: data.fileId,
                timestamp: Date.now()
              }));
            }
          }
        }
        
        // For chat messages, add timestamp if not present
        if (data.type === 'chat_message' && !data.data.timestamp) {
          data.data.timestamp = Date.now();
        }
        
        // Broadcast to all clients in the same project except sender
        const projectId = data.projectId;
        const projectWsClients = projectClients.get(projectId);
        
        if (projectWsClients) {
          projectWsClients.forEach((client) => {
            if (client !== collaborationWs && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(data));
            }
          });
        }
        
        // Log collaboration events (excluding cursor movements to reduce noise)
        if (data.type !== 'cursor_move') {
          console.log(`Collaboration event: ${data.type} in project ${data.projectId} from ${data.username}`);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    
    // Handle ping/pong to keep connection alive
    collaborationWs.on('pong', () => {
      collaborationWs.isAlive = true;
    });
    
    // Handle disconnection
    collaborationWs.on("close", () => {
      if (clientInfo.userId) {
        // Broadcast user left message to others in the same project
        const leaveMessage = {
          type: 'user_left',
          userId: clientInfo.userId,
          username: clientInfo.username,
          projectId: clientInfo.projectId || 0,
          fileId: clientInfo.fileId || 0,
          timestamp: Date.now(),
          data: {}
        };
        
        const projectId = clientInfo.projectId || 0;
        const projectWsClients = projectClients.get(projectId);
        
        if (projectWsClients) {
          projectWsClients.forEach((client) => {
            if (client !== collaborationWs && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(leaveMessage));
            }
          });
          
          // Remove client from project set
          projectWsClients.delete(collaborationWs);
          
          // If no clients left, remove project from map
          if (projectWsClients.size === 0) {
            projectClients.delete(projectId);
          }
        }
        
        // Remove from clients map
        clients.delete(collaborationWs);
        console.log(`User ${clientInfo.username} disconnected from project ${clientInfo.projectId}`);
      }
    });
  });
  
  // Debug middleware to trace session and auth info
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') && req.path !== '/api/user') {
      console.log(`[Auth Debug] Request to ${req.path}, isAuthenticated: ${req.isAuthenticated()}`);
      console.log(`[Auth Debug] Session ID: ${req.sessionID}, user ID: ${req.user?.id || 'not logged in'}`);
    }
    next();
  });

  // prefix all routes with /api
  const apiRouter = app.use('/api', (req, res, next) => {
    next();
  });

  // Get all projects for the authenticated user
  app.get('/api/projects', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const projects = await storage.getProjectsByUser(userId);
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: 'Failed to fetch projects' });
    }
  });

  // Get a project by ID
  app.get('/api/projects/:id', ensureProjectAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }

      const project = await storage.getProject(id);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: 'Failed to fetch project' });
    }
  });

  // Create a new project
  app.post('/api/projects', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const validation = insertProjectSchema.safeParse({
        ...req.body,
        ownerId: userId
      });
      
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid project data', errors: validation.error.format() });
      }

      const project = await storage.createProject(validation.data);
      
      // Create default files for the project
      const htmlFile = await storage.createFile({
        name: 'index.html',
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First PLOT Project</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header>
    <h1>Welcome to PLOT</h1>
    <p>Your coding journey starts here</p>
  </header>
  
  <main>
    <p>This is a simple HTML page to get you started.</p>
    <button id="myButton">Click Me!</button>
  </main>
  
  <script src="script.js"></script>
</body>
</html>`,
        isFolder: false,
        projectId: project.id,
        parentId: null,
      });
      
      const cssFile = await storage.createFile({
        name: 'styles.css',
        content: `body {
  font-family: Arial, sans-serif;
  line-height: 1.6;
  margin: 0;
  padding: 20px;
  color: #333;
}

header {
  text-align: center;
  margin-bottom: 30px;
}

h1 {
  color: #0070F3;
}

button {
  background-color: #0070F3;
  color: white;
  border: none;
  padding: 10px 15px;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #005cc5;
}`,
        isFolder: false,
        projectId: project.id,
        parentId: null,
      });
      
      const jsFile = await storage.createFile({
        name: 'script.js',
        content: `// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Get the button element
  const button = document.getElementById('myButton');
  
  // Add a click event listener
  button.addEventListener('click', function() {
    alert('Hello from PLOT! Your JavaScript is working!');
  });
});`,
        isFolder: false,
        projectId: project.id,
        parentId: null,
      });

      res.status(201).json(project);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create project' });
    }
  });

  // Get all files for a project
  app.get('/api/projects/:id/files', ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }

      const files = await storage.getFilesByProject(projectId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).json({ message: 'Failed to fetch files' });
    }
  });

  // Create a new file or folder
  app.post('/api/projects/:id/files', ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }

      // Validate with a schema that doesn't require projectId
      const fileDataSchema = z.object({
        name: z.string().min(1).max(255),
        content: z.string().optional().default(''),
        isFolder: z.boolean().default(false),
        parentId: z.number().nullable().optional(),
      });

      const validation = fileDataSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid file data', errors: validation.error.format() });
      }

      // Add the projectId to the validated data
      const fileData = {
        ...validation.data,
        projectId,
      };

      const file = await storage.createFile(fileData);
      res.status(201).json(file);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create file' });
    }
  });

  // Get a specific file
  app.get('/api/files/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid file ID' });
      }

      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Check if user has access to this file's project
      const userId = req.user!.id;
      const project = await storage.getProject(file.projectId);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is owner
      if (project.ownerId !== userId) {
        // Check if user is collaborator
        const collaborators = await storage.getProjectCollaborators(file.projectId);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "You don't have access to this file" });
        }
      }

      res.json(file);
    } catch (error) {
      console.error("Error fetching file:", error);
      res.status(500).json({ message: 'Failed to fetch file' });
    }
  });

  // Update a file
  app.patch('/api/files/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid file ID' });
      }

      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Check if user has access to this file's project
      const userId = req.user!.id;
      const project = await storage.getProject(file.projectId);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is owner
      if (project.ownerId !== userId) {
        // Check if user is collaborator
        const collaborators = await storage.getProjectCollaborators(file.projectId);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "You don't have access to this file" });
        }
      }

      // Simplified validation for update
      const updateSchema = z.object({
        content: z.string().optional(),
        name: z.string().min(1).max(255).optional(),
      });

      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: 'Invalid update data', errors: validation.error.format() });
      }

      const updatedFile = await storage.updateFile(id, validation.data);
      res.json(updatedFile);
    } catch (error) {
      console.error("Error updating file:", error);
      res.status(500).json({ message: 'Failed to update file' });
    }
  });

  // Delete a file
  app.delete('/api/files/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid file ID' });
      }

      const file = await storage.getFile(id);
      if (!file) {
        return res.status(404).json({ message: 'File not found' });
      }
      
      // Check if user has access to this file's project
      const userId = req.user!.id;
      const project = await storage.getProject(file.projectId);
      
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is owner
      if (project.ownerId !== userId) {
        // Check if user is collaborator
        const collaborators = await storage.getProjectCollaborators(file.projectId);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        
        if (!isCollaborator) {
          return res.status(403).json({ message: "You don't have access to this file" });
        }
      }

      await storage.deleteFile(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });
  
  // AI Routes
  
  // Generate code completion
  app.post('/api/ai/completion', ensureAuthenticated, generateCompletion);
  
  // Generate code explanation
  app.post('/api/ai/explanation', ensureAuthenticated, generateExplanation);
  
  // Convert code between languages
  app.post('/api/ai/convert', ensureAuthenticated, convertCode);
  
  // Generate documentation
  app.post('/api/ai/document', ensureAuthenticated, generateDocumentation);
  
  // Generate tests
  app.post('/api/ai/tests', ensureAuthenticated, generateTests);
  
  // AI Assistant endpoint for project chat
  app.post('/api/projects/:projectId/ai/chat', ensureAuthenticated, async (req, res) => {
    try {
      const { projectId } = req.params;
      const { messages } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }
      
      // Get project context
      const project = await storage.getProject(parseInt(projectId));
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Get recent file content for context
      const files = await storage.getFilesByProject(parseInt(projectId));
      const codeContext = files
        .filter(f => !f.isFolder)
        .slice(0, 5)
        .map(f => `File: ${f.name}\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n');
      
      // For now, return a mock response since we need OpenAI API key
      const mockResponse = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `I understand you're working on "${project.name}". To provide actual AI assistance, please configure your OpenAI API key in the environment variables. 

Based on your project context, I can see you have ${files.length} files. Once the API key is configured, I'll be able to help with:
- Code suggestions and completions
- Bug fixes and optimizations
- Explanations and documentation
- Refactoring recommendations

Would you like me to help you set up the OpenAI API integration?`,
        timestamp: Date.now()
      };
      
      res.json(mockResponse);
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: 'Failed to process AI request' });
    }
  });
  
  // Environment variables routes
  
  // Get all environment variables for a project
  app.get('/api/projects/:projectId/environment', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      const variables = await storage.getEnvironmentVariables(projectId);
      
      // Mask secret values in response
      const sanitizedVariables = variables.map(variable => ({
        ...variable,
        value: variable.isSecret ? null : variable.value
      }));
      
      res.json(sanitizedVariables);
    } catch (error) {
      console.error('Error fetching environment variables:', error);
      res.status(500).json({ message: 'Failed to fetch environment variables' });
    }
  });
  
  // Get a specific environment variable by ID
  app.get('/api/projects/:projectId/environment/:id', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid variable ID' });
      }
      
      const variable = await storage.getEnvironmentVariable(id);
      if (!variable) {
        return res.status(404).json({ message: 'Environment variable not found' });
      }
      
      // Mask secret value in response
      const sanitizedVariable = {
        ...variable,
        value: variable.isSecret ? null : variable.value
      };
      
      res.json(sanitizedVariable);
    } catch (error) {
      console.error('Error fetching environment variable:', error);
      res.status(500).json({ message: 'Failed to fetch environment variable' });
    }
  });
  
  // Create a new environment variable
  app.post('/api/projects/:projectId/environment', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      // Validate input
      const { key, value, isSecret } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: 'Key and value are required' });
      }
      
      // Check if key already exists for this project
      const existingVariables = await storage.getEnvironmentVariables(projectId);
      const keyExists = existingVariables.some(v => v.key === key);
      if (keyExists) {
        return res.status(409).json({ message: 'A variable with this key already exists' });
      }
      
      const variable = await storage.createEnvironmentVariable({
        projectId,
        key,
        value,
        isSecret: !!isSecret
      });
      
      // Mask secret value in response
      const sanitizedVariable = {
        ...variable,
        value: variable.isSecret ? null : variable.value
      };
      
      res.status(201).json(sanitizedVariable);
    } catch (error) {
      console.error('Error creating environment variable:', error);
      res.status(500).json({ message: 'Failed to create environment variable' });
    }
  });
  
  // Update an environment variable
  app.patch('/api/projects/:projectId/environment/:id', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid variable ID' });
      }
      
      const variable = await storage.getEnvironmentVariable(id);
      if (!variable) {
        return res.status(404).json({ message: 'Environment variable not found' });
      }
      
      // Validate input
      const { key, value, isSecret } = req.body;
      const update: Partial<EnvironmentVariable> = {};
      
      if (key !== undefined) update.key = key;
      if (value !== undefined) update.value = value;
      if (isSecret !== undefined) update.isSecret = isSecret;
      
      // Check for key uniqueness if key is being updated
      if (key && key !== variable.key) {
        const existingVariables = await storage.getEnvironmentVariables(variable.projectId);
        const keyExists = existingVariables.some(v => v.key === key && v.id !== id);
        if (keyExists) {
          return res.status(409).json({ message: 'A variable with this key already exists' });
        }
      }
      
      const updatedVariable = await storage.updateEnvironmentVariable(id, update);
      
      // Mask secret value in response
      const sanitizedVariable = {
        ...updatedVariable,
        value: updatedVariable.isSecret ? null : updatedVariable.value
      };
      
      res.json(sanitizedVariable);
    } catch (error) {
      console.error('Error updating environment variable:', error);
      res.status(500).json({ message: 'Failed to update environment variable' });
    }
  });
  
  // Delete an environment variable
  app.delete('/api/projects/:projectId/environment/:id', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid variable ID' });
      }
      
      const variable = await storage.getEnvironmentVariable(id);
      if (!variable) {
        return res.status(404).json({ message: 'Environment variable not found' });
      }
      
      await storage.deleteEnvironmentVariable(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting environment variable:', error);
      res.status(500).json({ message: 'Failed to delete environment variable' });
    }
  });
  
  // Runtime API Routes
  
  // Get runtime dependencies status (Docker, Nix, etc.)
  app.get('/api/runtime/dependencies', getRuntimeDependencies);
  
  // Project runtime routes
  
  // Start a project (legacy route - keeping for backward compatibility)
  app.post('/api/projects/:id/start', ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      const result = await startProject(projectId);
      
      if (!result.success) {
        return res.status(500).json({ message: result.error || 'Failed to start project' });
      }
      
      res.json({
        status: 'running',
        url: result.url
      });
    } catch (error) {
      console.error("Error starting project:", error);
      res.status(500).json({ message: 'Failed to start project' });
    }
  });
  
  // Stop a project (legacy route - keeping for backward compatibility)
  app.post('/api/projects/:id/stop', ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      const result = await stopProject(projectId);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error || 'Failed to stop project' });
      }
      
      res.json({ status: 'stopped' });
    } catch (error) {
      console.error("Error stopping project:", error);
      res.status(500).json({ message: 'Failed to stop project' });
    }
  });
  
  // Get project status (legacy route - keeping for backward compatibility)
  app.get('/api/projects/:id/status', ensureProjectAccess, (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      const status = getProjectStatus(projectId);
      res.json(status);
    } catch (error) {
      console.error("Error getting project status:", error);
      res.status(500).json({ message: 'Failed to get project status' });
    }
  });
  
  // New runtime API routes with enhanced functionality
  
  // Start a project runtime with advanced options
  app.post('/api/projects/:id/runtime/start', ensureProjectAccess, startProjectRuntime);
  
  // Stop a project runtime
  app.post('/api/projects/:id/runtime/stop', ensureProjectAccess, stopProjectRuntime);
  
  // Get project runtime status
  app.get('/api/projects/:id/runtime', ensureProjectAccess, getProjectRuntimeStatus);
  
  // Execute command in project runtime
  app.post('/api/projects/:id/runtime/execute', ensureProjectAccess, executeProjectCommand);
  
  // Get project runtime logs
  app.get('/api/projects/:id/runtime/logs', ensureProjectAccess, getProjectRuntimeLogs);
  
  // Public endpoint to get runtime dependencies - no auth required
  app.get('/api/runtime/dependencies', getRuntimeDependencies);
  
  // Environment Variables API
  app.get('/api/projects/:id/env', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      // TODO: Implement actual environment variable storage
      res.json([]);
    } catch (error) {
      console.error('Error fetching environment variables:', error);
      res.status(500).json({ error: 'Failed to fetch environment variables' });
    }
  });
  
  app.post('/api/projects/:id/env', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { key, value } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }
      
      // TODO: Implement actual environment variable storage
      res.json({ key, value });
    } catch (error) {
      console.error('Error adding environment variable:', error);
      res.status(500).json({ error: 'Failed to add environment variable' });
    }
  });
  
  app.put('/api/projects/:id/env/:key', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const key = req.params.key;
      const { value } = req.body;
      
      if (!value) {
        return res.status(400).json({ error: 'Value is required' });
      }
      
      // TODO: Implement actual environment variable update
      res.json({ key, value });
    } catch (error) {
      console.error('Error updating environment variable:', error);
      res.status(500).json({ error: 'Failed to update environment variable' });
    }
  });
  
  app.delete('/api/projects/:id/env/:key', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const key = req.params.key;
      
      // TODO: Implement actual environment variable deletion
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting environment variable:', error);
      res.status(500).json({ error: 'Failed to delete environment variable' });
    }
  });
  
  // Package Management API
  app.get('/api/projects/:id/packages', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      // TODO: Implement actual package listing based on package.json or requirements.txt
      res.json([]);
    } catch (error) {
      console.error('Error fetching packages:', error);
      res.status(500).json({ error: 'Failed to fetch packages' });
    }
  });
  
  app.post('/api/projects/:id/packages', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { name, language } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Package name is required' });
      }
      
      // TODO: Implement actual package installation
      res.json({
        name,
        version: 'latest',
        success: true
      });
    } catch (error) {
      console.error('Error installing package:', error);
      res.status(500).json({ error: 'Failed to install package' });
    }
  });
  
  app.delete('/api/projects/:id/packages/:packageName', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const packageName = req.params.packageName;
      
      // TODO: Implement actual package uninstallation
      res.json({
        name: packageName,
        success: true
      });
    } catch (error) {
      console.error('Error uninstalling package:', error);
      res.status(500).json({ error: 'Failed to uninstall package' });
    }
  });
  
  app.get('/api/packages/search', ensureAuthenticated, async (req, res) => {
    try {
      const { q, language } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // TODO: Implement actual package search from npm, pypi, etc.
      res.json([]);
    } catch (error) {
      console.error('Error searching packages:', error);
      res.status(500).json({ error: 'Failed to search packages' });
    }
  });
  
  // Runtime dashboard route for health status and diagnostics (public)
  app.get('/api/runtime/dashboard', async (req, res) => {
    try {
      // Get system dependencies
      const dependencies = await runtimeHealth.checkSystemDependencies();
      
      // Get active projects/containers - only if authenticated
      let activeProjects: Array<{id: number, name: string, status: any}> = [];
      let projectStatuses: Record<string, any> = {};
      
      // Get system health data
      const systemHealth = {
        cpuUsage: runtimeHealth.getCpuUsage() || 0,
        memoryUsage: runtimeHealth.getMemoryUsage() || '0%',
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        nodeVersion: process.version
      };
      
      // Get runtime environments data
      const runtimeEnvironments = {
        docker: dependencies.docker || { available: false },
        nix: dependencies.nix || { available: false },
        languages: dependencies.languages || {}
      };
      
      // Get recommendations
      const recommendations = [
        "Install Docker for better isolation and containerization",
        "Keep Node.js up to date for security and performance",
        "Install Python 3 for scientific computing support",
        "Enable Nix for reproducible development environments"
      ];
      
      // Get project information if authenticated
      if (req.isAuthenticated()) {
        // Get all projects user has access to
        const projects = await storage.getProjectsByUser(req.user!.id);
        
        // Get runtime status for each project
        for (const project of projects) {
          const status = getProjectStatus(project.id);
          if (status.isRunning) {
            activeProjects.push({
              id: project.id,
              name: project.name,
              status: status
            });
          }
          projectStatuses[project.id.toString()] = status;
        }
      }
      
      // System resource usage
      const cpuUsage = os.loadavg()[0]; // 1 minute load average
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2);
      
      res.json({
        status: 'success',
        timestamp: new Date().toISOString(),
        systemHealth: {
          cpuUsage,
          memoryUsage: `${memoryUsage}%`,
          uptime: os.uptime(),
          platform: os.platform(),
          arch: os.arch()
        },
        runtimeEnvironments: dependencies,
        activeProjects,
        projectStatuses,
        recommendations: getLanguageRecommendations(dependencies)
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error getting runtime dashboard: ${errorMessage}`);
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to get runtime dashboard information',
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Deployment routes
  
  // Get all deployments for a project
  app.get('/api/projects/:id/deployments', ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      const deployments = await storage.getDeployments(projectId);
      res.json(deployments);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      res.status(500).json({ message: 'Failed to fetch deployments' });
    }
  });
  
  // Deploy a project
  app.post('/api/projects/:id/deploy', ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: 'Invalid project ID' });
      }
      
      // const result = await deployProject(projectId);
      const result = { 
        success: true,
        deployment: {
          id: Math.floor(Math.random() * 1000000),
          url: `https://project-${projectId}.replit.app`,
          status: 'deploying'
        },
        message: undefined as string | undefined
      };
      
      if (!result.success) {
        return res.status(500).json({ message: result.message || 'Failed to deploy project' });
      }
      
      res.json({
        deploymentId: result.deployment.id,
        url: result.deployment.url,
        status: result.deployment.status
      });
    } catch (error) {
      console.error("Error deploying project:", error);
      res.status(500).json({ message: 'Failed to deploy project' });
    }
  });
  
  // Stop a deployment
  app.post('/api/deployments/:id/stop', ensureAuthenticated, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      if (isNaN(deploymentId)) {
        return res.status(400).json({ message: 'Invalid deployment ID' });
      }
      
      // Get the deployment to check access
      const allProjects = await storage.getProjectsByUser(req.user!.id);
      let deployment = null;
      for (const project of allProjects) {
        const projectDeployments = await storage.getDeployments(project.id);
        const found = projectDeployments.find(d => d.id === deploymentId);
        if (found) {
          deployment = found;
          break;
        }
      }
      
      if (!deployment) {
        return res.status(404).json({ message: 'Deployment not found' });
      }
      
      // Check project access
      const project = await storage.getProject(deployment.projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is owner or collaborator
      const userId = req.user!.id;
      if (project.ownerId !== userId) {
        const collaborators = await storage.getProjectCollaborators(project.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "You don't have access to this deployment" });
        }
      }
      
      // const result = await stopDeployment(deploymentId);
      const result = { success: true, message: undefined as string | undefined };
      
      if (!result.success) {
        return res.status(500).json({ message: result.message || 'Failed to stop deployment' });
      }
      
      res.json({ status: 'stopped' });
    } catch (error) {
      console.error("Error stopping deployment:", error);
      res.status(500).json({ message: 'Failed to stop deployment' });
    }
  });
  
  // Get deployment status
  app.get('/api/deployments/:id/status', ensureAuthenticated, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      if (isNaN(deploymentId)) {
        return res.status(400).json({ message: 'Invalid deployment ID' });
      }
      
      // Get the deployment to check access
      const allProjects = await storage.getProjectsByUser(req.user!.id);
      let deployment = null;
      for (const project of allProjects) {
        const projectDeployments = await storage.getDeployments(project.id);
        const found = projectDeployments.find(d => d.id === deploymentId);
        if (found) {
          deployment = found;
          break;
        }
      }
      
      if (!deployment) {
        return res.status(404).json({ message: 'Deployment not found' });
      }
      
      // Check project access
      const project = await storage.getProject(deployment.projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is owner or collaborator
      const userId = req.user!.id;
      if (project.ownerId !== userId) {
        const collaborators = await storage.getProjectCollaborators(project.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "You don't have access to this deployment" });
        }
      }
      
      // const status = getDeploymentStatus(deploymentId);
      const status = { 
        running: false,
        status: 'deployed',
        url: deployment.url
      };
      
      // If deployment is not running, return database status
      if (!status.running) {
        return res.json({
          status: deployment.status,
          url: deployment.url,
          isActive: false
        });
      }
      
      // Return active deployment status
      res.json({
        status: status.status,
        url: status.url,
        isActive: status.running
      });
    } catch (error) {
      console.error("Error getting deployment status:", error);
      res.status(500).json({ message: 'Failed to get deployment status' });
    }
  });
  
  // Get deployment logs
  app.get('/api/deployments/:id/logs', ensureAuthenticated, async (req, res) => {
    try {
      const deploymentId = parseInt(req.params.id);
      if (isNaN(deploymentId)) {
        return res.status(400).json({ message: 'Invalid deployment ID' });
      }
      
      // Get the deployment to check access
      const allProjects = await storage.getProjectsByUser(req.user!.id);
      let deployment = null;
      for (const project of allProjects) {
        const projectDeployments = await storage.getDeployments(project.id);
        const found = projectDeployments.find(d => d.id === deploymentId);
        if (found) {
          deployment = found;
          break;
        }
      }
      
      if (!deployment) {
        return res.status(404).json({ message: 'Deployment not found' });
      }
      
      // Check project access
      const project = await storage.getProject(deployment.projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if user is owner or collaborator
      const userId = req.user!.id;
      if (project.ownerId !== userId) {
        const collaborators = await storage.getProjectCollaborators(project.id);
        const isCollaborator = collaborators.some(c => c.userId === userId);
        if (!isCollaborator) {
          return res.status(403).json({ message: "You don't have access to this deployment" });
        }
      }
      
      // const logs = getDeploymentLogs(deploymentId);
      const logs = ['Deployment started...', 'Building...', 'Deployed successfully'];
      
      res.json({ logs });
    } catch (error) {
      console.error("Error getting deployment logs:", error);
      res.status(500).json({ message: 'Failed to get deployment logs' });
    }
  });
  
  // Git routes removed - using GitManager implementation above

  return httpServer;
}
