import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storageService } from '../services/storage.service';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';

const router = Router({ mergeParams: true });
const logger = createLogger('storage-router');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

router.use(ensureAuthenticated);

router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

async function verifyProjectOwnership(userId: number | string, projectId: number | string): Promise<boolean> {
  try {
    const uid = String(userId);
    const pid = String(projectId);
    if (!uid || !pid) return false;
    
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, pid),
        eq(projects.userId, uid)
      )
    });
    return !!project;
  } catch (error) {
    logger.error('Project ownership verification failed', { userId, projectId, error });
    return false;
  }
}

function getProjectStoragePrefix(projectId: string | number): string {
  return `projects/${projectId}/storage`;
}

function validateAndResolveStoragePath(projectId: string | number, userPath: string): string {
  const prefix = getProjectStoragePrefix(projectId);
  const normalized = path.posix.normalize(userPath).replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Invalid path: directory traversal is not allowed');
  }
  const fullPath = `${prefix}/${normalized}`;
  if (!fullPath.startsWith(prefix + '/')) {
    throw new Error('Invalid path: escapes project storage boundary');
  }
  return fullPath;
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.zip': 'application/zip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  contentType?: string;
  lastModified?: string;
  children?: TreeNode[];
}

function buildFileTree(files: Array<{ key: string; size: number; contentType: string; lastModified: Date }>, prefix: string): TreeNode[] {
  const tree: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  for (const file of files) {
    const relativePath = file.key.replace(prefix + '/', '');
    if (!relativePath) continue;

    const parts = relativePath.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast) {
        const node: TreeNode = {
          name: part,
          path: relativePath,
          type: 'file',
          size: file.size,
          contentType: file.contentType,
          lastModified: file.lastModified.toISOString(),
        };

        if (parentPath) {
          const parent = folderMap.get(parentPath);
          if (parent && parent.children) {
            parent.children.push(node);
          }
        } else {
          tree.push(node);
        }
      } else {
        if (!folderMap.has(currentPath)) {
          const folderNode: TreeNode = {
            name: part,
            path: currentPath,
            type: 'folder',
            children: [],
          };
          folderMap.set(currentPath, folderNode);

          if (parentPath) {
            const parent = folderMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(folderNode);
            }
          } else {
            tree.push(folderNode);
          }
        }
      }
    }
  }

  const sortTree = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    }).map(node => {
      if (node.children) {
        node.children = sortTree(node.children);
      }
      return node;
    });
  };

  return sortTree(tree);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const prefix = getProjectStoragePrefix(projectId);
    const files = await storageService.listFiles(prefix);
    const tree = buildFileTree(files, prefix);
    const stats = await storageService.getStorageStats(prefix);

    const MAX_STORAGE = 1024 * 1024 * 1024;
    const usagePercent = (stats.totalSize / MAX_STORAGE) * 100;

    res.json({
      files: tree,
      stats: {
        totalSize: stats.totalSize,
        totalSizeFormatted: formatFileSize(stats.totalSize),
        fileCount: stats.fileCount,
        maxStorage: MAX_STORAGE,
        maxStorageFormatted: formatFileSize(MAX_STORAGE),
        usagePercent: Math.min(usagePercent, 100),
      }
    });
  } catch (error: any) {
    logger.error('Failed to list storage files:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const filePath = req.body.path || '';
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileName = req.file.originalname.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const relativePath = filePath ? `${filePath}/${fileName}` : fileName;
    const fullPath = validateAndResolveStoragePath(projectId, relativePath);
    
    const contentType = req.file.mimetype || getContentType(fileName);

    const result = await storageService.uploadFile(fullPath, req.file.buffer, {
      contentType,
      public: true,
    });

    logger.info(`File uploaded: ${fullPath}`, { projectId, userId, size: req.file.size });

    const prefix = getProjectStoragePrefix(projectId);
    res.status(201).json({
      key: result.key,
      path: fullPath.replace(`${prefix}/`, ''),
      size: result.size,
      sizeFormatted: formatFileSize(result.size),
      contentType: result.contentType,
      lastModified: result.lastModified,
      url: `/api/projects/${projectId}/storage/${encodeURIComponent(fullPath.replace(`${prefix}/`, ''))}/download`,
    });
  } catch (error: any) {
    logger.error('Failed to upload file:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/folder', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const { name, parentPath } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const sanitizedName = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const relativePath = parentPath
      ? `${parentPath}/${sanitizedName}/.placeholder`
      : `${sanitizedName}/.placeholder`;
    const folderPath = validateAndResolveStoragePath(projectId, relativePath);

    await storageService.uploadFile(folderPath, Buffer.from(''), {
      contentType: 'text/plain',
    });

    logger.info(`Folder created: ${folderPath}`, { projectId, userId });

    res.status(201).json({
      path: parentPath ? `${parentPath}/${sanitizedName}` : sanitizedName,
      name: sanitizedName,
    });
  } catch (error: any) {
    logger.error('Failed to create folder:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/{*path}/download', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const filePath = req.params.path;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fullPath = validateAndResolveStoragePath(projectId, filePath);

    const buffer = await storageService.downloadFile(fullPath);
    const contentType = getContentType(filePath);
    const filename = path.basename(filePath);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  } catch (error: any) {
    logger.error('Failed to download file:', error);
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/{*path}/url', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const filePath = req.params.path;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fullPath = validateAndResolveStoragePath(projectId, filePath);

    const url = await storageService.getSignedUrl(fullPath, 3600, 'read');

    res.json({ url, expiresIn: 3600 });
  } catch (error: any) {
    logger.error('Failed to get signed URL:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/snippets', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = req.query.path ? String(req.query.path) : 'my-file.txt';
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const base = `${baseUrl}/api/projects/${projectId}/storage`;

    const snippets = {
      nodejs: `// Node.js — Canonical Object Storage\nconst BASE = "${base}";\n\n// List files\nconst { files } = await fetch(\`\${BASE}\`, { credentials: "include" }).then(r => r.json());\n\n// Upload a file\nconst form = new FormData();\nform.append("file", fileBlob, "${filePath}");\nawait fetch(\`\${BASE}/upload\`, { method: "POST", credentials: "include", body: form });\n\n// Download a file\nconst buf = await fetch(\`\${BASE}/${encodeURIComponent(filePath)}/download\`, { credentials: "include" }).then(r => r.arrayBuffer());\n\n// Get a signed URL (time-limited)\nconst { url } = await fetch(\`\${BASE}/${encodeURIComponent(filePath)}/url\`, { credentials: "include" }).then(r => r.json());\n\n// Delete a file\nawait fetch(\`\${BASE}/${encodeURIComponent(filePath)}\`, { method: "DELETE", credentials: "include" });`,
      python: `# Python — Canonical Object Storage\nimport requests\n\nBASE = "${base}"\nS = requests.Session()  # carry session cookie\n\n# List files\nfiles = S.get(BASE).json()["files"]\n\n# Upload a file\nwith open("${filePath}", "rb") as f:\n    S.post(f"{BASE}/upload", files={"file": f})\n\n# Download a file\ndata = S.get(f"{BASE}/${filePath}/download").content\n\n# Get a signed URL\nurl = S.get(f"{BASE}/${filePath}/url").json()["url"]\n\n# Delete a file\nS.delete(f"{BASE}/${filePath}")`,
      curl: `# cURL — Canonical Object Storage\nBASE="${base}"\nCOOKIE="connect.sid=<SESSION>"\n\n# List files\ncurl -b "$COOKIE" "$BASE"\n\n# Upload a file\ncurl -b "$COOKIE" -F "file=@${filePath}" "$BASE/upload"\n\n# Download a file\ncurl -b "$COOKIE" -o out.bin "$BASE/${filePath}/download"\n\n# Get a signed URL\ncurl -b "$COOKIE" "$BASE/${filePath}/url"\n\n# Delete a file\ncurl -b "$COOKIE" -X DELETE "$BASE/${filePath}"`,
      agent: `// AI Agent Storage Tools\n// The agent has built-in tools scoped to this project's storage.\n// Available endpoints (all require auth):\n\n// List files\n// GET /api/agent/tools/storage/${projectId}/list?prefix=optional/subfolder\n\n// Read a text file\n// GET /api/agent/tools/storage/${projectId}/read?path=${encodeURIComponent(filePath)}\n\n// Write a text file\n// POST /api/agent/tools/storage/${projectId}/write\n// Body: { "path": "${filePath}", "content": "...", "contentType": "text/plain" }\n\n// Delete a file\n// DELETE /api/agent/tools/storage/${projectId}/delete?path=${encodeURIComponent(filePath)}\n\n// Get a signed URL\n// GET /api/agent/tools/storage/${projectId}/signed-url?path=${encodeURIComponent(filePath)}&ttl=3600\n\n// KV store\n// GET  /api/agent/tools/storage/${projectId}/kv/:key\n// PUT  /api/agent/tools/storage/${projectId}/kv/:key   body: { "value": "..." }`,
    };

    res.json({ snippets, projectId, path: filePath });
  } catch (error: any) {
    logger.error('Failed to generate storage snippets:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/{*path}', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.projectId;
    const filePath = req.params.path;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const isOwner = await verifyProjectOwnership(userId, projectId);
    if (!isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const fullPath = validateAndResolveStoragePath(projectId, filePath);

    await storageService.deleteFile(fullPath);
    
    logger.info(`File deleted: ${fullPath}`, { projectId, userId });

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    logger.error('Failed to delete file:', error);
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
