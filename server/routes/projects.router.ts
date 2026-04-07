// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { insertProjectSchema } from "@shared/schema";
import { type IStorage } from "../storage";
import { ensureAuthenticated as sharedEnsureAuth } from "../middleware/auth";
import { csrfProtection } from "../middleware/csrf";
import type { User, Project } from "@shared/schema";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getProjectAIAgent } from '../services/project-ai-agent.service';
import { aiApprovalQueue } from '../services/ai-approval-queue.service';
import { aiSecurityService } from '../services/ai-security.service';
import { createRateLimitMiddleware } from '../middleware/rate-limiter';
import { memoryBankService } from '../services/memory-bank.service';
import { createLogger } from '../utils/logger';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

const projectLogger = createLogger('projects-router');

function sanitizeOwner(user: any): object | null {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    profileImageUrl: user.profileImageUrl || user.avatarUrl,
    bio: user.bio,
    reputation: user.reputation,
    role: user.role,
  };
}

export class ProjectsRouter {
  private router: Router;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.initializeRoutes();
  }

  // Use the shared ensureAuthenticated middleware for consistent authentication
  private ensureAuthenticated = sharedEnsureAuth;

  // Helper to check if user has a valid session (Passport session only - no bypasses)
  private hasValidSession(req: Request): boolean {
    return typeof req.isAuthenticated === 'function' && req.isAuthenticated() && !!req.user;
  }

  private ensureProjectAccess = async (req: Request, res: Response, next: NextFunction) => {
    // ✅ FIX (Nov 24, 2025): Allow anonymous access with bootstrap token for autonomous workspace creation
    const hasSession = this.hasValidSession(req);
    const bootstrapToken = req.query.bootstrap || req.headers['x-bootstrap-token'];
    
    // Require either session OR bootstrap token
    if (!hasSession && !bootstrapToken) {
      return res.status(401).json({ 
        message: "Unauthorized - authentication or bootstrap token required",
        code: "AUTH_REQUIRED" 
      });
    }
    
    // For authenticated users, use their user ID
    // For anonymous users with bootstrap token, skip ownership check (token itself provides auth)
    const userId = hasSession ? (req.user as User).id : null;
    const projectId = (req.params.projectId || req.params.id || '').toString();

    if (!projectId) {
      return res.status(400).json({
        message: "Invalid project ID",
        code: "INVALID_PROJECT_ID"
      });
    }

    // Silently ignore known non-project identifiers (prevents log spam)
    const nonProjectIdentifiers = ['recent', 'new', 'templates', 'search'];
    if (nonProjectIdentifiers.includes(projectId.toLowerCase())) {
      return res.status(404).json({
        message: "Project not found",
        code: "PROJECT_NOT_FOUND",
        projectId
      });
    }

    // Get the project - try by UUID first, then by slug
    let project = await this.storage.getProject(projectId);
    
    if (!project) {
      // If not found by UUID, try by slug (for frontend routing compatibility)
      const projectBySlug = await this.storage.getProjectBySlug(projectId);
      project = projectBySlug || undefined;
    }
    
    if (!project) {
      return res.status(404).json({
        message: "Project not found",
        code: "PROJECT_NOT_FOUND",
        projectId
      });
    }
    
    req.params.projectId = String(project.id);
    req.params.id = String(project.id);
    
    // ✅ FIX (Nov 24, 2025): Validate bootstrap token and enforce project-specific access
    if (bootstrapToken) {
      try {
        // Decode and verify JWT token - SECURITY: Use centralized secrets manager
        const { getJwtSecret } = await import('../utils/secrets-manager');
        
        const decoded = jwt.verify(bootstrapToken as string, getJwtSecret()) as {
          projectId: string;
          userId: number;
          conversationId?: string;
          sessionId?: string;
          timestamp?: number;
        };
        
        // Enforce token is project-specific: payload.projectId must match requested project
        // Normalize both to strings for comparison (token may have string ID, project has number)
        const tokenProjectId = String(decoded.projectId);
        const actualProjectId = String(project.id);
        
        if (tokenProjectId !== actualProjectId) {
          projectLogger.warn('[ensureProjectAccess] Bootstrap token project mismatch:', {
            tokenProjectId,
            actualProjectId,
            tokenProjectIdType: typeof decoded.projectId,
            actualProjectIdType: typeof project.id
          });
          return res.status(403).json({
            message: "Bootstrap token invalid for this project",
            code: "BOOTSTRAP_TOKEN_MISMATCH"
          });
        }
        
        return next();
        
      } catch (error) {
        // Invalid or expired token
        projectLogger.error('[ensureProjectAccess] Bootstrap token validation failed:', error);
        return res.status(401).json({
          message: "Invalid or expired bootstrap token",
          code: "BOOTSTRAP_TOKEN_INVALID",
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // For authenticated users, check ownership/collaboration/visibility
    if (!userId) {
      // Should not reach here (would have failed earlier auth check)
      return res.status(401).json({
        message: "Unauthorized",
        code: "AUTH_REQUIRED"
      });
    }
    
    // Check if user is owner
    if (project.ownerId === userId) {
      return next();
    }
    
    // Check if user is collaborator
    const collaborators = await this.storage.getProjectCollaborators(projectId);
    const isCollaborator = collaborators.some(c => c.userId === userId);
    
    if (isCollaborator) {
      return next();
    }
    
    // Check if project is public
    if (project.visibility === 'public') {
      return next();
    }
    return res.status(403).json({
      message: "Access denied",
      code: "ACCESS_DENIED",
      projectId,
      userId
    });
  };

  private generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    return `${baseSlug}-${randomSuffix}`;
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  private generateCodeSuggestion(elementPath: string, styles?: Record<string, string>, text?: string): string {
    const parts: string[] = [];
    
    if (styles && Object.keys(styles).length > 0) {
      const cssProperties = Object.entries(styles)
        .map(([key, value]) => {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `  ${cssKey}: ${value};`;
        })
        .join('\n');
      parts.push(`/* Suggested CSS for ${elementPath} */\n${cssProperties}`);
    }
    
    if (text) {
      parts.push(`/* Text content: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}" */`);
    }
    
    if (parts.length === 0) {
      return `/* No changes detected for ${elementPath} */`;
    }
    
    return parts.join('\n\n');
  }

  private initializeRoutes() {
    // Get user's projects with pagination
    this.router.get("/", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const userId = (req.user as User).id;
        
        // Parse pagination params with defaults and max limit
        const requestedLimit = parseInt(req.query.limit as string) || 50;
        const limit = Math.min(Math.max(1, requestedLimit), 100); // Clamp between 1 and 100
        const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
        const search = req.query.search as string | undefined;
        const language = req.query.language as string | undefined;
        const visibility = req.query.visibility as string | undefined;
        
        let projects, total;
        if (search || language || visibility) {
          const allProjects = await this.storage.getProjectsByUserId(String(userId));
          const filtered = allProjects.filter(p => {
            const matchesSearch = !search || (
              p.name.toLowerCase().includes(search.toLowerCase()) || 
              (p.description?.toLowerCase().includes(search.toLowerCase()))
            );
            const matchesLanguage = !language || p.language === language;
            const matchesVisibility = !visibility || p.visibility === visibility;
            return matchesSearch && matchesLanguage && matchesVisibility;
          });
          total = filtered.length;
          projects = filtered.slice(offset, offset + limit);
        } else {
          const result = await this.storage.getProjectsByUserIdPaginated(String(userId), limit, offset);
          projects = result.projects;
          total = result.total;
        }
        
        const enrichedProjects = await Promise.all(projects.map(async (project) => {
          const owner = await this.storage.getUser(String(project.ownerId));
          return { ...project, owner: sanitizeOwner(owner) };
        }));
        
        res.json({
          projects: enrichedProjects,
          pagination: {
            total,
            limit,
            offset,
            hasMore: offset + projects.length < total
          }
        });
      } catch (error) {
        projectLogger.error('Error fetching projects:', error);
        res.status(500).json({ 
          message: "Failed to fetch projects",
          code: "FETCH_ERROR"
        });
      }
    });

    // Get public projects for explore page (no auth required)
    this.router.get("/explore", async (req: Request, res: Response) => {
      try {
        const category = req.query.category as string | undefined;
        const sort = req.query.sort as string | undefined;
        const search = req.query.search as string | undefined;
        const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 50);
        const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
        
        // Get public projects only
        const allProjects = await this.storage.getAllProjects();
        let publicProjects = allProjects.filter(p => p.visibility === 'public');
        
        // Apply search filter
        if (search) {
          const searchLower = search.toLowerCase();
          publicProjects = publicProjects.filter(p => 
            p.name.toLowerCase().includes(searchLower) ||
            (p.description?.toLowerCase().includes(searchLower)) ||
            (p.language?.toLowerCase().includes(searchLower))
          );
        }
        
        // Apply category filter (using language as proxy for category)
        if (category && category !== 'all') {
          const categoryMapping: Record<string, string[]> = {
            'web': ['javascript', 'typescript', 'html', 'css'],
            'games': ['python', 'javascript', 'cpp'],
            'ai': ['python', 'typescript'],
            'data': ['python', 'sql'],
          };
          const languages = categoryMapping[category] || [];
          if (languages.length > 0) {
            publicProjects = publicProjects.filter(p => 
              p.language && languages.includes(p.language.toLowerCase())
            );
          }
        }
        
        // Apply sorting
        publicProjects.sort((a, b) => {
          switch (sort) {
            case 'popular':
              return (b.likes || 0) - (a.likes || 0);
            case 'recent':
              return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            case 'trending':
            default:
              // Trending: combination of recency and likes
              const aScore = (a.likes || 0) + (new Date(a.updatedAt).getTime() / 1000000000);
              const bScore = (b.likes || 0) + (new Date(b.updatedAt).getTime() / 1000000000);
              return bScore - aScore;
          }
        });
        
        // Apply pagination
        const paginatedProjects = publicProjects.slice(offset, offset + limit);
        
        // Enrich with owner info and format for explore page
        const enrichedProjects = await Promise.all(paginatedProjects.map(async (project) => {
          const owner = await this.storage.getUser(String(project.ownerId));
          return {
            id: project.id,
            name: project.name,
            slug: project.slug,
            description: project.description,
            language: project.language || 'JavaScript',
            stars: project.likes || 0,
            forks: project.forks || 0,
            runs: project.runs || 0,
            category: project.language?.toLowerCase() === 'python' ? 'data' : 'web',
            tags: (project.tags as string[]) || [],
            author: owner?.username || 'anonymous',
            avatar: owner?.profileImageUrl || null,
            lastUpdated: new Date(project.updatedAt).toLocaleDateString(),
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          };
        }));
        
        res.json(enrichedProjects);
      } catch (error) {
        projectLogger.error('Error fetching explore projects:', error);
        res.status(500).json({ 
          message: "Failed to fetch public projects",
          code: "FETCH_ERROR"
        });
      }
    });

    // Create a new project
    this.router.post("/", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const userId = (req.user as User).id;
        
        // Add ownerId before validation (required by schema)
        const requestWithOwner = {
          ...req.body,
          ownerId: userId,
        };
        
        const validatedData = insertProjectSchema.parse(requestWithOwner);
        
        // Generate slug if not provided (use name field from schema)
        const slug = validatedData.slug || this.generateSlug(validatedData.name);
        
        const existingProject = await this.storage.getProjectBySlug(slug, String(userId));
        if (existingProject) {
          return res.status(400).json({
            message: "Project with this slug already exists",
            code: "SLUG_EXISTS"
          });
        }
        
        const project = await this.storage.createProject({
          ...validatedData,
          slug,
          visibility: validatedData.visibility || 'private',
          tenantId: validatedData.tenantId ?? userId,
        });

        // Auto-create starter files so the IDE has something to show immediately
        try {
          const lang = validatedData.language || 'javascript';
          const projectName = validatedData.name || 'My App';

          // Multi-file starters for web-capable languages
          type StarterFile = { name: string; content: string };
          const multiFileStarters: Record<string, StarterFile[]> = {
            javascript: [
              { name: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${projectName}</title>\n  <style>\n    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f1f5f9; }\n    .container { text-align: center; }\n    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }\n    p { color: #94a3b8; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <h1>Hello from ${projectName}!</h1>\n    <p>Edit <code>script.js</code> to get started</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>\n` },
              { name: 'script.js', content: `// ${projectName}\nconsole.log('Hello, World!');\n` },
            ],
            typescript: [
              { name: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${projectName}</title>\n  <style>\n    body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f1f5f9; }\n    .container { text-align: center; }\n    h1 { font-size: 2.5rem; }\n    p { color: #94a3b8; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <h1>Hello from ${projectName}!</h1>\n    <p>Edit <code>index.ts</code> to get started</p>\n  </div>\n</body>\n</html>\n` },
              { name: 'index.ts', content: `// ${projectName}\nconsole.log('Hello, World!');\n` },
            ],
            html: [
              { name: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${projectName}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="container">\n    <h1>Hello, World!</h1>\n    <p>Edit this page to get started.</p>\n  </div>\n  <script src="script.js"></script>\n</body>\n</html>\n` },
              { name: 'style.css', content: `* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #f1f5f9; }\n.container { text-align: center; padding: 2rem; }\nh1 { font-size: 2.5rem; margin-bottom: 0.5rem; }\np { color: #94a3b8; }\n` },
              { name: 'script.js', content: `console.log('Page loaded!');\n` },
            ],
          };

          // Single-file starters for non-web languages
          const singleFileStarters: Record<string, StarterFile> = {
            python:  { name: 'main.py',    content: 'print("Hello, World!")\n' },
            bash:    { name: 'script.sh',  content: '#!/usr/bin/env bash\necho "Hello, World!"\n' },
            c:       { name: 'main.c',     content: '#include <stdio.h>\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}\n' },
            cpp:     { name: 'main.cpp',   content: '#include <iostream>\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}\n' },
            rust:    { name: 'main.rs',    content: 'fn main() {\n  println!("Hello, World!");\n}\n' },
            go:      { name: 'main.go',    content: 'package main\nimport "fmt"\nfunc main() {\n  fmt.Println("Hello, World!")\n}\n' },
            java:    { name: 'Main.java',  content: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}\n' },
            ruby:    { name: 'main.rb',    content: 'puts "Hello, World!"\n' },
            php:     { name: 'index.php',  content: '<?php\necho "Hello, World!";\n?>\n' },
            swift:   { name: 'main.swift', content: 'print("Hello, World!")\n' },
            kotlin:  { name: 'main.kt',   content: 'fun main() {\n  println("Hello, World!")\n}\n' },
            perl:    { name: 'main.pl',    content: '#!/usr/bin/perl\nprint "Hello, World!\\n";\n' },
            deno:    { name: 'index.ts',   content: 'console.log("Hello, World!");\n' },
            lua:     { name: 'main.lua',   content: 'print("Hello, World!")\n' },
            r:       { name: 'main.R',     content: 'cat("Hello, World!\\n")\n' },
            julia:   { name: 'main.jl',    content: 'println("Hello, World!")\n' },
            haskell: { name: 'Main.hs',    content: 'module Main where\nmain :: IO ()\nmain = putStrLn "Hello, World!"\n' },
            scala:   { name: 'Main.scala', content: 'object Main extends App {\n  println("Hello, World!")\n}\n' },
            clojure: { name: 'main.clj',   content: '(println "Hello, World!")\n' },
            elixir:  { name: 'main.exs',   content: 'IO.puts "Hello, World!"\n' },
            ocaml:   { name: 'main.ml',    content: 'let () = print_endline "Hello, World!"\n' },
            dart:    { name: 'main.dart',  content: 'void main() {\n  print("Hello, World!");\n}\n' },
            zig:     { name: 'main.zig',   content: 'const std = @import("std");\npub fn main() void {\n  std.debug.print("Hello, World!\\n", .{});\n}\n' },
            csharp:  { name: 'Program.cs', content: 'using System;\nclass Program {\n  static void Main() {\n    Console.WriteLine("Hello, World!");\n  }\n}\n' },
            fsharp:  { name: 'Program.fs', content: 'printfn "Hello, World!"\n' },
            nix:     { name: 'default.nix', content: '# Nix expression\n{ pkgs ? import <nixpkgs> {} }:\npkgs.mkShell {\n  buildInputs = [ pkgs.hello ];\n}\n' },
          };

          const filesToCreate: StarterFile[] = multiFileStarters[lang] ?? (singleFileStarters[lang] ? [singleFileStarters[lang]] : [{ name: 'main.txt', content: '# Start coding here\n' }]);

          for (const file of filesToCreate) {
            await this.storage.createFile({
              projectId: String(project.id),
              path: file.name,
              content: file.content,
            });
          }
          projectLogger.info(`[Projects] Created ${filesToCreate.length} starter file(s) for project ${project.id} (${lang})`);
        } catch (starterErr: any) {
          projectLogger.warn(`[Projects] Failed to create starter file for project ${project.id}:`, starterErr);
        }

        // Auto-initialize memory bank for new project
        try {
          await memoryBankService.initialize(
            project.id, 
            validatedData.description || validatedData.name
          );
          projectLogger.info(`[Projects] Memory bank initialized for project ${project.id}`);
        } catch (mbError) {
          // Memory bank initialization failure should not block project creation
          projectLogger.warn(`[Projects] Failed to initialize memory bank for project ${project.id}:`, mbError);
        }
        
        // Auto-provision database ASYNCHRONOUSLY like Replit
        // This ensures project creation is fast while database provisions in background
        const databaseInfo: { provisioned: boolean; status: string; message: string; connectionUrl?: string; database?: any } = {
          provisioned: false,
          status: 'provisioning',
          message: 'Database is being provisioned in the background'
        };
        
        // Fire-and-forget: Start provisioning in background without blocking response
        // This prevents API timeout issues when Neon/K8s providers take 45-60s
        import('../services/project-database-provisioning.service').then(async ({ projectDatabaseService }) => {
          try {
            const database = await projectDatabaseService.provisionDatabase(project.id, {
              plan: 'free',
              region: 'us-east-1'
            });
            projectLogger.info(`[Projects] Database auto-provisioned for project ${project.id}: ${database.database}`);
          } catch (dbError: any) {
            // Log error - database can be provisioned later via agent or retry
            projectLogger.warn(`[Projects] Failed to auto-provision database for project ${project.id}:`, dbError);
          }
        }).catch((importErr) => {
          projectLogger.error(`[Projects] Failed to import database provisioning service:`, importErr);
        });
        
        const owner = await this.storage.getUser(String(userId));
        
        res.json({ 
          ...project, 
          owner: sanitizeOwner(owner),
          database: databaseInfo
        });
      } catch (error: any) {
        projectLogger.error('Error creating project:', error);
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            message: "Invalid project data",
            code: "INVALID_INPUT",
            errors: error.errors
          });
        }
        res.status(500).json({ 
          message: "Failed to create project",
          code: "CREATE_ERROR"
        });
      }
    });

    // Get a specific project
    this.router.get("/:projectId", this.ensureProjectAccess, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId;
        const project = await this.storage.getProject(projectId);
        
        if (!project) {
          return res.status(404).json({
            message: "Project not found",
            code: "PROJECT_NOT_FOUND"
          });
        }
        
        const owner = await this.storage.getUser(String(project.ownerId));
        
        res.json({ ...project, owner: sanitizeOwner(owner) });
      } catch (error) {
        projectLogger.error('Error fetching project:', error);
        res.status(500).json({ 
          message: "Failed to fetch project",
          code: "FETCH_ERROR"
        });
      }
    });

    // Update a project
    this.router.put("/:projectId", this.ensureProjectAccess, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId;
        const updates = req.body;
        
        // Don't allow changing owner or id
        delete updates.ownerId;
        delete updates.id;
        
        const project = await this.storage.updateProject(projectId, updates);
        
        if (!project) {
          return res.status(404).json({
            message: "Project not found",
            code: "PROJECT_NOT_FOUND"
          });
        }
        
        res.json(project);
      } catch (error) {
        projectLogger.error('Error updating project:', error);
        res.status(500).json({ 
          message: "Failed to update project",
          code: "UPDATE_ERROR"
        });
      }
    });

    // Delete a project
    this.router.delete("/:projectId", this.ensureProjectAccess, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId;
        const project = await this.storage.getProject(projectId);
        
        if (!project) {
          return res.status(404).json({
            message: "Project not found",
            code: "PROJECT_NOT_FOUND"
          });
        }
        
        // Only owner can delete
        if (project.ownerId !== (req.user as User).id) {
          return res.status(403).json({
            message: "Only project owner can delete",
            code: "NOT_OWNER"
          });
        }
        
        await this.storage.deleteProject(projectId);
        res.json({ message: "Project deleted successfully" });
      } catch (error) {
        projectLogger.error('Error deleting project:', error);
        res.status(500).json({ 
          message: "Failed to delete project",
          code: "DELETE_ERROR"
        });
      }
    });

    // Get project by slug (for username/slug routes)
    this.router.get("/u/:username/:slug", async (req: Request, res: Response) => {
      try {
        const { username, slug } = req.params;
        
        // Get user by username
        const user = await this.storage.getUserByUsername(username);
        if (!user) {
          projectLogger.error('[Projects] User not found');
          return res.status(404).json({ 
            error: 'User not found',
            code: 'USER_NOT_FOUND',
            username 
          });
        }
        
        const project = await this.storage.getProjectBySlug(slug, String(user.id));
        if (!project) {
          projectLogger.error('[Projects] Project not found');
          return res.status(404).json({ 
            error: 'Project not found',
            code: 'PROJECT_NOT_FOUND',
            slug,
            username 
          });
        }
        
        const wantsWorkspace = req.query.workspace === 'true' || req.query.open === 'true' || req.header('X-Open-Workspace') === 'true';
        if (wantsWorkspace && project?.id) {
          return res.json({
            ...project,
            redirectTo: `/editor/${project.id}`,
            owner: sanitizeOwner(await this.storage.getUser(String(project.ownerId)))
          });
        }
        
        // Check access for private projects (req.user is set by Passport session middleware)
        if (project.visibility === 'private') {
          // Private projects require authentication
          if (!req.user) {
            return res.status(401).json({ 
              error: 'Authentication required for private project',
              code: 'AUTH_REQUIRED' 
            });
          }
          
          if ((req.user as User).id !== project.ownerId) {
            const isCollaborator = await this.storage.isProjectCollaborator(String(project.id), String((req.user as User).id));
            if (!isCollaborator) {
              return res.status(403).json({ 
                error: 'Access denied',
                code: 'ACCESS_DENIED' 
              });
            }
          }
        }
        
        const owner = await this.storage.getUser(String(project.ownerId));
        res.json({
          ...project,
          owner: sanitizeOwner(owner)
        });
      } catch (error) {
        projectLogger.error('[Projects] Error accessing project:', error);
        res.status(500).json({ 
          error: 'Failed to access project',
          code: 'SERVER_ERROR' 
        });
      }
    });

    // AI Chat endpoint - Stream AI-generated code responses
    this.router.post('/:id/ai/chat', this.ensureProjectAccess, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.id;
        const { message, context } = req.body;

        if (!message || typeof message !== 'string') {
          return res.status(400).json({ 
            error: 'Message is required',
            code: 'INVALID_MESSAGE' 
          });
        }

        // Set up Server-Sent Events (SSE) for streaming with CORS security - reject invalid origins with 403
        if (!validateAndSetSSEHeaders(res, req)) {
          return;
        }

        // Get AI agent instance
        const aiAgent = getProjectAIAgent(this.storage);

        // Get user ID for security controls
        const userId = (req.user as any)?.id;
        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized', code: 'NO_USER' });
        }

        // Stream the response with security controls (rate limiting + audit logging)
        try {
          for await (const chunk of aiAgent.processChat(userId, projectId, message, context)) {
            // Check if chunk is already a structured event (JSON object)
            let eventData;
            try {
              const parsed = JSON.parse(chunk);
              // If it's already a structured event with a type, send it directly
              if (parsed.type) {
                eventData = parsed;
              } else {
                // Otherwise wrap as content
                eventData = { content: chunk };
              }
            } catch (err: any) { console.error("[catch]", err?.message || err);
              // Not JSON, wrap as text content
              eventData = { content: chunk };
            }
            
            res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          }

          // Send completion event
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
        } catch (streamError: any) {
          projectLogger.error('[ProjectAI] Streaming error:', streamError);
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            content: streamError.message || 'Streaming failed' 
          })}\n\n`);
          res.end();
        }
      } catch (error: any) {
        projectLogger.error('[ProjectAI] Error in AI chat:', error);
        
        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
          res.status(500).json({ 
            error: error.message || 'Failed to process AI request',
            code: 'AI_ERROR' 
          });
        } else {
          // If streaming already started, send error event
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            content: error.message || 'AI processing failed' 
          })}\n\n`);
          res.end();
        }
      }
    });

    // POST /api/projects/:id/ai/approve/:actionId - Approve and execute AI action
    this.router.post('/:id/ai/approve/:actionId', this.ensureAuthenticated, createRateLimitMiddleware('ai'), async (req: Request, res: Response) => {
      try {
        const projectId = req.params.id;
        const actionId = req.params.actionId;
        const userId = (req.user as any)?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized', code: 'NO_USER' });
        }

        // Get action from approval queue
        const action = await aiApprovalQueue.approve(actionId, userId);

        if (!action) {
          return res.status(404).json({ 
            error: 'Action not found or expired',
            code: 'ACTION_NOT_FOUND' 
          });
        }

        // Execute the action based on type
        if (action.type === 'create_file') {
          try {
            // Validate path again (defense in depth)
            const pathValidation = aiSecurityService.validatePath(action.path);
            if (!pathValidation.valid) {
              // Log security violation
              await aiSecurityService.logAction(userId, projectId, action, {
                success: false,
                error: `Path validation failed: ${pathValidation.reason}`
              });

              return res.status(403).json({ 
                error: pathValidation.reason,
                code: 'SECURITY_BLOCKED' 
              });
            }

            // Create the file using storage
            const file = await this.storage.createFile({
              projectId,
              path: pathValidation.sanitized || action.path,
              content: action.content || ''
            });

            // Log successful action with approval ID
            await aiSecurityService.logAction(userId, projectId, action, {
              success: true,
              fileId: String(file.id)
            }, actionId);

            return res.json({ 
              success: true,
              file,
              message: `Created ${action.path}` 
            });

          } catch (error: any) {
            projectLogger.error(`[ProjectAI] Failed to create file:`, error);

            // Log failed action
            await aiSecurityService.logAction(userId, projectId, action, {
              success: false,
              error: error.message
            });

            return res.status(500).json({ 
              error: error.message || 'Failed to create file',
              code: 'EXECUTION_FAILED' 
            });
          }
        } else if (action.type === 'edit_file') {
          try {
            // Validate path (defense in depth)
            const pathValidation = aiSecurityService.validatePath(action.path);
            if (!pathValidation.valid) {
              await aiSecurityService.logAction(userId, projectId, action, {
                success: false,
                error: `Path validation failed: ${pathValidation.reason}`
              });

              return res.status(403).json({ 
                error: pathValidation.reason,
                code: 'SECURITY_BLOCKED' 
              });
            }

            const targetPath = pathValidation.sanitized || action.path;

            // Get existing file to verify it exists
            const existingFile = await this.storage.getFileByPath(projectId, targetPath);
            if (!existingFile) {
              await aiSecurityService.logAction(userId, projectId, action, {
                success: false,
                error: 'File not found'
              });

              return res.status(404).json({ 
                error: `File not found: ${targetPath}`,
                code: 'FILE_NOT_FOUND' 
              });
            }

            // Update file content
            const updatedFile = await this.storage.updateFile(existingFile.id, {
              content: action.content || ''
            });

            // Log successful action
            await aiSecurityService.logAction(userId, projectId, action, {
              success: true,
              fileId: String(existingFile.id)
            }, actionId);

            return res.json({ 
              success: true,
              file: updatedFile,
              message: `Updated ${targetPath}` 
            });

          } catch (error: any) {
            projectLogger.error(`[ProjectAI] Failed to edit file:`, error);

            await aiSecurityService.logAction(userId, projectId, action, {
              success: false,
              error: error.message
            });

            return res.status(500).json({ 
              error: error.message || 'Failed to edit file',
              code: 'EXECUTION_FAILED' 
            });
          }
        } else {
          // TypeScript ensures this is unreachable, but keeping for safety
          return res.status(400).json({ 
            error: `Unsupported action type`,
            code: 'UNSUPPORTED_ACTION' 
          });
        }

      } catch (error: any) {
        projectLogger.error('[ProjectAI] Error in approval endpoint:', error);
        return res.status(500).json({ 
          error: error.message || 'Failed to approve action',
          code: 'APPROVAL_ERROR' 
        });
      }
    });

    // POST /api/projects/:id/ai/reject/:actionId - Reject AI action
    this.router.post('/:id/ai/reject/:actionId', this.ensureAuthenticated, createRateLimitMiddleware('ai'), async (req: Request, res: Response) => {
      try {
        const actionId = req.params.actionId;
        const userId = (req.user as any)?.id;
        const { reason } = req.body;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized', code: 'NO_USER' });
        }

        const success = aiApprovalQueue.reject(actionId, userId, reason);

        if (!success) {
          return res.status(404).json({ 
            error: 'Action not found or unauthorized',
            code: 'ACTION_NOT_FOUND' 
          });
        }

        return res.json({ 
          success: true,
          message: 'Action rejected' 
        });

      } catch (error: any) {
        projectLogger.error('[ProjectAI] Error in reject endpoint:', error);
        return res.status(500).json({ 
          error: error.message || 'Failed to reject action',
          code: 'REJECTION_ERROR' 
        });
      }
    });

    // POST /visual-edit - Apply visual edits to source code
    this.router.post('/:projectId/visual-edit', this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.projectId;
        const userId = (req.user as User).id;
        const { elementPath, styles, text, sessionId } = req.body;

        if (!elementPath) {
          return res.status(400).json({ 
            error: 'Element path is required',
            code: 'MISSING_ELEMENT_PATH' 
          });
        }

        const project = await this.storage.getProject(projectId);
        if (!project || project.ownerId !== userId) {
          return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
        }

        const visualEditResult = {
          success: true,
          projectId,
          elementPath,
          appliedStyles: styles || {},
          appliedText: text,
          timestamp: new Date().toISOString(),
          message: 'Visual edit recorded. Use AI agent to apply changes to source code.',
          suggestion: this.generateCodeSuggestion(elementPath, styles, text)
        };

        projectLogger.info('[VisualEdit] Visual edit recorded:', {
          projectId,
          userId,
          elementPath,
          stylesApplied: Object.keys(styles || {}).length,
          textChanged: !!text
        });

        return res.json(visualEditResult);

      } catch (error: any) {
        projectLogger.error('[VisualEdit] Error applying visual edit:', error);
        return res.status(500).json({ 
          error: error.message || 'Failed to apply visual edit',
          code: 'VISUAL_EDIT_ERROR' 
        });
      }
    });

    // SSE endpoint for project creation progress (for complex operations like GitHub import)
    this.router.get('/:projectId/creation-progress', this.ensureAuthenticated, async (req: Request, res: Response) => {
      const projectId = req.params.projectId;
      const userId = (req.user as User).id;

      // Validate project exists and user has access
      const project = await this.storage.getProject(projectId);
      if (!project || project.ownerId !== userId) {
        return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
      }

      // Set up SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Send initial progress
      const sendProgress = (step: string, progress: number, message: string) => {
        res.write(`data: ${JSON.stringify({ step, progress, message, projectId })}\n\n`);
      };

      // Simulate progress for demonstration (in real impl, this would track actual work)
      sendProgress('created', 25, 'Project created');
      
      // For now, just send completion - real implementation would track actual scaffolding
      setTimeout(() => {
        sendProgress('scaffolded', 50, 'Files scaffolded');
      }, 100);

      setTimeout(() => {
        sendProgress('configured', 75, 'Environment configured');
      }, 200);

      setTimeout(() => {
        sendProgress('ready', 100, 'Project ready!');
        res.write(`data: ${JSON.stringify({ step: 'complete', progress: 100, message: 'Done', projectId })}\n\n`);
        res.end();
      }, 300);
    });

    // GET /stats - Get real project statistics
    this.router.get('/:id/stats', this.ensureAuthenticated, this.ensureProjectAccess, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.id;
        const project = await this.storage.getProject(projectId);
        
        if (!project) {
          return res.status(404).json({ error: 'Project not found', code: 'NOT_FOUND' });
        }

        // Get all files for this project
        const files = await this.storage.getFilesByProjectId(projectId);
        
        // Language detection based on file extensions
        const LANGUAGE_MAP: Record<string, { name: string; color: string }> = {
          '.ts': { name: 'TypeScript', color: '#3178c6' },
          '.tsx': { name: 'TypeScript', color: '#3178c6' },
          '.js': { name: 'JavaScript', color: '#f7df1e' },
          '.jsx': { name: 'JavaScript', color: '#f7df1e' },
          '.py': { name: 'Python', color: '#3776ab' },
          '.go': { name: 'Go', color: '#00add8' },
          '.rs': { name: 'Rust', color: '#dea584' },
          '.css': { name: 'CSS', color: '#1572b6' },
          '.scss': { name: 'CSS', color: '#1572b6' },
          '.html': { name: 'HTML', color: '#e34c26' },
          '.json': { name: 'JSON', color: '#6b7280' },
          '.md': { name: 'Markdown', color: '#083fa1' },
          '.sql': { name: 'SQL', color: '#336791' },
          '.java': { name: 'Java', color: '#007396' },
          '.cpp': { name: 'C++', color: '#00599C' },
          '.c': { name: 'C', color: '#A8B9CC' },
          '.php': { name: 'PHP', color: '#777BB4' },
          '.rb': { name: 'Ruby', color: '#CC342D' },
        };

        // Calculate metrics from real files
        let totalLines = 0;
        let totalSize = 0;
        const languageStats: Record<string, { lines: number; files: number; color: string }> = {};

        for (const file of files) {
          const content = file.content || '';
          const lines = content.split('\n').length;
          const size = Buffer.byteLength(content, 'utf8');
          
          totalLines += lines;
          totalSize += size;

          // Detect language from extension
          const ext = file.path?.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
          const langInfo = LANGUAGE_MAP[ext] || { name: 'Other', color: '#6b7280' };
          
          if (!languageStats[langInfo.name]) {
            languageStats[langInfo.name] = { lines: 0, files: 0, color: langInfo.color };
          }
          languageStats[langInfo.name].lines += lines;
          languageStats[langInfo.name].files += 1;
        }

        // Convert to percentage-based format
        const languages = Object.entries(languageStats)
          .map(([language, stats]) => ({
            language,
            lines: stats.lines,
            percentage: totalLines > 0 ? Math.round((stats.lines / totalLines) * 100) : 0,
            color: stats.color,
          }))
          .sort((a, b) => b.lines - a.lines)
          .slice(0, 6); // Top 6 languages

        // Parse package.json for dependencies if it exists
        let dependencies = 0;
        let devDependencies = 0;
        const packageJsonFile = files.find(f => f.path === 'package.json' || f.path?.endsWith('/package.json'));
        if (packageJsonFile?.content) {
          try {
            const pkg = JSON.parse(packageJsonFile.content);
            dependencies = Object.keys(pkg.dependencies || {}).length;
            devDependencies = Object.keys(pkg.devDependencies || {}).length;
          } catch (e) {
            // Invalid JSON, ignore
          }
        }

        // Format size
        const formatSize = (bytes: number): string => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        };

        // Calculate time since last update
        const lastUpdated = project.updatedAt 
          ? this.formatTimeAgo(new Date(project.updatedAt))
          : 'Unknown';

        const stats = {
          totalFiles: files.length,
          totalLines,
          totalSize: formatSize(totalSize),
          languages,
          commits: 0, // Would require git integration
          branches: 1, // Default branch
          contributors: 1, // Project owner
          lastUpdated,
          dependencies,
          devDependencies,
          buildTime: 0, // Would require build metrics
          testCoverage: 0, // Would require test runner integration
        };

        return res.json(stats);

      } catch (error: any) {
        projectLogger.error('[ProjectStats] Error getting project stats:', error);
        return res.status(500).json({ 
          error: error.message || 'Failed to get project stats',
          code: 'STATS_ERROR' 
        });
      }
    });

    // GET /api/projects/:id/ai/pending - Get pending actions for approval
    this.router.get('/:id/ai/pending', this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const projectId = req.params.id;
        const userId = (req.user as any)?.id;

        if (!userId) {
          return res.status(401).json({ error: 'Unauthorized', code: 'NO_USER' });
        }

        const pending = await aiApprovalQueue.getPendingActions(userId, projectId);

        return res.json({ 
          actions: pending.map(p => ({
            id: p.id,
            action: p.action,
            createdAt: p.createdAt,
            expiresAt: p.expiresAt
          }))
        });

      } catch (error: any) {
        projectLogger.error('[ProjectAI] Error getting pending actions:', error);
        return res.status(500).json({ 
          error: error.message || 'Failed to get pending actions',
          code: 'PENDING_ERROR' 
        });
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}