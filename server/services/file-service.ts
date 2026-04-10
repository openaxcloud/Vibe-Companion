// @ts-nocheck
/**
 * Secure File Service
 * Handles file uploads, validation, and security
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { pathTraversalPrevention } from '../utils/security';
import { createLogger } from '../utils/logger';

const logger = createLogger('file-service');

// Configuration
const FILE_CONFIG = {
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  tempDir: process.env.TEMP_DIR || './temp',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 10,
  allowedExtensions: [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif',
    // Documents
    '.pdf', '.doc', '.docx', '.txt', '.csv', '.md', '.mdx', '.rst',
    // Config
    '.json', '.jsonc', '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    // Code - JavaScript/TypeScript
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.css', '.scss', '.sass', '.less',
    '.html', '.htm',
    // Frameworks
    '.vue', '.svelte', '.astro',
    // Backend
    '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.sql', '.graphql', '.gql', '.prisma',
    // Fonts
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    // Archives
    '.zip', '.tar', '.gz',
    // Other
    '.map', '.lock', '.log', '.ejs', '.hbs', '.pug', '.njk',
    '.gitignore', '.editorconfig', '.prettierrc', '.eslintrc', '.babelrc',
  ],
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/csv',
    'application/json', 'application/xml', 'text/yaml',
    'text/javascript', 'application/javascript', 'text/css', 'text/html',
    'application/zip', 'application/x-tar', 'application/gzip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  quarantineDir: './quarantine',
  sandboxDir: './sandbox',
};

// File type signatures (magic numbers)
const FILE_SIGNATURES = {
  'jpg': ['FFD8FF'],
  'png': ['89504E47'],
  'gif': ['47494638'],
  'pdf': ['25504446'],
  'zip': ['504B0304', '504B0506', '504B0708'],
  'exe': ['4D5A'],
  'mp4': ['00000018667479706D7034', '00000020667479706D7034'],
};

/**
 * Virus Scanner Simulation
 * In production, integrate with real antivirus API (ClamAV, VirusTotal, etc.)
 */
class VirusScanner {
  private suspiciousPatterns = [
    /eval\s*\(/gi,
    /<script[^>]*>/gi,
    /document\.write/gi,
    /window\.location/gi,
    /\.exec\s*\(/gi,
    /powershell/gi,
    /cmd\.exe/gi,
    /\/etc\/passwd/gi,
    /HKEY_LOCAL_MACHINE/gi,
  ];

  async scanFile(filePath: string): Promise<{ clean: boolean; threats: string[] }> {
    const threats: string[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check for suspicious patterns
      for (const pattern of this.suspiciousPatterns) {
        if (pattern.test(content)) {
          threats.push(`Suspicious pattern detected: ${pattern.source}`);
        }
      }

      // Check for embedded executables
      const buffer = await fs.readFile(filePath);
      const hex = buffer.toString('hex').substring(0, 20).toUpperCase();
      
      if (FILE_SIGNATURES.exe.some(sig => hex.startsWith(sig))) {
        threats.push('Executable file detected');
      }

      // Simulate additional checks
      if (content.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
        threats.push('EICAR test file detected');
      }

    } catch (error) {
      // Binary files or read errors
      logger.debug('File scan error (may be binary)', { filePath, error: error.message });
    }

    return {
      clean: threats.length === 0,
      threats,
    };
  }

  async quarantineFile(filePath: string, reason: string): Promise<void> {
    const quarantinePath = path.join(
      FILE_CONFIG.quarantineDir,
      `${Date.now()}_${path.basename(filePath)}`
    );

    await fs.mkdir(FILE_CONFIG.quarantineDir, { recursive: true });
    await fs.rename(filePath, quarantinePath);

    logger.warn('File quarantined', {
      original: filePath,
      quarantine: quarantinePath,
      reason,
    });
  }
}

const virusScanner = new VirusScanner();

/**
 * File Type Validator
 */
class FileTypeValidator {
  validateExtension(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return FILE_CONFIG.allowedExtensions.includes(ext);
  }

  validateMimeType(mimeType: string): boolean {
    return FILE_CONFIG.allowedMimeTypes.includes(mimeType);
  }

  async validateFileSignature(filePath: string, expectedType: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      const hex = buffer.toString('hex').substring(0, 20).toUpperCase();

      const signatures = FILE_SIGNATURES[expectedType];
      if (!signatures) {
        return true; // No signature check available
      }

      return signatures.some(sig => hex.startsWith(sig));
    } catch (error) {
      logger.error('File signature validation error', error);
      return false;
    }
  }

  async getFileInfo(filePath: string): Promise<{
    size: number;
    type: string;
    extension: string;
    isExecutable: boolean;
  }> {
    const stats = await fs.stat(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath, { encoding: null });
    const hex = buffer.toString('hex').substring(0, 20).toUpperCase();

    // Detect file type from signature
    let type = 'unknown';
    let isExecutable = false;

    for (const [fileType, signatures] of Object.entries(FILE_SIGNATURES)) {
      if (signatures.some(sig => hex.startsWith(sig))) {
        type = fileType;
        isExecutable = fileType === 'exe';
        break;
      }
    }

    return {
      size: stats.size,
      type,
      extension,
      isExecutable,
    };
  }
}

const fileTypeValidator = new FileTypeValidator();

/**
 * Sandbox Executor
 * Runs files in isolated environment
 */
class SandboxExecutor {
  async executeInSandbox(filePath: string, timeout: number = 5000): Promise<{
    safe: boolean;
    output?: string;
    error?: string;
  }> {
    // Create sandbox directory
    const sandboxPath = path.join(
      FILE_CONFIG.sandboxDir,
      crypto.randomBytes(16).toString('hex')
    );
    
    await fs.mkdir(sandboxPath, { recursive: true });

    try {
      // Copy file to sandbox
      const sandboxFile = path.join(sandboxPath, path.basename(filePath));
      await fs.copyFile(filePath, sandboxFile);

      // In production, use proper sandboxing (Docker, VM, etc.)
      // This is a simulation
      const fileInfo = await fileTypeValidator.getFileInfo(sandboxFile);

      if (fileInfo.isExecutable) {
        return {
          safe: false,
          error: 'Executable files cannot be safely sandboxed',
        };
      }

      // Simulate sandbox execution
      return {
        safe: true,
        output: 'File executed safely in sandbox',
      };

    } finally {
      // Clean up sandbox
      await fs.rm(sandboxPath, { recursive: true, force: true });
    }
  }
}

const sandboxExecutor = new SandboxExecutor();

/**
 * File Upload Storage
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Create upload directory if it doesn't exist
    await fs.mkdir(FILE_CONFIG.uploadDir, { recursive: true });
    cb(null, FILE_CONFIG.uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate secure filename
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const sanitizedName = pathTraversalPrevention.sanitizeFilename(file.originalname);
    const ext = path.extname(sanitizedName);
    const baseName = path.basename(sanitizedName, ext);
    cb(null, `${baseName}-${uniqueSuffix}${ext}`);
  },
});

/**
 * File Filter
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Validate extension
  if (!fileTypeValidator.validateExtension(file.originalname)) {
    return cb(new Error(`File type not allowed: ${path.extname(file.originalname)}`));
  }

  // Validate MIME type
  if (!fileTypeValidator.validateMimeType(file.mimetype)) {
    return cb(new Error(`MIME type not allowed: ${file.mimetype}`));
  }

  // Check for double extensions
  const doubleExtPattern = /\.\w+\.\w+$/;
  if (doubleExtPattern.test(file.originalname)) {
    return cb(new Error('Double extensions not allowed'));
  }

  cb(null, true);
};

/**
 * Multer Upload Configuration
 */
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_CONFIG.maxFileSize,
    files: FILE_CONFIG.maxFiles,
    fields: 20,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024, // 1MB for text fields
  },
});

/**
 * Post-Upload Security Checks
 */
export const postUploadSecurity = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.files && !req.file) {
    return next();
  }

  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

  for (const file of files) {
    if (!file) continue;

    try {
      // Validate file path (prevent traversal)
      if (!pathTraversalPrevention.validatePath(file.path, FILE_CONFIG.uploadDir)) {
        await fs.unlink(file.path);
        return res.status(400).json({ error: 'Invalid file path' });
      }

      // Validate file signature matches extension
      const ext = path.extname(file.originalname).toLowerCase().substring(1);
      const validSignature = await fileTypeValidator.validateFileSignature(file.path, ext);
      
      if (!validSignature) {
        await fs.unlink(file.path);
        return res.status(400).json({ error: 'File content does not match extension' });
      }

      // Scan for viruses
      const scanResult = await virusScanner.scanFile(file.path);
      
      if (!scanResult.clean) {
        await virusScanner.quarantineFile(file.path, scanResult.threats.join(', '));
        return res.status(400).json({ 
          error: 'File failed security scan',
          threats: scanResult.threats,
        });
      }

      // Add security metadata to file object
      file['securityChecked'] = true;
      file['scanResult'] = scanResult;

      logger.info('File uploaded successfully', {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
      });

    } catch (error) {
      logger.error('Post-upload security check failed', error);
      
      // Clean up file on error
      try {
        await fs.unlink(file.path);
      } catch (unlinkError) {
        logger.error('Failed to delete file after security check failure', unlinkError);
      }

      return res.status(500).json({ error: 'Security check failed' });
    }
  }

  next();
};

/**
 * File Download Security
 */
export const secureFileDownload = async (req: Request, res: Response) => {
  const { filename } = req.params;

  // Validate filename
  if (!filename || !pathTraversalPrevention.validatePath(filename, FILE_CONFIG.uploadDir)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(FILE_CONFIG.uploadDir, pathTraversalPrevention.sanitizeFilename(filename));

  try {
    // Check if file exists
    await fs.access(filePath);

    // Get file info
    const stats = await fs.stat(filePath);
    
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    res.setHeader('Content-Length', stats.size.toString());

    // Stream file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    logger.error('File download error', error);
    return res.status(404).json({ error: 'File not found' });
  }
};

/**
 * File Deletion
 */
export const secureFileDelete = async (req: Request, res: Response) => {
  const { filename } = req.params;

  // Validate filename
  if (!filename || !pathTraversalPrevention.validatePath(filename, FILE_CONFIG.uploadDir)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(FILE_CONFIG.uploadDir, pathTraversalPrevention.sanitizeFilename(filename));

  try {
    // Check if file exists
    await fs.access(filePath);

    // Securely delete file (overwrite before deletion in production)
    await fs.unlink(filePath);

    logger.info('File deleted', { filename });
    res.json({ success: true });

  } catch (error) {
    logger.error('File deletion error', error);
    return res.status(404).json({ error: 'File not found' });
  }
};

/**
 * File List with Security
 */
export const listFiles = async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(FILE_CONFIG.uploadDir);
    
    const fileList = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(FILE_CONFIG.uploadDir, filename);
        const stats = await fs.stat(filePath);
        
        return {
          filename: pathTraversalPrevention.sanitizeFilename(filename),
          size: stats.size,
          uploadedAt: stats.mtime,
        };
      })
    );

    res.json({ files: fileList });

  } catch (error) {
    logger.error('File listing error', error);
    return res.status(500).json({ error: 'Failed to list files' });
  }
};

/**
 * Cleanup Old Files
 */
export const cleanupOldFiles = async () => {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  try {
    const files = await fs.readdir(FILE_CONFIG.uploadDir);
    const now = Date.now();

    for (const filename of files) {
      const filePath = path.join(FILE_CONFIG.uploadDir, filename);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.unlink(filePath);
        logger.info('Old file cleaned up', { filename });
      }
    }
  } catch (error) {
    logger.error('File cleanup error', error);
  }
};

// Schedule cleanup every day
setInterval(cleanupOldFiles, 24 * 60 * 60 * 1000);

export default {
  upload,
  postUploadSecurity,
  secureFileDownload,
  secureFileDelete,
  listFiles,
  virusScanner,
  fileTypeValidator,
  sandboxExecutor,
};