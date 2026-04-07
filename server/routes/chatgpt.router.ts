/**
 * ChatGPT Router for Admin Users
 * Provides API endpoints for ChatGPT integration
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';
import { IStorage } from '../storage';
import { ensureAdmin } from '../middleware/admin-auth';
import { ChatGPTService } from '../services/chatgpt-service';
import { ensureAuthenticated } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

// Platform root (E-Code codebase base directory)
const PLATFORM_ROOT = process.cwd();

// Allowed top-level directories for security
const ALLOWED_TOP_DIRS = new Set(['server', 'client', 'shared', 'scripts', 'runner']);
const ALLOWED_ROOT_FILES = new Set(['package.json', 'tsconfig.json', 'vite.config.ts', 'drizzle.config.ts', 'replit.md', '.replit', 'README.md']);

function isPathAllowed(filePath: string): boolean {
  const normalized = path.normalize(filePath).replace(/\\/g, '/');
  if (normalized.includes('..')) return false;
  const parts = normalized.split('/');
  if (parts.length === 1) return ALLOWED_ROOT_FILES.has(parts[0]);
  return ALLOWED_TOP_DIRS.has(parts[0]);
}

const EXCLUDED_PATTERNS = ['.local', 'node_modules', '.git', 'dist', '.checkpoints', 'backups', 'logs', 'previews', '__pycache__', '.env'];

async function buildFileTree(dirPath: string, relativePath: string = '', maxDepth = 4, depth = 0): Promise<any[]> {
  if (depth >= maxDepth) return [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result: any[] = [];

  for (const entry of entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  })) {
    if (EXCLUDED_PATTERNS.some(p => entry.name.startsWith(p) || entry.name === p)) continue;
    const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      const children = await buildFileTree(path.join(dirPath, entry.name), entryRelPath, maxDepth, depth + 1);
      result.push({ name: entry.name, path: entryRelPath, isDirectory: true, children });
    } else {
      result.push({ name: entry.name, path: entryRelPath, isDirectory: false });
    }
  }
  return result;
}

const logger = createLogger('chatgpt-router');

// Validation schemas
const createSessionSchema = z.object({
  projectId: z.number().int().positive().optional(),
  model: z.string().optional(),
});

const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(100000, 'Message too long'),
  includeProjectContext: z.boolean().optional()
});

const generateCodeSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  request: z.string().min(1, 'Request is required').max(50000, 'Request too long'),
  language: z.string().max(50).optional()
});

export class ChatGPTRouter {
  private router: Router;
  private chatgptService: ChatGPTService;

  constructor(private storage: IStorage) {
    this.router = Router();
    this.chatgptService = new ChatGPTService();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // All routes require authentication and admin access
    this.router.use('/admin/chatgpt', ensureAuthenticated, ensureAdmin);

    // Check if user is admin
    this.router.get('/admin/check', ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const user = await this.storage.getUser(String(req.user!.id));
        res.json({ isAdmin: user?.role === 'admin' });
      } catch (error) {
        res.status(500).json({ message: 'Failed to check admin status' });
      }
    });

    // List available AI models
    this.router.get('/admin/chatgpt/models', async (req: Request, res: Response) => {
      try {
        res.json(this.chatgptService.getModels());
      } catch (error) {
        res.status(500).json({ message: 'Failed to retrieve models' });
      }
    });

    // Direct streaming chat (stateless - no session required)
    this.router.post('/admin/chatgpt/stream', async (req: Request, res: Response) => {
      let streamEnded = false;
      let clientDisconnected = false;

      req.on('close', () => { clientDisconnected = true; });

      try {
        const { model = 'gpt-4.1', messages } = req.body;
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ message: 'messages array is required' });
        }

        if (!validateAndSetSSEHeaders(res, req)) return;
        res.write('data: {"type":"connected"}\n\n');

        try {
          const stream = this.chatgptService.streamDirect(model, messages);
          for await (const chunk of stream) {
            if (clientDisconnected) break;
            res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
          }
          if (!clientDisconnected) {
            res.write('data: {"type":"done"}\n\n');
          }
        } catch (streamError: any) {
          logger.error('[ChatGPT] Direct stream error:', streamError);
          if (!clientDisconnected && !streamEnded) {
            try {
              res.write(`data: ${JSON.stringify({ type: 'error', message: streamError.message || 'Stream error' })}\n\n`);
            } catch (_) {}
          }
        } finally {
          if (!streamEnded) { streamEnded = true; res.end(); }
        }
      } catch (error: any) {
        logger.error('[ChatGPT] Failed to setup direct stream:', error);
        if (!streamEnded) { streamEnded = true; res.status(500).json({ message: error.message || 'Failed to setup streaming' }); }
      }
    });

    // Create a new chat session
    this.router.post('/admin/chatgpt/sessions', async (req: Request, res: Response) => {
      try {
        const validation = createSessionSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: 'Invalid request data',
            errors: validation.error.errors
          });
        }
        
        const { projectId, model } = validation.data;
        const session = await this.chatgptService.createSession(
          String(req.user!.id),
          projectId ? String(projectId) : undefined,
          model
        );
        res.json(session);
      } catch (error: any) {
        logger.error('Failed to create session:', { error: error.message });
        res.status(500).json({ message: 'Failed to create chat session' });
      }
    });

    // Get all sessions for the current user
    this.router.get('/admin/chatgpt/sessions', async (req: Request, res: Response) => {
      try {
        const sessions = await this.chatgptService.getUserSessions(String(req.user!.id));
        res.json(sessions);
      } catch (error) {
        console.error('Failed to get sessions:', error);
        res.status(500).json({ message: 'Failed to retrieve sessions' });
      }
    });

    // Get a specific session
    this.router.get('/admin/chatgpt/sessions/:sessionId', async (req: Request, res: Response) => {
      try {
        const session = await this.chatgptService.getSession(
          req.params.sessionId,
          String(req.user!.id)
        );
        
        if (!session) {
          return res.status(404).json({ message: 'Session not found' });
        }
        
        res.json(session);
      } catch (error) {
        console.error('Failed to get session:', error);
        res.status(500).json({ message: 'Failed to retrieve session' });
      }
    });

    // Send a message to ChatGPT
    this.router.post('/admin/chatgpt/sessions/:sessionId/messages', async (req: Request, res: Response) => {
      try {
        // Validate request body
        const validation = sendMessageSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: 'Invalid request data',
            errors: validation.error.errors
          });
        }
        
        const { message, includeProjectContext } = validation.data;

        const response = await this.chatgptService.sendMessage(
          req.params.sessionId,
          String(req.user!.id),
          message,
          includeProjectContext
        );
        
        res.json(response);
      } catch (error: any) {
        logger.error('Failed to send message:', { error: error.message });
        res.status(500).json({ message: error.message || 'Failed to send message' });
      }
    });

    // Generate code
    this.router.post('/admin/chatgpt/generate-code', async (req: Request, res: Response) => {
      try {
        // Validate request body
        const validation = generateCodeSchema.safeParse(req.body);
        if (!validation.success) {
          return res.status(400).json({
            message: 'Invalid request data',
            errors: validation.error.errors
          });
        }
        
        const { sessionId, request, language } = validation.data;

        const result = await this.chatgptService.generateCode(
          sessionId,
          String(req.user!.id),
          request,
          language
        );
        
        res.json(result);
      } catch (error: any) {
        logger.error('Failed to generate code:', { error: error.message });
        res.status(500).json({ message: error.message || 'Failed to generate code' });
      }
    });

    // Clear session messages
    this.router.delete('/admin/chatgpt/sessions/:sessionId/messages', async (req: Request, res: Response) => {
      try {
        await this.chatgptService.clearSession(req.params.sessionId, String(req.user!.id));
        res.json({ message: 'Session cleared' });
      } catch (error) {
        console.error('Failed to clear session:', error);
        res.status(500).json({ message: 'Failed to clear session' });
      }
    });

    // Delete a session
    this.router.delete('/admin/chatgpt/sessions/:sessionId', async (req: Request, res: Response) => {
      try {
        await this.chatgptService.deleteSession(req.params.sessionId, String(req.user!.id));
        res.json({ message: 'Session deleted' });
      } catch (error) {
        console.error('Failed to delete session:', error);
        res.status(500).json({ message: 'Failed to delete session' });
      }
    });

    // Get projects for context selection
    this.router.get('/admin/chatgpt/projects', async (req: Request, res: Response) => {
      try {
        const projects = await this.storage.getProjectsByUserId(String(req.user!.id));
        res.json(projects);
      } catch (error) {
        console.error('Failed to get projects:', error);
        res.status(500).json({ message: 'Failed to retrieve projects' });
      }
    });

    // Send a streaming message to ChatGPT
    this.router.post('/admin/chatgpt/sessions/:sessionId/stream', async (req: Request, res: Response) => {
      let streamEnded = false;
      let clientDisconnected = false;
      
      // Handle client disconnect to prevent memory leaks
      req.on('close', () => {
        clientDisconnected = true;
        logger.info('[ChatGPT] Client disconnected during streaming');
      });
      
      try {
        const { message, includeProjectContext } = req.body;
        
        if (!message) {
          return res.status(400).json({ message: 'Message is required' });
        }

        // Set up Server-Sent Events with CORS security - reject invalid origins with 403
        if (!validateAndSetSSEHeaders(res, req)) {
          return;
        }
        
        // Send initial connection message
        res.write('data: {"type":"connected"}\n\n');

        try {
          const stream = this.chatgptService.sendStreamingMessage(
            req.params.sessionId,
            String(req.user!.id),
            message,
            includeProjectContext
          );

          // Stream the response with client disconnect check
          for await (const chunk of stream) {
            if (clientDisconnected) {
              logger.info('[ChatGPT] Stopping stream due to client disconnect');
              break;
            }
            res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
          }

          // Send completion message only if client is still connected
          if (!clientDisconnected) {
            res.write('data: {"type":"done"}\n\n');
          }
        } catch (streamError: any) {
          logger.error('[ChatGPT] Streaming error:', streamError);
          if (!clientDisconnected && !streamEnded) {
            try {
              res.write(`data: ${JSON.stringify({ type: 'error', message: streamError.message || 'Stream error' })}\n\n`);
            } catch (writeError) {
              logger.error('[ChatGPT] Failed to write error to stream:', writeError);
            }
          }
        } finally {
          // Always end the response to prevent memory leaks
          if (!streamEnded) {
            streamEnded = true;
            res.end();
          }
        }
      } catch (error: any) {
        logger.error('[ChatGPT] Failed to setup streaming:', error);
        if (!streamEnded) {
          streamEnded = true;
          res.status(500).json({ message: error.message || 'Failed to setup streaming' });
        }
      }
    });

    // ===== ADMIN PROJECT MANAGEMENT ENDPOINTS =====
    
    // Get ALL projects (admin can see all users' projects)
    this.router.get('/admin/chatgpt/all-projects', async (req: Request, res: Response) => {
      try {
        const projects = await this.storage.getAllProjects();
        res.json(projects);
      } catch (error) {
        logger.error('Failed to get all projects:', error);
        res.status(500).json({ message: 'Failed to retrieve projects' });
      }
    });

    // Get project details with owner info
    this.router.get('/admin/chatgpt/projects/:projectId', async (req: Request, res: Response) => {
      try {
        const project = await this.storage.getProject(req.params.projectId);
        if (!project) {
          return res.status(404).json({ message: 'Project not found' });
        }
        const owner = await this.storage.getUser(String(project.ownerId));
        res.json({ 
          ...project, 
          ownerEmail: owner?.email,
          ownerUsername: owner?.username 
        });
      } catch (error) {
        logger.error('Failed to get project:', error);
        res.status(500).json({ message: 'Failed to retrieve project' });
      }
    });

    // List files in a project
    this.router.get('/admin/chatgpt/projects/:projectId/files', async (req: Request, res: Response) => {
      try {
        const files = await this.storage.getFilesByProjectId(req.params.projectId);
        res.json(files);
      } catch (error) {
        logger.error('Failed to get project files:', error);
        res.status(500).json({ message: 'Failed to retrieve files' });
      }
    });

    // Read a specific file
    this.router.get('/admin/chatgpt/projects/:projectId/files/:fileId', async (req: Request, res: Response) => {
      try {
        const file = await this.storage.getFile(parseInt(req.params.fileId));
        if (!file || String(file.projectId) !== req.params.projectId) {
          return res.status(404).json({ message: 'File not found' });
        }
        res.json(file);
      } catch (error) {
        logger.error('Failed to get file:', error);
        res.status(500).json({ message: 'Failed to retrieve file' });
      }
    });

    // Update a file (admin can modify any project's files)
    this.router.put('/admin/chatgpt/projects/:projectId/files/:fileId', async (req: Request, res: Response) => {
      try {
        const { content } = req.body;
        if (content === undefined) {
          return res.status(400).json({ message: 'Content is required' });
        }
        
        const file = await this.storage.getFile(parseInt(req.params.fileId));
        if (!file || String(file.projectId) !== req.params.projectId) {
          return res.status(404).json({ message: 'File not found' });
        }
        
        const updatedFile = await this.storage.updateFile(parseInt(req.params.fileId), { content });
        
        logger.info(`[Admin] File ${file.path} updated by admin ${req.user!.id} in project ${req.params.projectId}`);
        res.json(updatedFile);
      } catch (error) {
        logger.error('Failed to update file:', error);
        res.status(500).json({ message: 'Failed to update file' });
      }
    });

    // Get all active agent sessions across all users
    this.router.get('/admin/chatgpt/agent-sessions', async (req: Request, res: Response) => {
      try {
        const sessions = await this.storage.getActiveAgentSessions?.() || [];
        res.json(sessions);
      } catch (error) {
        logger.error('Failed to get agent sessions:', error);
        res.status(500).json({ message: 'Failed to retrieve agent sessions' });
      }
    });

    // Terminate an agent session (admin intervention)
    this.router.post('/admin/chatgpt/agent-sessions/:sessionId/terminate', async (req: Request, res: Response) => {
      try {
        const { reason } = req.body;
        logger.warn(`[Admin] Session ${req.params.sessionId} terminated by admin ${req.user!.id}. Reason: ${reason || 'No reason provided'}`);
        
        await this.storage.terminateAgentSession?.(req.params.sessionId, {
          terminatedBy: req.user!.id,
          reason: reason || 'Admin intervention'
        });
        
        res.json({ message: 'Session terminated' });
      } catch (error) {
        logger.error('Failed to terminate session:', error);
        res.status(500).json({ message: 'Failed to terminate session' });
      }
    });

    // ===== E-CODE PLATFORM MANAGEMENT =====
    // Browse/edit the actual E-Code platform source code (real filesystem)

    // Get file tree of the platform codebase
    this.router.get('/admin/chatgpt/platform/tree', async (req: Request, res: Response) => {
      try {
        const dir = (req.query.dir as string) || '';
        let basePath: string;
        
        if (!dir) {
          // Return top-level structure
          const topLevel = await buildFileTree(PLATFORM_ROOT, '', 2, 0);
          const filtered = topLevel.filter(e =>
            (e.isDirectory && ALLOWED_TOP_DIRS.has(e.name)) || (!e.isDirectory && ALLOWED_ROOT_FILES.has(e.name))
          );
          return res.json(filtered);
        }

        if (!isPathAllowed(dir)) {
          return res.status(403).json({ message: 'Access denied to this path' });
        }

        basePath = path.join(PLATFORM_ROOT, dir);
        const stat = await fs.stat(basePath);
        if (!stat.isDirectory()) {
          return res.status(400).json({ message: 'Not a directory' });
        }

        const tree = await buildFileTree(basePath, dir, 6, 0);
        res.json(tree);
      } catch (error: any) {
        logger.error('Failed to get platform file tree:', error);
        if (error.code === 'ENOENT') return res.status(404).json({ message: 'Directory not found' });
        res.status(500).json({ message: 'Failed to read directory' });
      }
    });

    // Read a platform file
    this.router.get('/admin/chatgpt/platform/file', async (req: Request, res: Response) => {
      try {
        const filePath = req.query.path as string;
        if (!filePath) return res.status(400).json({ message: 'path query param required' });
        if (!isPathAllowed(filePath)) return res.status(403).json({ message: 'Access denied to this path' });

        const absolutePath = path.join(PLATFORM_ROOT, filePath);
        const stat = await fs.stat(absolutePath);
        if (stat.isDirectory()) return res.status(400).json({ message: 'Path is a directory' });

        // Size limit: 2MB
        if (stat.size > 2 * 1024 * 1024) {
          return res.status(400).json({ message: 'File too large (max 2MB)' });
        }

        const content = await fs.readFile(absolutePath, 'utf-8');
        const ext = path.extname(filePath).slice(1);

        res.json({
          path: filePath,
          name: path.basename(filePath),
          content,
          size: stat.size,
          extension: ext,
          modifiedAt: stat.mtime,
        });
      } catch (error: any) {
        logger.error('Failed to read platform file:', error);
        if (error.code === 'ENOENT') return res.status(404).json({ message: 'File not found' });
        if (error.code === 'EISDIR') return res.status(400).json({ message: 'Path is a directory' });
        res.status(500).json({ message: 'Failed to read file' });
      }
    });

    // Write a platform file
    this.router.put('/admin/chatgpt/platform/file', async (req: Request, res: Response) => {
      try {
        const { path: filePath, content } = req.body;
        if (!filePath || content === undefined) {
          return res.status(400).json({ message: 'path and content are required' });
        }
        if (!isPathAllowed(filePath)) return res.status(403).json({ message: 'Access denied to this path' });

        const absolutePath = path.join(PLATFORM_ROOT, filePath);

        // Ensure parent directory exists
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content, 'utf-8');

        logger.info(`[Admin] Platform file written: ${filePath} by admin ${req.user!.id}`);
        res.json({ success: true, path: filePath, size: Buffer.byteLength(content, 'utf-8') });
      } catch (error: any) {
        logger.error('Failed to write platform file:', error);
        res.status(500).json({ message: 'Failed to write file' });
      }
    });

    // Get platform stats (package.json info, file counts, etc.)
    this.router.get('/admin/chatgpt/platform/stats', async (req: Request, res: Response) => {
      try {
        const pkgJson = JSON.parse(await fs.readFile(path.join(PLATFORM_ROOT, 'package.json'), 'utf-8'));
        
        // Count files per directory
        const countFiles = async (dir: string): Promise<number> => {
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            let count = 0;
            for (const entry of entries) {
              if (EXCLUDED_PATTERNS.some(p => entry.name.startsWith(p))) continue;
              if (entry.isDirectory()) {
                count += await countFiles(path.join(dir, entry.name));
              } else {
                count++;
              }
            }
            return count;
          } catch { return 0; }
        };

        const [serverCount, clientCount, sharedCount] = await Promise.all([
          countFiles(path.join(PLATFORM_ROOT, 'server')),
          countFiles(path.join(PLATFORM_ROOT, 'client')),
          countFiles(path.join(PLATFORM_ROOT, 'shared')),
        ]);

        res.json({
          name: pkgJson.name || 'E-Code',
          version: pkgJson.version || '1.0.0',
          description: pkgJson.description || 'E-Code Platform',
          dependencies: Object.keys(pkgJson.dependencies || {}).length,
          devDependencies: Object.keys(pkgJson.devDependencies || {}).length,
          fileCounts: { server: serverCount, client: clientCount, shared: sharedCount, total: serverCount + clientCount + sharedCount },
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        });
      } catch (error) {
        logger.error('Failed to get platform stats:', error);
        res.status(500).json({ message: 'Failed to get platform stats' });
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}