// @ts-nocheck
import { Router } from 'express';
import { storage } from '../storage';
import path from 'path';
import fs from 'fs/promises';
import { ensureAuthenticated } from '../middleware/auth';
import { createSecureUpload, validateUpload, sanitizeFilename } from '../middleware/upload-validation';

const router = Router();

const upload = createSecureUpload();

// Middleware to ensure user has access to project
const ensureProjectAccess = async (req: any, res: any, next: any) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const projectId = parseInt(req.params.projectId || req.params.id);
  
  if (isNaN(projectId)) {
    return res.status(400).json({ message: "Invalid project ID" });
  }
  
  const project = await storage.getProject(String(projectId));
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }
  
  if (String(project.ownerId) === String(userId)) {
    return next();
  }
  
  const collaborators = await storage.getProjectCollaborators(String(projectId));
  const isCollaborator = collaborators.some((c: any) => String(c.userId) === String(userId));
  
  if (isCollaborator) {
    return next();
  }
  
  res.status(403).json({ message: "You don't have access to this project" });
};

// Upload single file
router.post('/projects/:id/upload', 
  ensureAuthenticated, 
  ensureProjectAccess, 
  upload.single('file'),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const file = req.file;
      const { path: filepath = '', parentId } = req.body;
      
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }
      
      const validation = await validateUpload(file.buffer, file.mimetype);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
      
      const newFile = await storage.createFile({
        projectId: String(projectId),
        name: sanitizeFilename(file.originalname),
        content: file.buffer.toString('utf-8'),
        isDirectory: false,
        parentId: parentId ? parseInt(parentId) : null
      });
      
      res.json(newFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

// Upload multiple files
router.post('/projects/:id/upload-multiple', 
  ensureAuthenticated, 
  ensureProjectAccess, 
  upload.array('files', 10),
  async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const files = req.files as Express.Multer.File[];
      const { parentId } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }
      
      for (const file of files) {
        const validation = await validateUpload(file.buffer, file.mimetype);
        if (!validation.valid) {
          return res.status(400).json({ error: `${file.originalname}: ${validation.error}` });
        }
      }
      
      const createdFiles = [];
      
      for (const file of files) {
        const newFile = await storage.createFile({
          projectId: String(projectId),
          name: sanitizeFilename(file.originalname),
          content: file.buffer.toString('utf-8'),
          isDirectory: false,
          parentId: parentId ? parseInt(parentId) : null
        });
        createdFiles.push(newFile);
      }
      
      res.json({ files: createdFiles });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ error: 'Failed to upload files' });
    }
  }
);

// Download file
router.get('/files/:id/download', ensureAuthenticated, async (req, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const file = await storage.getFile(fileId);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check user access
    const project = await storage.getProject(String(file.projectId));
    if (!project || String(project.ownerId) !== String(req.user!.id)) {
      const collaborators = await storage.getProjectCollaborators(String(file.projectId));
      const isCollaborator = collaborators.some((c: any) => String(c.userId) === String(req.user!.id));
      if (!isCollaborator) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(file.content || '');
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;