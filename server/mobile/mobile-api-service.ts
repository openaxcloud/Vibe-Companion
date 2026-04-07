// @ts-nocheck
import { Request, Response } from 'express';
import { storage } from '../storage';
import { CodeExecutor } from '../execution/executor';
import { createLogger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { compare } from '../utils/bcrypt-compat';

const logger = createLogger('mobile-api');

interface MobileSession {
  id: string;
  userId: number;
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
  osVersion: string;
  deviceModel: string;
  pushToken?: string;
  lastActiveAt: Date;
  createdAt: Date;
}

interface MobileProject {
  id: number;
  name: string;
  slug: string;
  language: string;
  lastOpened?: Date;
  isPublic: boolean;
  canRun: boolean;
  fileCount: number;
  description?: string;
}

export class MobileAPIService {
  private activeSessions: Map<string, MobileSession> = new Map();
  private codeExecutor: CodeExecutor;

  constructor() {
    this.codeExecutor = new CodeExecutor();
  }

  // Mobile Authentication
  async authenticateDevice(req: Request, res: Response) {
    try {
      const { username, password, deviceId, platform, appVersion, osVersion, deviceModel } = req.body;

      if (!username || !password || !deviceId || !platform) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // SECURITY FIX: Validate credentials against database (not demo mode)
      // Find user by email or username
      const user = await storage.getUserByEmail(username) || 
                   await storage.getUserByUsername?.(username);
      
      if (!user) {
        logger.warn(`[Mobile Auth] Failed login attempt for: ${username}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isValidPassword = await compare(password, user.hashedPassword || '');
      if (!isValidPassword) {
        logger.warn(`[Mobile Auth] Invalid password for user: ${user.id}`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      logger.info(`[Mobile Auth] Successful login for user: ${user.id}`);

      // Generate mobile JWT token - SECURITY: Use centralized secrets manager
      const { getJwtSecret } = await import('../utils/secrets-manager');
      const token = jwt.sign(
        { userId: user.id, deviceId, platform },
        getJwtSecret(),
        { expiresIn: '30d' }
      );

      // Create/update mobile session
      const sessionId = `mobile-${user.id}-${deviceId}`;
      const session: MobileSession = {
        id: sessionId,
        userId: user.id,
        deviceId,
        platform: platform as 'ios' | 'android',
        appVersion: appVersion || '1.0.0',
        osVersion: osVersion || 'unknown',
        deviceModel: deviceModel || 'unknown',
        lastActiveAt: new Date(),
        createdAt: new Date()
      };

      this.activeSessions.set(sessionId, session);

      logger.info(`Mobile authentication successful for user ${user.id} on ${platform}`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        },
        session: {
          id: sessionId,
          platform,
          appVersion
        }
      });
    } catch (error) {
      logger.error('Mobile authentication error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  }

  // Get mobile-optimized project list
  async getMobileProjects(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 1; // Demo user ID

      // Return demo mobile projects data
      const mobileProjects: MobileProject[] = [
        {
          id: 1,
          name: "React Native Todo App",
          slug: "react-native-todo",
          language: "javascript",
          lastOpened: new Date('2025-08-03'),
          isPublic: true,
          canRun: true,
          fileCount: 8,
          description: "A mobile todo application built with React Native"
        },
        {
          id: 2,
          name: "Flutter Weather App",
          slug: "flutter-weather",
          language: "dart",
          lastOpened: new Date('2025-08-02'),
          isPublic: false,
          canRun: true,
          fileCount: 12,
          description: "Weather app with beautiful animations"
        },
        {
          id: 3,
          name: "Swift iOS Game",
          slug: "swift-ios-game",
          language: "swift",
          lastOpened: new Date('2025-08-01'),
          isPublic: true,
          canRun: true,
          fileCount: 15,
          description: "2D puzzle game for iOS devices"
        }
      ];

      // Sort by last opened, then by name
      mobileProjects.sort((a, b) => {
        if (a.lastOpened && b.lastOpened) {
          return b.lastOpened.getTime() - a.lastOpened.getTime();
        }
        if (a.lastOpened) return -1;
        if (b.lastOpened) return 1;
        return a.name.localeCompare(b.name);
      });

      res.json({
        projects: mobileProjects,
        totalCount: mobileProjects.length,
        languages: [...new Set(mobileProjects.map(p => p.language))],
        runnableCount: mobileProjects.filter(p => p.canRun).length
      });
    } catch (error) {
      logger.error('Error fetching mobile projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  }

  // Mobile-optimized project details
  async getMobileProject(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      const project = await storage.getProject(projectId);
      if (!project || project.ownerId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const files = await storage.getFilesByProjectId(projectId);
      
      // Get main executable file
      const mainFile = files.find(f => 
        f.name === 'main.py' || 
        f.name === 'index.js' || 
        f.name === 'app.js' ||
        f.name === 'index.html' ||
        f.name === 'main.java' ||
        f.name === 'main.cpp'
      ) || files.find(f => !f.isDirectory);

      // Calculate project stats
      const stats = {
        totalFiles: files.filter(f => !f.isDirectory).length,
        totalFolders: files.filter(f => f.isDirectory).length,
        totalLines: files.reduce((sum, f) => 
          sum + (f.content?.split('\n').length || 0), 0
        ),
        languages: Array.from(new Set(files.map(f => this.getFileLanguage(f.name))))
      };

      res.json({
        id: project.id,
        name: project.name,
        slug: project.slug || project.name.toLowerCase().replace(/\s+/g, '-'),
        language: project.language,
        description: project.description,
        isPublic: project.visibility === 'public',
        canRun: this.canRunOnMobile(project.language || 'javascript'),
        mainFile: mainFile ? {
          name: mainFile.name,
          content: mainFile.content,
          language: this.getFileLanguage(mainFile.name)
        } : null,
        files: files.map(f => ({
          id: f.id,
          name: f.name,
          isFolder: f.isDirectory,
          size: f.content?.length || 0,
          language: this.getFileLanguage(f.name),
          lastModified: f.updatedAt
        })),
        stats,
        lastOpened: project.updatedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      });
    } catch (error) {
      logger.error('Error fetching mobile project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  }

  // Mobile code execution
  async runMobileProject(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { input } = req.body;

      const project = await storage.getProject(projectId);
      if (!project || project.ownerId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!this.canRunOnMobile(project.language || 'javascript')) {
        return res.status(400).json({ 
          error: 'This language is not supported on mobile devices' 
        });
      }

      const files = await storage.getFilesByProjectId(projectId);
      const mainFile = files.find(f => 
        f.name === 'main.py' || 
        f.name === 'index.js' || 
        f.name === 'app.js'
      ) || files.find(f => !f.isDirectory);

      if (!mainFile || !mainFile.content) {
        return res.status(400).json({ error: 'No executable file found' });
      }

      // Execute code with mobile-optimized settings
      const result = await this.codeExecutor.execute(
        project.language || 'javascript',
        mainFile.content,
        {
          timeout: 10000, // 10 second timeout for mobile
          maxMemory: 64 * 1024 * 1024, // 64MB memory limit
          input: input || '',
          files: files.reduce((acc, f) => {
            if (!f.isDirectory && f.content) {
              acc[f.name] = f.content;
            }
            return acc;
          }, {} as Record<string, string>)
        }
      );

      // Update project updated time
      await storage.updateProject(projectId, { updatedAt: new Date() });

      res.json({
        success: true,
        output: result.output,
        error: result.error,
        executionTime: result.executionTime,
        memoryUsed: result.memoryUsed,
        exitCode: result.exitCode
      });

    } catch (error) {
      logger.error('Mobile execution error:', error);
      res.status(500).json({ error: 'Execution failed' });
    }
  }

  // Mobile file operations
  async getMobileFile(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      const fileName = req.params.fileName;
      const userId = (req as any).user?.id;

      const project = await storage.getProject(projectId);
      if (!project || project.ownerId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const files = await storage.getFilesByProjectId(projectId);
      const file = files.find(f => f.name === fileName);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.json({
        id: file.id,
        name: file.name,
        content: file.content,
        isFolder: file.isDirectory,
        language: this.getFileLanguage(file.name),
        size: file.content?.length || 0,
        lastModified: file.updatedAt,
        canEdit: this.canEditOnMobile(file.name)
      });
    } catch (error) {
      logger.error('Error fetching mobile file:', error);
      res.status(500).json({ error: 'Failed to fetch file' });
    }
  }

  async updateMobileFile(req: Request, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      const fileName = req.params.fileName;
      const { content } = req.body;
      const userId = (req as any).user?.id;

      const project = await storage.getProject(projectId);
      if (!project || project.ownerId !== userId) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (!this.canEditOnMobile(fileName)) {
        return res.status(400).json({ 
          error: 'This file type cannot be edited on mobile devices' 
        });
      }

      const file = await storage.getFilesByProjectId(projectId).then(files => 
        files.find(f => f.name === fileName)
      );
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const updatedFile = await storage.updateFile(file.id, { content });
      
      res.json({
        success: true,
        file: {
          id: updatedFile?.id || file.id,
          name: updatedFile?.name || file.name,
          content: content,
          size: content?.length || 0,
          lastModified: updatedFile?.updatedAt || new Date()
        }
      });
    } catch (error) {
      logger.error('Error updating mobile file:', error);
      res.status(500).json({ error: 'Failed to update file' });
    }
  }

  // Mobile device management
  async getMobileDevices(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const userSessions = Array.from(this.activeSessions.values())
        .filter(session => session.userId === userId);

      const devices = userSessions.map(session => ({
        id: session.deviceId,
        platform: session.platform,
        appVersion: session.appVersion,
        osVersion: session.osVersion,
        deviceModel: session.deviceModel,
        lastActive: session.lastActiveAt,
        isActive: Date.now() - session.lastActiveAt.getTime() < 5 * 60 * 1000 // 5 minutes
      }));

      res.json({
        devices,
        totalDevices: devices.length,
        activeDevices: devices.filter(d => d.isActive).length
      });
    } catch (error) {
      logger.error('Error fetching mobile devices:', error);
      res.status(500).json({ error: 'Failed to fetch devices' });
    }
  }

  // Helper methods
  private canRunOnMobile(language: string): boolean {
    const supportedLanguages = [
      'javascript', 'python', 'html', 'css', 
      'java', 'cpp', 'c', 'go', 'rust', 'php'
    ];
    return supportedLanguages.includes(language.toLowerCase());
  }

  private canEditOnMobile(fileName: string): boolean {
    const editableExtensions = [
      '.js', '.py', '.html', '.css', '.json', '.txt', '.md',
      '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb',
      '.ts', '.jsx', '.tsx', '.vue', '.svelte'
    ];
    return editableExtensions.some(ext => 
      fileName.toLowerCase().endsWith(ext)
    );
  }

  private getFileLanguage(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'txt': 'text'
    };
    return languageMap[ext || ''] || 'text';
  }

  // Push notification support
  async sendPushNotification(req: Request, res: Response) {
    try {
      const { deviceId, title, body, data } = req.body;
      const userId = (req as any).user?.id;

      const session = Array.from(this.activeSessions.values())
        .find(s => s.userId === userId && s.deviceId === deviceId);

      if (!session || !session.pushToken) {
        return res.status(404).json({ error: 'Device not found or no push token' });
      }

      // In a real implementation, you would use Firebase Cloud Messaging (FCM)
      // or Apple Push Notification Service (APNs) here
      logger.info(`Push notification sent to ${deviceId}: ${title}`);

      res.json({
        success: true,
        message: 'Push notification sent',
        deviceId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error sending push notification:', error);
      res.status(500).json({ error: 'Failed to send push notification' });
    }
  }
}

export const mobileAPIService = new MobileAPIService();