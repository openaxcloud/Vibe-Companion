// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { insertFileSchema } from "@shared/schema";
import { type IStorage } from "../storage";
import { ensureAuthenticated } from "../middleware/auth";
import { csrfProtection } from "../middleware/csrf";
import type { User } from "@shared/schema";
import path from 'path';
import { previewEvents } from '../preview/preview-websocket';
import { withScopedTransaction, TenantScopedQueries } from '../services/persistence-engine';
import { z } from 'zod';
import { syncFileToDisc, removeFileFromDisk } from '../utils/project-fs-sync';

const projectIdSchema = z.coerce.number().int().positive();
const fileIdSchema = z.coerce.number().int().positive();
const filePathSchema = z.string().min(1).max(500).refine(
  (path) => !path.includes('..') && !path.startsWith('/'),
  { message: 'Invalid file path - path traversal not allowed' }
);

export class FilesRouter {
  private router: Router;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.initializeRoutes();
  }

  private emitFileChange(projectId: string, filePath: string, changeType: 'create' | 'update' | 'delete') {
    previewEvents.emit('preview:file-change', {
      projectId: parseInt(projectId, 10),
      filePath,
      changeType,
      timestamp: new Date().toISOString()
    });
  }

  // Use the shared ensureAuthenticated middleware for consistent authentication
  private ensureAuthenticated = ensureAuthenticated;

  private initializeRoutes() {
    this.router.get("/:projectId/files", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const files = await scopedQueries.getFilesByProject(projectId);
          return files;
        });

        if (!result.success) {
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to fetch files:', result.error);
          return res.status(500).json({ 
            message: "Failed to fetch files",
            code: "FETCH_ERROR"
          });
        }

        const transformedFiles = (result.data || []).map(file => ({
          ...file,
          type: file.isDirectory ? "folder" : "file"
        }));
        res.json(transformedFiles);
      } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ 
          message: "Failed to fetch files",
          code: "FETCH_ERROR"
        });
      }
    });

    this.router.get("/:projectId/files/{*filePath}", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;
        let fileIdentifier = req.params.filePath || req.params[0];
        
        if (!fileIdentifier) {
          return res.status(400).json({
            message: "File identifier is required",
            code: "IDENTIFIER_REQUIRED"
          });
        }

        let validatedFileId: number | null = null;
        if (/^\d+$/.test(fileIdentifier)) {
          const fileIdResult = fileIdSchema.safeParse(fileIdentifier);
          if (!fileIdResult.success) {
            return res.status(400).json({
              message: "Invalid file ID",
              code: "INVALID_FILE_ID",
              errors: fileIdResult.error.errors
            });
          }
          validatedFileId = fileIdResult.data;
        }

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          let file;
          
          if (validatedFileId !== null) {
            file = await scopedQueries.getFileById(projectId, validatedFileId);
          } else {
            const { aiSecurityService } = await import('../services/ai-security.service');
            const pathValidation = aiSecurityService.validatePath(fileIdentifier);
            if (pathValidation.valid && pathValidation.sanitized) {
              fileIdentifier = pathValidation.sanitized;
            }
            
            const allFiles = await scopedQueries.getFilesByProject(projectId);
            file = allFiles.find(f => f.path === fileIdentifier);
          }
          
          return file;
        });

        if (!result.success) {
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to fetch file:', result.error);
          return res.status(500).json({ 
            message: "Failed to fetch file",
            code: "FETCH_ERROR"
          });
        }
        
        if (!result.data) {
          return res.status(404).json({
            message: "File not found",
            code: "FILE_NOT_FOUND",
            identifier: fileIdentifier
          });
        }
        
        res.json(result.data);
      } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ 
          message: "Failed to fetch file",
          code: "FETCH_ERROR"
        });
      }
    });

    this.router.post("/:projectId/files", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;
        
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        if (req.body.content && req.body.content.length > MAX_FILE_SIZE) {
          return res.status(413).json({
            error: "File too large",
            message: "File size limit exceeded (5MB maximum)",
            code: "FILE_TOO_LARGE"
          });
        }
        
        const requestData = { ...req.body, projectId };
        if (!requestData.name && requestData.path) {
          requestData.name = requestData.path.split('/').pop() || requestData.path;
        }
        
        const validatedData = insertFileSchema.parse(requestData);
        
        const { aiSecurityService } = await import('../services/ai-security.service');
        const pathValidation = aiSecurityService.validatePath(validatedData.path);
        
        if (!pathValidation.valid) {
          console.warn(`[FILES-SECURITY] Blocked: ${validatedData.path} - ${pathValidation.reason}`);
          
          await aiSecurityService.logAction(
            userId,
            String(projectId),
            { type: 'create_file', path: validatedData.path, content: validatedData.content || '' },
            { success: false, error: `Path blocked: ${pathValidation.reason}` }
          );
          
          return res.status(400).json({
            message: `Security: ${pathValidation.reason}`,
            code: "SECURITY_PATH_BLOCKED"
          });
        }
        
        validatedData.path = pathValidation.sanitized!;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const allFiles = await scopedQueries.getFilesByProject(projectId);
          const existingFile = allFiles.find(f => f.path === validatedData.path);
          
          if (existingFile) {
            const updated = await scopedQueries.updateFile(projectId, existingFile.id, {
              content: validatedData.content || ''
            });
            return { file: updated, isUpdate: true };
          } else {
            const { projectId: _, ...fileData } = validatedData;
            const created = await scopedQueries.createFile(projectId, fileData);
            return { file: created, isUpdate: false };
          }
        });

        if (!result.success) {
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to save file:', result.error);
          return res.status(500).json({ 
            error: "Failed to save file",
            message: "Failed to save file",
            code: "SAVE_ERROR"
          });
        }

        await aiSecurityService.logAction(
          userId,
          String(projectId),
          { type: result.data!.isUpdate ? 'edit_file' : 'create_file', path: validatedData.path, content: validatedData.content || '' },
          { success: true, fileId: String(result.data!.file?.id) }
        );

        res.json({ file: result.data!.file });
        
        this.emitFileChange(String(projectId), validatedData.path, result.data!.isUpdate ? 'update' : 'create');
        syncFileToDisc(projectId, validatedData.path, validatedData.content || '', !!validatedData.isDirectory).catch(() => {});
      } catch (error: any) {
        console.error('Error saving file:', error);
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            error: "Invalid file data",
            message: "Invalid file data",
            code: "INVALID_INPUT",
            errors: error.errors
          });
        }
        res.status(500).json({ 
          error: "Failed to save file",
          message: "Failed to save file",
          code: "SAVE_ERROR"
        });
      }
    });

    this.router.put("/:projectId/files/{*filePath}", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;
        let filePath = req.params.filePath || req.params[0];
        const { content } = req.body;
        
        if (!filePath) {
          return res.status(400).json({
            message: "File path is required",
            code: "PATH_REQUIRED"
          });
        }

        const { aiSecurityService } = await import('../services/ai-security.service');
        const pathValidation = aiSecurityService.validatePath(filePath);
        if (pathValidation.valid && pathValidation.sanitized) {
          filePath = pathValidation.sanitized;
        }

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const allFiles = await scopedQueries.getFilesByProject(projectId);
          const file = allFiles.find(f => f.path === filePath);
          
          if (!file) {
            throw new Error('FILE_NOT_FOUND');
          }
          
          const updated = await scopedQueries.updateFile(projectId, file.id, { content });
          return updated;
        });

        if (!result.success) {
          if (result.error?.message === 'FILE_NOT_FOUND') {
            return res.status(404).json({
              message: "File not found",
              code: "FILE_NOT_FOUND"
            });
          }
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to update file:', result.error);
          return res.status(500).json({ 
            message: "Failed to update file",
            code: "UPDATE_ERROR"
          });
        }
        
        res.json(result.data);
        
        this.emitFileChange(String(projectId), filePath, 'update');
        if (content !== undefined) {
          syncFileToDisc(projectId, filePath, content || '').catch(() => {});
        }
      } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ 
          message: "Failed to update file",
          code: "UPDATE_ERROR"
        });
      }
    });

    this.router.delete("/:projectId/files/{*filePath}", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;
        let filePath = req.params.filePath || req.params[0];
        
        if (!filePath) {
          return res.status(400).json({
            message: "File path is required",
            code: "PATH_REQUIRED"
          });
        }

        const { aiSecurityService } = await import('../services/ai-security.service');
        const pathValidation = aiSecurityService.validatePath(filePath);
        if (pathValidation.valid && pathValidation.sanitized) {
          filePath = pathValidation.sanitized;
        }

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const allFiles = await scopedQueries.getFilesByProject(projectId);
          const file = allFiles.find(f => f.path === filePath);
          
          if (!file) {
            throw new Error('FILE_NOT_FOUND');
          }
          
          await scopedQueries.deleteFile(projectId, file.id);
          return true;
        });

        if (!result.success) {
          if (result.error?.message === 'FILE_NOT_FOUND') {
            return res.status(404).json({
              message: "File not found",
              code: "FILE_NOT_FOUND"
            });
          }
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to delete file:', result.error);
          return res.status(500).json({ 
            message: "Failed to delete file",
            code: "DELETE_ERROR"
          });
        }

        res.json({ message: "File deleted successfully" });
        
        this.emitFileChange(String(projectId), filePath, 'delete');
        removeFileFromDisk(projectId, filePath).catch(() => {});
      } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ 
          message: "Failed to delete file",
          code: "DELETE_ERROR"
        });
      }
    });

    this.router.patch("/:fileId", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const fileIdResult = fileIdSchema.safeParse(req.params.fileId);
        if (!fileIdResult.success) {
          return res.status(400).json({
            message: "Invalid file ID",
            code: "INVALID_FILE_ID",
            errors: fileIdResult.error.errors
          });
        }
        const fileId = fileIdResult.data;
        const userId = req.user!.id;
        const { content, name } = req.body;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const projects = await scopedQueries.getProjects();
          
          for (const project of projects) {
            const file = await scopedQueries.getFileById(project.id, fileId);
            if (file) {
              const updated = await scopedQueries.updateFile(project.id, fileId, { content, name });
              return { file: updated, projectId: project.id, originalPath: file.path || file.name };
            }
          }
          
          throw new Error('FILE_NOT_FOUND');
        });

        if (!result.success) {
          if (result.error?.message === 'FILE_NOT_FOUND') {
            return res.status(404).json({
              message: "File not found",
              code: "FILE_NOT_FOUND"
            });
          }
          console.error('Failed to update file:', result.error);
          return res.status(500).json({ 
            message: "Failed to update file",
            code: "UPDATE_ERROR"
          });
        }
        
        res.json(result.data!.file);
        
        this.emitFileChange(String(result.data!.projectId), result.data!.originalPath, 'update');
        if (content !== undefined) {
          syncFileToDisc(result.data!.projectId, result.data!.originalPath, content || '').catch(() => {});
        }
      } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ 
          message: "Failed to update file",
          code: "UPDATE_ERROR"
        });
      }
    });

    // PUT route for file update (same as PATCH, for frontend compatibility)
    this.router.put("/:fileId", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const fileIdResult = fileIdSchema.safeParse(req.params.fileId);
        if (!fileIdResult.success) {
          return res.status(400).json({
            message: "Invalid file ID",
            code: "INVALID_FILE_ID",
            errors: fileIdResult.error.errors
          });
        }
        const fileId = fileIdResult.data;
        const userId = req.user!.id;
        const { content, name } = req.body;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const projects = await scopedQueries.getProjects();
          
          for (const project of projects) {
            const file = await scopedQueries.getFileById(project.id, fileId);
            if (file) {
              const updated = await scopedQueries.updateFile(project.id, fileId, { content, name });
              return { file: updated, projectId: project.id, originalPath: file.path || file.name };
            }
          }
          
          throw new Error('FILE_NOT_FOUND');
        });

        if (!result.success) {
          if (result.error?.message === 'FILE_NOT_FOUND') {
            return res.status(404).json({
              message: "File not found",
              code: "FILE_NOT_FOUND"
            });
          }
          console.error('Failed to update file:', result.error);
          return res.status(500).json({ 
            message: "Failed to update file",
            code: "UPDATE_ERROR"
          });
        }
        
        res.json(result.data!.file);
        
        this.emitFileChange(String(result.data!.projectId), result.data!.originalPath, 'update');
        if (content !== undefined) {
          syncFileToDisc(result.data!.projectId, result.data!.originalPath, content || '').catch(() => {});
        }
      } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ 
          message: "Failed to update file",
          code: "UPDATE_ERROR"
        });
      }
    });

    this.router.delete("/:fileId", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const fileIdResult = fileIdSchema.safeParse(req.params.fileId);
        if (!fileIdResult.success) {
          return res.status(400).json({
            message: "Invalid file ID",
            code: "INVALID_FILE_ID",
            errors: fileIdResult.error.errors
          });
        }
        const fileId = fileIdResult.data;
        const userId = req.user!.id;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const projects = await scopedQueries.getProjects();
          
          for (const project of projects) {
            const file = await scopedQueries.getFileById(project.id, fileId);
            if (file) {
              await scopedQueries.deleteFile(project.id, fileId);
              return { projectId: project.id, path: file.path || file.name };
            }
          }
          
          throw new Error('FILE_NOT_FOUND');
        });

        if (!result.success) {
          if (result.error?.message === 'FILE_NOT_FOUND') {
            return res.status(404).json({
              message: "File not found",
              code: "FILE_NOT_FOUND"
            });
          }
          console.error('Failed to delete file:', result.error);
          return res.status(500).json({ 
            message: "Failed to delete file",
            code: "DELETE_ERROR"
          });
        }

        res.json({ message: "File deleted successfully" });
        
        this.emitFileChange(String(result.data!.projectId), result.data!.path, 'delete');
        removeFileFromDisk(result.data!.projectId, result.data!.path).catch(() => {});
      } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ 
          message: "Failed to delete file",
          code: "DELETE_ERROR"
        });
      }
    });

    this.router.post("/:projectId", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;
        
        let filePath = req.body.path;
        
        if (!filePath && req.body.name) {
          const { name, parentId } = req.body;
          
          if (parentId) {
            const parent = await this.storage.getFile(parentId);
            if (!parent) {
              return res.status(400).json({
                message: "Parent folder not found",
                code: "PARENT_NOT_FOUND"
              });
            }
            filePath = parent.path.endsWith('/') ? `${parent.path}${name}` : `${parent.path}/${name}`;
          } else {
            filePath = name;
          }
        }
        
        const validatedData = insertFileSchema.parse({
          ...req.body,
          path: filePath,
          projectId
        });
        
        const { aiSecurityService } = await import('../services/ai-security.service');
        const pathValidation = aiSecurityService.validatePath(validatedData.path);
        
        if (!pathValidation.valid) {
          console.warn(`[FILES-SECURITY] Blocked (compat): ${validatedData.path} - ${pathValidation.reason}`);
          
          await aiSecurityService.logAction(
            userId,
            String(projectId),
            { type: 'create_file', path: validatedData.path, content: validatedData.content || '' },
            { success: false, error: `Path blocked: ${pathValidation.reason}` }
          );
          
          return res.status(400).json({
            message: `Security: ${pathValidation.reason}`,
            code: "SECURITY_PATH_BLOCKED"
          });
        }
        
        validatedData.path = pathValidation.sanitized!;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const allFiles = await scopedQueries.getFilesByProject(projectId);
          const existingFile = allFiles.find(f => f.path === validatedData.path);
          
          if (existingFile) {
            const updated = await scopedQueries.updateFile(projectId, existingFile.id, {
              content: validatedData.content
            });
            return { file: updated, isUpdate: true };
          } else {
            const { projectId: _, ...fileData } = validatedData;
            const created = await scopedQueries.createFile(projectId, fileData);
            return { file: created, isUpdate: false };
          }
        });

        if (!result.success) {
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to save file:', result.error);
          return res.status(500).json({ 
            error: "Failed to save file",
            message: "Failed to save file",
            code: "SAVE_ERROR"
          });
        }

        await aiSecurityService.logAction(
          userId,
          String(projectId),
          { type: result.data!.isUpdate ? 'edit_file' : 'create_file', path: validatedData.path, content: validatedData.content || '' },
          { success: true, fileId: result.data!.file?.id ? String(result.data!.file.id) : undefined }
        );

        res.json(result.data!.file);
        syncFileToDisc(projectId, validatedData.path, validatedData.content || '', !!validatedData.isDirectory).catch(() => {});
      } catch (error: any) {
        console.error('Error saving file:', error);
        if (error.name === 'ZodError') {
          return res.status(400).json({ 
            error: "Invalid file data",
            message: "Invalid file data",
            code: "INVALID_INPUT",
            errors: error.errors
          });
        }
        res.status(500).json({ 
          error: "Failed to save file",
          message: "Failed to save file",
          code: "SAVE_ERROR"
        });
      }
    });

    this.router.post("/:projectId/folders", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID",
            errors: projectIdResult.error.errors
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;
        const { path: folderPath } = req.body;
        
        if (!folderPath || folderPath.includes('..')) {
          return res.status(400).json({
            message: "Invalid folder path",
            code: "INVALID_PATH"
          });
        }

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const file = await scopedQueries.createFile(projectId, {
            name: '.gitkeep',
            path: path.join(folderPath, '.gitkeep'),
            content: '',
            isDirectory: false
          });
          return file;
        });

        if (!result.success) {
          if (result.error?.message?.includes('not found or access denied')) {
            return res.status(403).json({
              message: "Access denied",
              code: "ACCESS_DENIED"
            });
          }
          console.error('Failed to create folder:', result.error);
          return res.status(500).json({ 
            message: "Failed to create folder",
            code: "CREATE_ERROR"
          });
        }

        res.json({ 
          success: true, 
          path: folderPath,
          file: result.data
        });
        
        this.emitFileChange(String(projectId), folderPath, 'create');
        syncFileToDisc(projectId, folderPath, '', true).catch(() => {});
      } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ 
          message: "Failed to create folder",
          code: "CREATE_ERROR"
        });
      }
    });

    // File History Endpoints
    this.router.get("/:projectId/file-history", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID"
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const { fileVersions, files } = await import('@shared/schema');
          const { db } = await import('../db');
          const { eq, desc } = await import('drizzle-orm');
          
          const versions = await db
            .select({
              id: fileVersions.id,
              fileId: fileVersions.fileId,
              projectId: fileVersions.projectId,
              content: fileVersions.content,
              version: fileVersions.version,
              changeType: fileVersions.changeType,
              changeSummary: fileVersions.changeSummary,
              userId: fileVersions.userId,
              checkpointId: fileVersions.checkpointId,
              additions: fileVersions.additions,
              deletions: fileVersions.deletions,
              createdAt: fileVersions.createdAt,
              fileName: files.name,
              filePath: files.path,
            })
            .from(fileVersions)
            .leftJoin(files, eq(fileVersions.fileId, files.id))
            .where(eq(fileVersions.projectId, projectId))
            .orderBy(desc(fileVersions.createdAt))
            .limit(100);
          
          return versions;
        });

        if (!result.success) {
          return res.status(500).json({ 
            message: "Failed to fetch file history",
            code: "FETCH_ERROR"
          });
        }

        const groupedByFile = (result.data || []).reduce((acc: Record<string, any[]>, version) => {
          const filePath = version.filePath || 'unknown';
          if (!acc[filePath]) {
            acc[filePath] = [];
          }
          acc[filePath].push(version);
          return acc;
        }, {});

        res.json({
          success: true,
          history: result.data,
          groupedByFile,
          count: result.data?.length || 0
        });
      } catch (error) {
        console.error('Error fetching file history:', error);
        res.status(500).json({ 
          message: "Failed to fetch file history",
          code: "FETCH_ERROR"
        });
      }
    });

    this.router.get("/:projectId/files/:fileId/history", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        const fileIdResult = fileIdSchema.safeParse(req.params.fileId);
        
        if (!projectIdResult.success || !fileIdResult.success) {
          return res.status(400).json({
            message: "Invalid project or file ID",
            code: "INVALID_ID"
          });
        }
        
        const projectId = projectIdResult.data;
        const fileId = fileIdResult.data;
        const userId = req.user!.id;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const { fileVersions } = await import('@shared/schema');
          const { db } = await import('../db');
          const { eq, and, desc } = await import('drizzle-orm');
          
          const versions = await db
            .select()
            .from(fileVersions)
            .where(and(
              eq(fileVersions.projectId, projectId),
              eq(fileVersions.fileId, fileId)
            ))
            .orderBy(desc(fileVersions.createdAt))
            .limit(50);
          
          return versions;
        });

        if (!result.success) {
          return res.status(500).json({ 
            message: "Failed to fetch file history",
            code: "FETCH_ERROR"
          });
        }

        res.json({
          success: true,
          versions: result.data,
          count: result.data?.length || 0
        });
      } catch (error) {
        console.error('Error fetching file history:', error);
        res.status(500).json({ 
          message: "Failed to fetch file history",
          code: "FETCH_ERROR"
        });
      }
    });

    this.router.post("/:projectId/files/:fileId/versions", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        const fileIdResult = fileIdSchema.safeParse(req.params.fileId);
        
        if (!projectIdResult.success || !fileIdResult.success) {
          return res.status(400).json({
            message: "Invalid project or file ID",
            code: "INVALID_ID"
          });
        }
        
        const projectId = projectIdResult.data;
        const fileId = fileIdResult.data;
        const userId = req.user!.id;
        const { content, changeSummary, changeType = 'modified' } = req.body;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const { fileVersions } = await import('@shared/schema');
          const { db } = await import('../db');
          const { eq, and, desc } = await import('drizzle-orm');
          
          const existingVersions = await db
            .select({ version: fileVersions.version })
            .from(fileVersions)
            .where(and(
              eq(fileVersions.projectId, projectId),
              eq(fileVersions.fileId, fileId)
            ))
            .orderBy(desc(fileVersions.version))
            .limit(1);
          
          const nextVersion = (existingVersions[0]?.version || 0) + 1;
          
          const [newVersion] = await db
            .insert(fileVersions)
            .values({
              fileId,
              projectId,
              content,
              version: nextVersion,
              changeType,
              changeSummary,
              userId,
            })
            .returning();
          
          return newVersion;
        });

        if (!result.success) {
          return res.status(500).json({ 
            message: "Failed to save file version",
            code: "SAVE_ERROR"
          });
        }

        res.json({
          success: true,
          version: result.data
        });
      } catch (error) {
        console.error('Error saving file version:', error);
        res.status(500).json({ 
          message: "Failed to save file version",
          code: "SAVE_ERROR"
        });
      }
    });

    this.router.post("/:projectId/files/:fileId/versions/:versionId/restore", this.ensureAuthenticated, csrfProtection, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        const fileIdResult = fileIdSchema.safeParse(req.params.fileId);
        const versionIdResult = fileIdSchema.safeParse(req.params.versionId);
        
        if (!projectIdResult.success || !fileIdResult.success || !versionIdResult.success) {
          return res.status(400).json({
            message: "Invalid IDs",
            code: "INVALID_ID"
          });
        }
        
        const projectId = projectIdResult.data;
        const fileId = fileIdResult.data;
        const versionId = versionIdResult.data;
        const userId = req.user!.id;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const { fileVersions, files } = await import('@shared/schema');
          const { db } = await import('../db');
          const { eq, and, desc } = await import('drizzle-orm');
          
          const [version] = await db
            .select()
            .from(fileVersions)
            .where(and(
              eq(fileVersions.id, versionId),
              eq(fileVersions.projectId, projectId),
              eq(fileVersions.fileId, fileId)
            ))
            .limit(1);
          
          if (!version) {
            throw new Error('VERSION_NOT_FOUND');
          }
          
          await db
            .update(files)
            .set({ 
              content: version.content,
              updatedAt: new Date()
            })
            .where(eq(files.id, fileId));
          
          const existingVersions = await db
            .select({ version: fileVersions.version })
            .from(fileVersions)
            .where(and(
              eq(fileVersions.projectId, projectId),
              eq(fileVersions.fileId, fileId)
            ))
            .orderBy(desc(fileVersions.version))
            .limit(1);
          
          const nextVersion = (existingVersions[0]?.version || 0) + 1;
          
          await db
            .insert(fileVersions)
            .values({
              fileId,
              projectId,
              content: version.content,
              version: nextVersion,
              changeType: 'restored',
              changeSummary: `Restored from version ${version.version}`,
              userId,
            });
          
          return { restored: true, fromVersion: version.version };
        });

        if (!result.success) {
          if (result.error?.message === 'VERSION_NOT_FOUND') {
            return res.status(404).json({
              message: "Version not found",
              code: "VERSION_NOT_FOUND"
            });
          }
          return res.status(500).json({ 
            message: "Failed to restore version",
            code: "RESTORE_ERROR"
          });
        }

        res.json({
          success: true,
          ...result.data
        });
        
        const allFiles = await this.storage.getFilesByProjectId(projectId);
        const file = allFiles.find(f => f.id === fileId);
        if (file) {
          this.emitFileChange(String(projectId), file.path, 'update');
          syncFileToDisc(projectId, file.path, file.content || '').catch(() => {});
        }
      } catch (error) {
        console.error('Error restoring file version:', error);
        res.status(500).json({ 
          message: "Failed to restore version",
          code: "RESTORE_ERROR"
        });
      }
    });

    this.router.get("/:projectId/files-with-history", this.ensureAuthenticated, async (req: Request, res: Response) => {
      try {
        const projectIdResult = projectIdSchema.safeParse(req.params.projectId);
        if (!projectIdResult.success) {
          return res.status(400).json({
            message: "Invalid project ID",
            code: "INVALID_PROJECT_ID"
          });
        }
        const projectId = projectIdResult.data;
        const userId = req.user!.id;

        const result = await withScopedTransaction(userId, userId, async (scopedQueries) => {
          const { fileVersions, files } = await import('@shared/schema');
          const { db } = await import('../db');
          const { eq, sql, desc } = await import('drizzle-orm');
          
          const filesWithVersionCount = await db
            .select({
              id: files.id,
              name: files.name,
              path: files.path,
              updatedAt: files.updatedAt,
              versionCount: sql<number>`COALESCE((SELECT COUNT(*) FROM file_versions WHERE file_id = ${files.id})::int, 0)`,
              latestChange: sql<string>`(SELECT change_type FROM file_versions WHERE file_id = ${files.id} ORDER BY created_at DESC LIMIT 1)`,
            })
            .from(files)
            .where(eq(files.projectId, projectId))
            .orderBy(desc(files.updatedAt));
          
          return filesWithVersionCount.filter(f => (f.versionCount as number) > 0);
        });

        if (!result.success) {
          return res.status(500).json({ 
            message: "Failed to fetch files with history",
            code: "FETCH_ERROR"
          });
        }

        res.json({
          success: true,
          files: result.data,
          count: result.data?.length || 0
        });
      } catch (error) {
        console.error('Error fetching files with history:', error);
        res.status(500).json({ 
          message: "Failed to fetch files with history",
          code: "FETCH_ERROR"
        });
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
