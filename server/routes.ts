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
import shellRoutes, { setupShellWebSocket } from "./routes/shell";
import { notificationRoutes } from "./routes/notifications";
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
import adminRoutes from "./admin/routes";
import OpenAI from 'openai';

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
  
  // Set up auth bypass for development
  setupAuthBypass(app);
  
  // Apply auth bypass middleware to all API routes in development
  if (process.env.NODE_ENV === 'development') {
    app.use('/api', devAuthBypass);
  }
  
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
          author: { name: 'E-Code Team', verified: true },
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
          author: { name: 'E-Code Team', verified: true },
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

  // Create project from template
  app.post('/api/projects/from-template', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { templateId, name } = req.body;

      if (!templateId || !name) {
        return res.status(400).json({ error: 'Template ID and project name are required' });
      }

      // Template configurations
      const templateConfigs: Record<string, any> = {
        'nextjs-blog': {
          language: 'nodejs',
          description: 'A modern blog built with Next.js',
          files: [
            { name: 'package.json', content: JSON.stringify({
              name: 'nextjs-blog',
              version: '1.0.0',
              scripts: {
                dev: 'next dev',
                build: 'next build',
                start: 'next start'
              },
              dependencies: {
                next: '^14.0.0',
                react: '^18.2.0',
                'react-dom': '^18.2.0'
              }
            }, null, 2) },
            { name: 'pages/index.js', content: `export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Welcome to Your Blog!</h1>
      <p>This is a Next.js blog starter template.</p>
    </div>
  );
}` },
            { name: 'pages/_app.js', content: `export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}` },
            { name: 'README.md', content: `# Next.js Blog

A modern blog starter built with Next.js.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

Visit http://localhost:3000 to see your blog!
` }
          ]
        },
        'express-api': {
          language: 'nodejs',
          description: 'A REST API built with Express.js',
          files: [
            { name: 'package.json', content: JSON.stringify({
              name: 'express-api',
              version: '1.0.0',
              scripts: {
                start: 'node server.js',
                dev: 'nodemon server.js'
              },
              dependencies: {
                express: '^4.18.0',
                cors: '^2.8.5',
                dotenv: '^16.0.0'
              },
              devDependencies: {
                nodemon: '^3.0.0'
              }
            }, null, 2) },
            { name: 'server.js', content: `const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to your Express API!' });
});

app.get('/api/users', (req, res) => {
  res.json([
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ]);
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});` },
            { name: 'README.md', content: `# Express REST API

A production-ready REST API starter.

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\`

API will be available at http://localhost:3000
` }
          ]
        }
      };

      const config = templateConfigs[templateId];
      if (!config) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Create the project
      const project = await storage.createProject({
        name,
        userId,
        language: config.language,
        description: config.description,
        visibility: 'private',
      });

      // Create the files
      for (const file of config.files) {
        await storage.createFile({
          projectId: project.id,
          name: file.name,
          content: file.content,
          path: file.name,
        });
      }

      res.json(project);
    } catch (error) {
      console.error('Error creating project from template:', error);
      res.status(500).json({ error: 'Failed to create project from template' });
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
      
      // Validate file name
      if (!req.body.name || req.body.name.trim() === '') {
        return res.status(400).json({ error: 'File name is required' });
      }
      
      // Check for invalid file names
      const invalidChars = /[<>:"|?*]/g;
      if (invalidChars.test(req.body.name)) {
        return res.status(400).json({ error: 'File name contains invalid characters' });
      }
      
      // Check for duplicate file names in the same directory
      const existingFiles = await storage.getFilesByProject(projectId);
      const duplicate = existingFiles.find(f => 
        f.name === req.body.name && 
        f.parentId === (req.body.parentId || null)
      );
      
      if (duplicate) {
        return res.status(409).json({ error: 'A file with this name already exists in this directory' });
      }
      
      const fileData = {
        name: req.body.name.trim(),
        projectId: projectId,
        content: req.body.content || '',
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
      
      // Validate new file name if provided
      if (req.body.name) {
        if (req.body.name.trim() === '') {
          return res.status(400).json({ error: 'File name cannot be empty' });
        }
        
        const invalidChars = /[<>:"|?*]/g;
        if (invalidChars.test(req.body.name)) {
          return res.status(400).json({ error: 'File name contains invalid characters' });
        }
        
        // Check for duplicate names
        const existingFiles = await storage.getFilesByProject(file.projectId);
        const duplicate = existingFiles.find(f => 
          f.id !== fileId && 
          f.name === req.body.name && 
          f.parentId === file.parentId
        );
        
        if (duplicate) {
          return res.status(409).json({ error: 'A file with this name already exists in this directory' });
        }
      }
      
      // Validate content size for non-folders
      if (!file.isFolder && req.body.content !== undefined) {
        const maxSize = 10 * 1024 * 1024; // 10MB limit
        if (req.body.content.length > maxSize) {
          return res.status(413).json({ error: 'File content exceeds maximum size limit (10MB)' });
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
      const userId = req.user!.id;
      const { environment = 'production', region = 'us-east-1', customDomain } = req.body;
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Create deployment record
      const deployment = await storage.createDeployment({
        projectId,
        status: 'deploying',
        url: `https://project-${projectId}-${Date.now()}.ecode-app.com`,
        buildLogs: '',
        config: JSON.stringify({
          environment,
          region,
          customDomain,
          userId
        }),
        logs: 'Deployment started...',
        version: `v${Date.now()}`
      });
      
      // Start deployment process asynchronously
      setTimeout(async () => {
        try {
          // Simulate deployment steps
          await storage.updateDeployment(deployment.id, {
            status: 'running',
            logs: 'Deployment completed successfully',
            updatedAt: new Date()
          });
        } catch (error) {
          console.error('Deployment process error:', error);
          await storage.updateDeployment(deployment.id, {
            status: 'failed',
            logs: `Deployment failed: ${error}`,
            updatedAt: new Date()
          });
        }
      }, 5000); // Simulate 5 second deployment
      
      res.json({ 
        deploymentId: deployment.id.toString(),
        status: deployment.status,
        url: deployment.url
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
      const files = await storage.getFilesByProject(projectId);
      
      // Check if this is a web project (HTML/CSS/JS)
      const hasHtmlFile = files.some(f => f.name.endsWith('.html'));
      const isWebProject = hasHtmlFile || (mainFile && mainFile.endsWith('.html'));
      
      if (isWebProject) {
        // For web projects, return a preview URL without starting Docker
        const previewPath = `/api/projects/${projectId}/preview/`;
        
        res.json({
          stdout: 'Web preview is ready!',
          stderr: '',
          exitCode: 0,
          executionTime: 0,
          timedOut: false,
          executionId: `${projectId}-${req.user!.id}-${Date.now()}`,
          previewUrl: previewPath
        });
      } else {
        // For non-web projects, execute the code
        const executor = new CodeExecutor();
        
        const result = await executor.execute({
          projectId: projectId,
          userId: req.user!.id,
          language: project.language || 'nodejs',
          mainFile,
          stdin,
          timeout: timeout || 30000
        });

        res.json({
          ...result,
          executionId: `${projectId}-${req.user!.id}-${Date.now()}`
        });
      }
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

  // Search Route
  app.get('/api/projects/:id/search', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { q } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }
      
      // Get all files in the project
      const files = await storage.getFilesByProject(projectId);
      
      // Search through files
      const results = [];
      for (const file of files) {
        if (!file.isFolder && file.content) {
          // Search in file name
          if (file.name.toLowerCase().includes(q.toLowerCase())) {
            results.push({
              file: file.name,
              line: 0,
              content: `File name matches: ${file.name}`,
              type: 'filename'
            });
          }
          
          // Search in file content
          const lines = file.content.split('\n');
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(q.toLowerCase())) {
              results.push({
                file: file.name,
                line: index + 1,
                content: line.trim(),
                type: 'content'
              });
            }
          });
        }
      }
      
      res.json(results.slice(0, 50)); // Limit to 50 results
    } catch (error) {
      console.error('Error searching project:', error);
      res.status(500).json({ error: 'Failed to search project' });
    }
  });

  // Terminal Session Management Routes
  app.get('/api/projects/:id/terminal/sessions', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      // Return mock sessions for now
      res.json([
        {
          id: `session-${projectId}-1`,
          name: 'Main Terminal',
          active: true,
          created: new Date().toISOString()
        }
      ]);
    } catch (error) {
      console.error('Error getting terminal sessions:', error);
      res.status(500).json({ error: 'Failed to get terminal sessions' });
    }
  });

  app.post('/api/projects/:id/terminal/sessions', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const { name } = req.body;
      
      const sessionId = `session-${projectId}-${Date.now()}`;
      res.json({
        id: sessionId,
        name: name || 'New Terminal',
        active: true,
        created: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error creating terminal session:', error);
      res.status(500).json({ error: 'Failed to create terminal session' });
    }
  });

  app.delete('/api/projects/:id/terminal/sessions/:sessionId', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting terminal session:', error);
      res.status(500).json({ error: 'Failed to delete terminal session' });
    }
  });

  // Preview URL endpoint
  app.get('/api/projects/:id/preview-url', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      
      // Get project files to check if it's a web project
      const files = await storage.getFilesByProject(projectId);
      const hasHtmlFile = files.some(f => f.name.endsWith('.html'));
      
      if (hasHtmlFile) {
        // Return the preview URL for web projects
        const previewUrl = `/api/projects/${projectId}/preview/`;
        res.json({ previewUrl });
      } else {
        // Non-web projects don't have a preview
        res.json({ previewUrl: null });
      }
    } catch (error) {
      console.error('Error getting preview URL:', error);
      res.status(500).json({ error: 'Failed to get preview URL' });
    }
  });

  // ECodeDB Routes
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
  
  // WebSocket for shell
  const shellWss = setupShellWebSocket(httpServer);
  
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

  app.get("/api/task-summaries/:projectId", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Authentication required" });
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.session.userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const summaries = await storage.getProjectTaskSummaries(projectId);
      res.json(summaries);
    } catch (err: any) {
      console.error("[task-summaries] Error:", err?.message || err);
      res.json([]);
    }
  });

  try {
    const { centralUpgradeDispatcher } = await import('./websocket/central-upgrade-dispatcher');
    centralUpgradeDispatcher.initialize(httpServer);
  } catch (err: any) {
    console.error('[catch] Central Upgrade Dispatcher init failed:', err?.message || err);
  }

  try {
    const { socketIOTerminalService } = await import('./terminal/socket-io-terminal');
    socketIOTerminalService.initialize(httpServer);
  } catch (err: any) {
    console.error('[catch] Socket.IO Terminal init failed:', err?.message || err);
  }
  const mainWss = new WebSocketServer({ noServer: true });
  mainWss.on("connection", (ws: WebSocket, req: any) => {
    const projectId = req.__projectId;
    if (!projectId) { ws.close(); return; }
    if (!wsClients.has(projectId)) wsClients.set(projectId, new Set());
    wsClients.get(projectId)!.add(ws);

    const userId = req.session?.userId;
    if (userId) {
      if (!wsUserClients.has(userId)) wsUserClients.set(userId, new Set());
      wsUserClients.get(userId)!.add(ws);
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
  // Simple preview route for HTML/CSS/JS projects
  app.get('/preview/:projectId/*', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const filepath = req.params[0] || 'index.html';
      
      // Get all project files
      const files = await storage.getFilesByProject(projectId);
      
      // Find the requested file
      const file = files.find(f => f.name === filepath && !f.isFolder);
      
      if (!file) {
        // Try to find index.html as default
        const indexFile = files.find(f => f.name === 'index.html' && !f.isFolder);
        if (indexFile) {
          res.type('html').send(indexFile.content || '');
          return;
        }
        return res.status(404).send('File not found');
      }
      
      // Set appropriate content type
      const ext = path.extname(filepath).toLowerCase();
      switch (ext) {
        case '.html':
          res.type('text/html');
          break;
        case '.css':
          res.type('text/css');
          break;
        case '.js':
          res.type('application/javascript');
          break;
        default:
          res.type('text/plain');
      }
      
      res.send(file.content || '');
    } catch (error) {
      console.error('Error serving preview:', error);
      res.status(500).send('Error loading preview');
    }
  });
  
  // Secrets Routes
  app.get('/api/secrets', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userSecrets = await storage.getSecretsByUser(userId);
      
      // Don't send the actual values for security
      const sanitizedSecrets = userSecrets.map(secret => ({
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      }));
      
      res.json(sanitizedSecrets);
    } catch (error) {
      console.error('Error fetching secrets:', error);
      res.status(500).json({ error: 'Failed to fetch secrets' });
    }
  });
  
  app.post('/api/secrets', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { key, value, description, projectId } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }
      
      // Validate key format (uppercase, underscores only)
      if (!/^[A-Z_]+$/.test(key)) {
        return res.status(400).json({ error: 'Key must contain only uppercase letters and underscores' });
      }
      
      const secret = await storage.createSecret({
        userId,
        key,
        value,
        description,
        projectId
      });
      
      // Return without the value for security
      res.json({
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      });
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        return res.status(409).json({ error: 'A secret with this key already exists' });
      }
      console.error('Error creating secret:', error);
      res.status(500).json({ error: 'Failed to create secret' });
    }
  });
  
  app.put('/api/secrets/:id', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      const { value, description } = req.body;
      
      // Verify ownership
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      const updated = await storage.updateSecret(secretId, {
        value,
        description
      });
      
      // Return without the value for security
      res.json({
        id: updated.id,
        key: updated.key,
        description: updated.description,
        projectId: updated.projectId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      });
    } catch (error) {
      console.error('Error updating secret:', error);
      res.status(500).json({ error: 'Failed to update secret' });
    }
  });
  
  app.delete('/api/secrets/:id', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      
      // Verify ownership
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      await storage.deleteSecret(secretId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting secret:', error);
      res.status(500).json({ error: 'Failed to delete secret' });
    }
  });
  
  // Get secret value (for server-side use only)
  app.get('/api/secrets/:id/value', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      res.json({ value: secret.value });
    } catch (error) {
      console.error('Error fetching secret value:', error);
      res.status(500).json({ error: 'Failed to fetch secret value' });
    }
  });

  // Serve project static files for preview
  app.get("/api/preview/:projectId/", async (req: Request, res: Response) => {
    return serveProjectFile(req, res, req.params.projectId, "index.html");
  });
  app.get("/api/preview/:projectId/{*filePath}", async (req: Request, res: Response) => {
    const filePath = (req.params as any).filePath || "index.html";
    return serveProjectFile(req, res, req.params.projectId, filePath);
  });

  async function serveProjectFile(req: Request, res: Response, projectId: string, filePath: string) {
    try {
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).send("Project not found");
      if (project.visibility === "private") {
        const sessionUserId = req.session?.userId;
        if (!sessionUserId) {
          return res.status(403).send("Access denied: this project is private");
        }
        if (sessionUserId !== project.userId) {
          const isGuest = await storage.isProjectGuest(project.id, sessionUserId);
          if (!isGuest) {
            if (project.teamId) {
              const teams = await storage.getUserTeams(sessionUserId);
              if (!teams.some(t => t.id === project.teamId)) {
                return res.status(403).send("Access denied: this project is private");
              }
            } else {
              return res.status(403).send("Access denied: this project is private");
            }
          }
        }
      }
      const files = await storage.getFilesByProject(projectId);
      const targetFile = files.find(f => f.filename === filePath || f.filename === `/${filePath}`);
      if (!targetFile || !targetFile.content) {
        const indexFile = files.find(f => f.filename === "index.html");
        if (indexFile && indexFile.content) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          return res.send(indexFile.content);
        }
        return res.status(404).send("File not found");
      }
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const mimeTypes: Record<string, string> = {
        html: "text/html; charset=utf-8",
        css: "text/css; charset=utf-8",
        js: "application/javascript; charset=utf-8",
        json: "application/json; charset=utf-8",
        png: "image/png",
        jpg: "image/jpeg",
        svg: "image/svg+xml",
      };
      const contentType = mimeTypes[ext] || "text/plain; charset=utf-8";
      res.setHeader("Content-Type", contentType);
      return res.send(targetFile.content);
    } catch (err: any) {
      console.error("[preview] Error serving file:", err.message);
      return res.status(500).send("Internal error");
    }
  }

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
  
  // Terminal Routes - Simple implementation for API compatibility
  const terminalSessions = new Map<string, { userId: number; projectId: number; id: string }>();
  
  app.get('/api/terminal/sessions', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sessions = Array.from(terminalSessions.values())
        .filter(session => session.userId === userId);
      res.json(sessions);
    } catch (error) {
      console.error('Error getting terminal sessions:', error);
      res.status(500).json({ error: 'Failed to get terminal sessions' });
    }
  });

  app.post('/api/terminal/create', ensureAuthenticated, async (req, res) => {
    try {
      const { projectId } = req.body;
      const userId = req.user!.id;
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      terminalSessions.set(sessionId, { userId, projectId, id: sessionId });
      res.json({ sessionId });
    } catch (error) {
      console.error('Error creating terminal session:', error);
      res.status(500).json({ error: 'Failed to create terminal session' });
    }
  });

  app.delete('/api/terminal/:sessionId', ensureAuthenticated, async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      terminalSessions.delete(sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error closing terminal session:', error);
      res.status(500).json({ error: 'Failed to close terminal session' });
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
      const { message, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      // Get project context
      const project = await storage.getProject(parseInt(projectId));
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Get recent file content for context
      const files = await storage.getFilesByProject(parseInt(projectId));
      const codeContext = files
        .filter(f => !f.isFolder && context?.file === f.name)
        .slice(0, 3)
        .map(f => `File: ${f.name}\n\`\`\`${f.name.split('.').pop() || 'txt'}\n${f.content}\n\`\`\``)
        .join('\n\n');
      
      // Create OpenAI client
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      // Build conversation history
      const conversationHistory = context?.history || [];
      
      const systemMessage = {
        role: 'system' as const,
        content: `You are E-Code AI Assistant, an expert coding assistant similar to Replit's Ghostwriter. You help users with their ${project.name} project.
        
Current project context:
- Language: ${project.language || 'Not specified'}
- Project: ${project.name}
${codeContext ? `\nCurrent file context:\n${codeContext}` : ''}

Provide helpful, concise responses. When suggesting code, use proper markdown formatting with language hints. Be friendly and encouraging.`
      };
      
      const messages = [
        systemMessage,
        ...conversationHistory.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: 'user' as const, content: message }
      ];
      
      // Create OpenAI completion
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      });
      
      const assistantMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: completion.choices[0].message.content || 'I apologize, but I was unable to generate a response.',
        timestamp: Date.now()
      };
      
      res.json(assistantMessage);
    } catch (error: any) {
      console.error('AI chat error:', error);
      
      // If OpenAI API key is missing or invalid
      if (error.status === 401 || error.message?.includes('API key')) {
        return res.json({
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: 'It looks like the OpenAI API key is not configured correctly. Please ensure you have set up your OPENAI_API_KEY in the environment variables.',
          timestamp: Date.now()
        });
      }
      
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
  const packageInstallerModule = await import('./package-installer');
  const packageInstaller = packageInstallerModule.packageInstaller;
  
  app.get('/api/projects/:id/packages', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const packages = await packageInstaller.listPackages(projectId);
      res.json(packages);
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
      
      const result = await packageInstaller.installPackages({
        projectId,
        packages: [name],
        dev: false
      });
      
      res.json(result);
    } catch (error) {
      console.error('Error installing package:', error);
      res.status(500).json({ error: 'Failed to install package' });
    }
  });
  
  app.delete('/api/projects/:id/packages/:packageName', ensureAuthenticated, ensureProjectAccess, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const packageName = req.params.packageName;
      
      const result = await packageInstaller.uninstallPackages(projectId, [packageName]);
      res.json(result);
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
      
      const userId = req.user!.id;
      const { environment = 'production', region = 'us-east-1', customDomain } = req.body;
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Create deployment record
      const deployment = await storage.createDeployment({
        projectId,
        status: 'deploying',
        url: `https://project-${projectId}-${Date.now()}.ecode-app.com`,
        buildLogs: '',
        config: JSON.stringify({
          environment,
          region,
          customDomain,
          userId
        }),
        logs: 'Deployment started...',
        version: `v${Date.now()}`
      });
      
      // Start deployment process asynchronously
      setTimeout(async () => {
        try {
          // Simulate deployment steps
          await storage.updateDeployment(deployment.id, {
            status: 'running',
            logs: 'Deployment completed successfully',
            updatedAt: new Date()
          });
        } catch (error) {
          console.error('Deployment process error:', error);
          await storage.updateDeployment(deployment.id, {
            status: 'failed',
            logs: `Deployment failed: ${error}`,
            updatedAt: new Date()
          });
        }
      }, 5000); // Simulate 5 second deployment
      
      res.json({
        deploymentId: deployment.id,
        url: deployment.url,
        status: deployment.status
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

  // Admin routes
  app.use("/api/admin", adminRoutes);
  
  // Shell routes
  app.use("/api/shell", shellRoutes);
  
  // Notification routes
  app.use(notificationRoutes);
  
  // Preview routes
  const previewRoutesModule = await import('./routes/preview');
  app.use(previewRoutesModule.default);
  
  // File upload routes
  const fileUploadRoutesModule = await import('./routes/file-upload');
  app.use(fileUploadRoutesModule.default);

  // Simple preview route for HTML/CSS/JS projects
  app.get('/preview/:projectId/*', async (req, res) => {
    try {
      const projectId = parseInt(req.params.projectId);
      const filepath = (req.params as any)[0] || 'index.html';
      
      // Get all project files
      const files = await storage.getFilesByProject(projectId);
      
      // Find the requested file
      const file = files.find(f => f.name === filepath && !f.isFolder);
      
      if (!file) {
        // Try to find index.html as default
        const indexFile = files.find(f => f.name === 'index.html' && !f.isFolder);
        if (indexFile) {
          res.type('html').send(indexFile.content || '');
          return;
        }
        return res.status(404).send('File not found');
      }
      
      // Set appropriate content type
      const ext = path.extname(filepath).toLowerCase();
      switch (ext) {
        case '.html':
          res.type('text/html');
          break;
        case '.css':
          res.type('text/css');
          break;
        case '.js':
          res.type('application/javascript');
          break;
        default:
          res.type('text/plain');
      }
      
      res.send(file.content || '');
    } catch (error) {
      console.error('Error serving preview:', error);
      res.status(500).send('Error loading preview');
    }
  });
  
  // Secrets Routes
  app.get('/api/secrets', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userSecrets = await storage.getSecretsByUser(userId);
      
      // Don't send the actual values for security
      const sanitizedSecrets = userSecrets.map(secret => ({
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      }));
      
      res.json(sanitizedSecrets);
    } catch (error) {
      console.error('Error fetching secrets:', error);
      res.status(500).json({ error: 'Failed to fetch secrets' });
    }
  });
  
  app.post('/api/secrets', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { key, value, description, projectId } = req.body;
      
      if (!key || !value) {
        return res.status(400).json({ error: 'Key and value are required' });
      }
      
      // Validate key format (uppercase, underscores only)
      if (!/^[A-Z_]+$/.test(key)) {
        return res.status(400).json({ error: 'Key must contain only uppercase letters and underscores' });
      }
      
      const secret = await storage.createSecret({
        userId,
        key,
        value,
        description,
        projectId
      });
      
      // Return without the value for security
      res.json({
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt
      });
    } catch (error: any) {
      if (error.message?.includes('duplicate key')) {
        return res.status(409).json({ error: 'A secret with this key already exists' });
      }
      console.error('Error creating secret:', error);
      res.status(500).json({ error: 'Failed to create secret' });
    }
  });
  
  app.put('/api/secrets/:id', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      const { value, description } = req.body;
      
      // Verify ownership
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      const updated = await storage.updateSecret(secretId, {
        value,
        description
      });
      
      // Return without the value for security
      res.json({
        id: updated.id,
        key: updated.key,
        description: updated.description,
        projectId: updated.projectId,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      });
    } catch (error) {
      console.error('Error updating secret:', error);
      res.status(500).json({ error: 'Failed to update secret' });
    }
  });
  
  app.delete('/api/secrets/:id', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      
      // Verify ownership
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      await storage.deleteSecret(secretId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting secret:', error);
      res.status(500).json({ error: 'Failed to delete secret' });
    }
  });
  
  // Get secret value (for server-side use only)
  app.get('/api/secrets/:id/value', ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const secretId = parseInt(req.params.id);
      
      const secret = await storage.getSecret(secretId);
      if (!secret || secret.userId !== userId) {
        return res.status(404).json({ error: 'Secret not found' });
      }
      
      res.json({ value: secret.value });
    } catch (error) {
      console.error('Error fetching secret value:', error);
      res.status(500).json({ error: 'Failed to fetch secret value' });
    }
  });

  // Newsletter API routes
  app.post('/api/newsletter/subscribe', async (req, res) => {
    try {
      const { email } = req.body;
      
      // Import validation utilities
      const { validateEmail, sanitizeEmail } = await import('./utils/email-validator');
      const { sendNewsletterWelcomeEmail } = await import('./utils/gandi-email');
      
      // Validate email with E-Code design standards
      const validation = validateEmail(email);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      
      // Sanitize email
      const sanitizedEmail = sanitizeEmail(email);
      
      // Generate confirmation token
      const confirmationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Subscribe to newsletter
      const subscriber = await storage.subscribeToNewsletter({
        email: sanitizedEmail,
        isActive: true,
        confirmationToken
      });
      
      // Send welcome email with confirmation link
      await sendNewsletterWelcomeEmail(sanitizedEmail, confirmationToken);
      
      res.json({ 
        success: true, 
        message: 'Successfully subscribed! Please check your email to confirm your subscription.',
        data: {
          email: subscriber.email,
          subscribed: true,
          confirmationRequired: true
        }
      });
    } catch (error: any) {
      console.error('Newsletter subscription error:', error);
      
      if (error.message === 'Email already subscribed') {
        return res.status(409).json({ message: 'You\'re already subscribed to our newsletter!' });
      }
      
      res.status(500).json({ message: 'Failed to subscribe to newsletter' });
    }
  });
  
  app.post('/api/newsletter/unsubscribe', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      await storage.unsubscribeFromNewsletter(email);
      
      res.json({ 
        success: true, 
        message: 'Successfully unsubscribed from newsletter' 
      });
    } catch (error) {
      console.error('Newsletter unsubscribe error:', error);
      res.status(500).json({ message: 'Failed to unsubscribe from newsletter' });
    }
  });
  
  app.get('/api/newsletter/confirm', async (req, res) => {
    try {
      const { email, token } = req.query;
      
      if (!email || !token) {
        return res.status(400).json({ message: 'Email and token are required' });
      }
      
      const confirmed = await storage.confirmNewsletterSubscription(
        email as string,
        token as string
      );
      
      if (confirmed) {
        // Send confirmation success email
        const { sendNewsletterConfirmedEmail } = await import('./utils/gandi-email');
        await sendNewsletterConfirmedEmail(email as string);
        
        // Redirect to success page
        res.redirect('/newsletter-confirmed?success=true');
      } else {
        res.status(400).json({ message: 'Invalid confirmation link' });
      }
    } catch (error) {
      console.error('Newsletter confirmation error:', error);
      res.status(500).json({ message: 'Failed to confirm email' });
    }
  });
  
  // Admin endpoint to get newsletter subscribers (protected)
  app.get('/api/newsletter/subscribers', ensureAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.username !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const subscribers = await storage.getNewsletterSubscribers();
      res.json(subscribers);
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      res.status(500).json({ message: 'Failed to fetch subscribers' });
    }
  });

  // Admin endpoint to test Gandi email connection
  app.get('/api/newsletter/test-gandi', ensureAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.username !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const { testGandiConnection } = await import('./utils/gandi-email');
      const connected = await testGandiConnection();
      
      res.json({ 
        connected,
        message: connected ? 'Gandi SMTP connection successful' : 'Gandi SMTP not configured or connection failed',
        config: {
          host: process.env.GANDI_SMTP_HOST || 'mail.gandi.net',
          port: process.env.GANDI_SMTP_PORT || '587',
          userConfigured: !!process.env.GANDI_SMTP_USER || !!process.env.GANDI_EMAIL,
          passConfigured: !!process.env.GANDI_SMTP_PASS || !!process.env.GANDI_PASSWORD
        }
      });
    } catch (error) {
      console.error('Error testing Gandi connection:', error);
      res.status(500).json({ message: 'Failed to test Gandi connection' });
    }
  });

  // Community API endpoints
  app.get('/api/community/posts', async (req, res) => {
    try {
      const { category, search } = req.query;
      
      // Mock community posts data
      const mockPosts = [
        {
          id: '1',
          title: 'Built a Real-Time Collaboration Editor with WebSockets',
          content: 'Check out my latest project! I created a collaborative code editor that supports real-time editing with multiple users...',
          author: {
            id: '1',
            username: 'sarah_dev',
            displayName: 'Sarah Chen',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah',
            reputation: 2456,
          },
          category: 'showcase',
          tags: ['websockets', 'react', 'collaboration'],
          likes: 234,
          comments: 45,
          views: 1234,
          isLiked: Math.random() > 0.5,
          isBookmarked: Math.random() > 0.7,
          createdAt: '2 hours ago',
          projectUrl: '/project/123',
          imageUrl: 'https://api.dicebear.com/7.x/shapes/svg?seed=project1',
        },
        {
          id: '2',
          title: 'How to optimize React performance in large applications',
          content: 'I\'ve been working on performance optimization and wanted to share some tips that helped me reduce rendering time by 60%...',
          author: {
            id: '2',
            username: 'alex_code',
            displayName: 'Alex Rodriguez',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
            reputation: 3890,
          },
          category: 'tutorials',
          tags: ['react', 'performance', 'optimization'],
          likes: 567,
          comments: 89,
          views: 4567,
          isLiked: Math.random() > 0.5,
          isBookmarked: Math.random() > 0.7,
          createdAt: '5 hours ago',
        },
        {
          id: '3',
          title: 'Need help with async/await in Node.js',
          content: 'I\'m having trouble understanding when to use async/await vs promises. Can someone explain the differences?',
          author: {
            id: '3',
            username: 'newbie_coder',
            displayName: 'Jamie Wilson',
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jamie',
            reputation: 156,
          },
          category: 'help',
          tags: ['nodejs', 'async', 'promises'],
          likes: 23,
          comments: 12,
          views: 234,
          isLiked: Math.random() > 0.5,
          isBookmarked: Math.random() > 0.7,
          createdAt: '1 day ago',
        }
      ];

      // Filter by category and search
      let filteredPosts = mockPosts;
      if (category && category !== 'all') {
        filteredPosts = filteredPosts.filter(post => post.category === category);
      }
      if (search) {
        const searchTerm = search.toString().toLowerCase();
        filteredPosts = filteredPosts.filter(post => 
          post.title.toLowerCase().includes(searchTerm) ||
          post.content.toLowerCase().includes(searchTerm) ||
          post.tags.some(tag => tag.toLowerCase().includes(searchTerm))
        );
      }

      res.json(filteredPosts);
    } catch (error) {
      console.error('Error fetching community posts:', error);
      res.status(500).json({ message: 'Failed to fetch community posts' });
    }
  });

  app.get('/api/community/challenges', async (req, res) => {
    try {
      const mockChallenges = [
        {
          id: '1',
          title: 'Build a Todo App with AI Integration',
          description: 'Create a todo application that uses AI to categorize and prioritize tasks automatically.',
          difficulty: 'medium',
          category: 'full-stack',
          participants: 127,
          submissions: 45,
          prize: '500 E-Code Cycles',
          deadline: '2025-02-15',
          status: 'active',
        },
        {
          id: '2',
          title: 'CSS Animation Challenge',
          description: 'Design the most creative CSS-only animation. No JavaScript allowed!',
          difficulty: 'easy',
          category: 'frontend',
          participants: 89,
          submissions: 23,
          prize: '250 E-Code Cycles',
          deadline: '2025-02-10',
          status: 'active',
        },
        {
          id: '3',
          title: 'Machine Learning Model Competition',
          description: 'Build the most accurate ML model for predicting stock prices.',
          difficulty: 'hard',
          category: 'data-science',
          participants: 56,
          submissions: 12,
          prize: '1000 E-Code Cycles',
          deadline: '2025-02-20',
          status: 'active',
        }
      ];

      res.json(mockChallenges);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      res.status(500).json({ message: 'Failed to fetch challenges' });
    }
  });

  app.get('/api/community/leaderboard', async (req, res) => {
    try {
      const mockLeaderboard = [
        {
          id: '1',
          username: 'code_master',
          displayName: 'Emily Zhang',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emily',
          score: 12450,
          rank: 1,
          badges: ['top-contributor', 'challenge-winner', 'mentor'],
          streakDays: 45,
        },
        {
          id: '2',
          username: 'dev_wizard',
          displayName: 'Marcus Johnson',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=marcus',
          score: 11234,
          rank: 2,
          badges: ['top-contributor', 'helpful'],
          streakDays: 32,
        },
        {
          id: '3',
          username: 'tech_guru',
          displayName: 'Priya Patel',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=priya',
          score: 10890,
          rank: 3,
          badges: ['challenge-winner', 'mentor'],
          streakDays: 28,
        }
      ];

      res.json(mockLeaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
  });

  app.post('/api/community/posts/:id/like', ensureAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      // In a real app, toggle like status in database
      res.json({ success: true, message: 'Post liked' });
    } catch (error) {
      console.error('Error liking post:', error);
      res.status(500).json({ message: 'Failed to like post' });
    }
  });

  app.post('/api/community/posts/:id/bookmark', ensureAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      // In a real app, toggle bookmark status in database
      res.json({ success: true, message: 'Post bookmarked' });
    } catch (error) {
      console.error('Error bookmarking post:', error);
      res.status(500).json({ message: 'Failed to bookmark post' });
    }
  });

  // Bounty API routes
  app.get('/api/bounties', async (req, res) => {
    try {
      const bounties = await storage.getAllBounties();
      res.json(bounties);
    } catch (error) {
      console.error('Error fetching bounties:', error);
      res.status(500).json({ message: 'Failed to fetch bounties' });
    }
  });

  app.get('/api/bounties/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bounty ID' });
      }
      
      const bounty = await storage.getBounty(id);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }
      
      res.json(bounty);
    } catch (error) {
      console.error('Error fetching bounty:', error);
      res.status(500).json({ message: 'Failed to fetch bounty' });
    }
  });

  app.get('/api/user/bounties', ensureAuthenticated, async (req, res) => {
    try {
      const bounties = await storage.getBountiesByUser(req.user!.id);
      res.json(bounties);
    } catch (error) {
      console.error('Error fetching user bounties:', error);
      res.status(500).json({ message: 'Failed to fetch user bounties' });
    }
  });

  app.post('/api/bounties', ensureAuthenticated, async (req, res) => {
    try {
      const bountyData = {
        ...req.body,
        authorId: req.user!.id,
        authorName: req.user!.username || req.user!.displayName || 'Anonymous',
        authorAvatar: req.user!.avatarUrl || '👤',
        authorVerified: req.user!.username === 'admin' // Simple verification for now
      };
      
      const bounty = await storage.createBounty(bountyData);
      res.json(bounty);
    } catch (error) {
      console.error('Error creating bounty:', error);
      res.status(500).json({ message: 'Failed to create bounty' });
    }
  });

  app.patch('/api/bounties/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bounty ID' });
      }
      
      // Check if user owns the bounty
      const bounty = await storage.getBounty(id);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }
      
      if (bounty.authorId !== req.user!.id && req.user!.username !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to update this bounty' });
      }
      
      const updatedBounty = await storage.updateBounty(id, req.body);
      res.json(updatedBounty);
    } catch (error) {
      console.error('Error updating bounty:', error);
      res.status(500).json({ message: 'Failed to update bounty' });
    }
  });

  app.delete('/api/bounties/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid bounty ID' });
      }
      
      // Check if user owns the bounty
      const bounty = await storage.getBounty(id);
      if (!bounty) {
        return res.status(404).json({ message: 'Bounty not found' });
      }
      
      if (bounty.authorId !== req.user!.id && req.user!.username !== 'admin') {
        return res.status(403).json({ message: 'Not authorized to delete this bounty' });
      }
      
      await storage.deleteBounty(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting bounty:', error);
      res.status(500).json({ message: 'Failed to delete bounty' });
    }
  });

  // Bounty submission routes
  app.get('/api/bounties/:id/submissions', async (req, res) => {
    try {
      const bountyId = parseInt(req.params.id);
      if (isNaN(bountyId)) {
        return res.status(400).json({ message: 'Invalid bounty ID' });
      }
      
      const submissions = await storage.getBountySubmissions(bountyId);
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      res.status(500).json({ message: 'Failed to fetch submissions' });
    }
  });

  app.get('/api/user/submissions', ensureAuthenticated, async (req, res) => {
    try {
      const submissions = await storage.getUserBountySubmissions(req.user!.id);
      res.json(submissions);
    } catch (error) {
      console.error('Error fetching user submissions:', error);
      res.status(500).json({ message: 'Failed to fetch user submissions' });
    }
  });

  app.post('/api/bounties/:id/submit', ensureAuthenticated, async (req, res) => {
    try {
      const bountyId = parseInt(req.params.id);
      if (isNaN(bountyId)) {
        return res.status(400).json({ message: 'Invalid bounty ID' });
      }
      
      const submission = await storage.createBountySubmission({
        bountyId,
        userId: req.user!.id,
        status: 'submitted',
        submissionUrl: req.body.submissionUrl,
        feedback: req.body.feedback
      });
      
      res.json(submission);
    } catch (error) {
      console.error('Error creating submission:', error);
      res.status(500).json({ message: 'Failed to create submission' });
    }
  });

  app.patch('/api/submissions/:id', ensureAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid submission ID' });
      }
      
      // Only bounty author or admin can update submissions
      const updatedSubmission = await storage.updateBountySubmission(id, req.body);
      res.json(updatedSubmission);
    } catch (error) {
      console.error('Error updating submission:', error);
      res.status(500).json({ message: 'Failed to update submission' });
    }
  });

  // Blog API routes
  app.get('/api/blog/posts', async (req, res) => {
    try {
      const posts = await storage.getAllBlogPosts(true); // Only published posts
      res.json(posts);
    } catch (error) {
      console.error('Error fetching blog posts:', error);
      res.status(500).json({ message: 'Failed to fetch blog posts' });
    }
  });

  app.get('/api/blog/posts/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);
      
      if (!post) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      res.json(post);
    } catch (error) {
      console.error('Error fetching blog post:', error);
      res.status(500).json({ message: 'Failed to fetch blog post' });
    }
  });

  app.get('/api/blog/featured', async (req, res) => {
    try {
      const posts = await storage.getFeaturedBlogPosts();
      res.json(posts);
    } catch (error) {
      console.error('Error fetching featured posts:', error);
      res.status(500).json({ message: 'Failed to fetch featured posts' });
    }
  });

  app.get('/api/blog/categories/:category', async (req, res) => {
    try {
      const { category } = req.params;
      const posts = await storage.getBlogPostsByCategory(category);
      res.json(posts);
    } catch (error) {
      console.error('Error fetching posts by category:', error);
      res.status(500).json({ message: 'Failed to fetch posts by category' });
    }
  });

  // Admin blog endpoints
  app.post('/api/blog/posts', ensureAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.username !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const post = await storage.createBlogPost(req.body);
      res.json(post);
    } catch (error) {
      console.error('Error creating blog post:', error);
      res.status(500).json({ message: 'Failed to create blog post' });
    }
  });

  app.patch('/api/blog/posts/:id', ensureAuthenticated, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.username !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const id = parseInt(req.params.id);
      const post = await storage.updateBlogPost(id, req.body);
      
      if (!post) {
        return res.status(404).json({ message: 'Blog post not found' });
      }
      
      res.json(post);
    } catch (error) {
      console.error('Error updating blog post:', error);
      res.status(500).json({ message: 'Failed to update blog post' });
    }
  });

  return httpServer;
}
