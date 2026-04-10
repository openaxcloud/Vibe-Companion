import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { fileTypeFromBuffer } from 'file-type';
import { createLogger } from '../utils/logger';

const logger = createLogger('upload-validation');

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/plain', 'text/javascript', 'text/typescript',
  'application/json', 'application/javascript',
  'text/css', 'text/html', 'text/markdown', 'text/csv',
  'text/x-python', 'application/xml', 'text/yaml',
  'application/zip',
];

const ALLOWED_TYPES: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/json': ['.json'],
  'application/zip': ['.zip'],
  'text/javascript': ['.js', '.mjs'],
  'application/javascript': ['.js', '.mjs'],
  'text/typescript': ['.ts', '.tsx'],
  'text/css': ['.css'],
  'text/html': ['.html', '.htm'],
  'text/markdown': ['.md'],
  'text/x-python': ['.py'],
  'application/xml': ['.xml'],
  'text/yaml': ['.yaml', '.yml'],
};

const MAGIC_BYTES: Record<string, Buffer> = {
  'image/jpeg': Buffer.from([0xFF, 0xD8, 0xFF]),
  'image/png': Buffer.from([0x89, 0x50, 0x4E, 0x47]),
  'image/gif': Buffer.from([0x47, 0x49, 0x46]),
  'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]),
  'application/zip': Buffer.from([0x50, 0x4B, 0x03, 0x04]),
};

export function sanitizeFilename(filename: string): string {
  const sanitized = path.basename(filename)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
  
  return sanitized || 'unnamed_file';
}

export function validateMimeType(mimetype: string, extension: string): boolean {
  const allowedExtensions = ALLOWED_TYPES[mimetype];
  if (!allowedExtensions) {
    return false;
  }
  return allowedExtensions.includes(extension.toLowerCase());
}

export function validateMagicBytes(buffer: Buffer, mimetype: string): boolean {
  const expected = MAGIC_BYTES[mimetype];
  if (!expected) {
    return true;
  }
  return buffer.subarray(0, expected.length).equals(expected);
}

export const secureFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!validateMimeType(file.mimetype, ext)) {
    logger.warn('File upload rejected - invalid type', {
      mimetype: file.mimetype,
      extension: ext,
      filename: file.originalname,
    });
    return cb(new Error(`File type ${file.mimetype} not allowed`));
  }
  
  file.originalname = sanitizeFilename(file.originalname);
  
  cb(null, true);
};

const SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  default: 25 * 1024 * 1024,
};

export const uploadLimits = {
  fileSize: SIZE_LIMITS.default,
  files: 10,
};

export const createSecureUpload = () => {
  return multer({
    fileFilter: secureFileFilter,
    limits: uploadLimits,
    storage: multer.memoryStorage(),
  });
};

export const validateUploadedFile = (buffer: Buffer, mimetype: string): { valid: boolean; error?: string } => {
  if (!validateMagicBytes(buffer, mimetype)) {
    logger.warn('File upload rejected - magic bytes mismatch', { mimetype });
    return { valid: false, error: 'File content does not match declared type' };
  }
  return { valid: true };
};

export async function validateUpload(buffer: Buffer, declaredMime: string): Promise<{ valid: boolean; error?: string }> {
  const detected = await fileTypeFromBuffer(buffer);
  
  if (!detected && declaredMime.startsWith('text/')) {
    if (!ALLOWED_MIME_TYPES.includes(declaredMime)) {
      logger.warn('File upload rejected - mime type not allowed', { declaredMime });
      return { valid: false, error: `File type ${declaredMime} is not allowed` };
    }
    return { valid: true };
  }
  
  if (!detected && declaredMime.startsWith('application/json')) {
    return { valid: true };
  }
  
  if (detected && !ALLOWED_MIME_TYPES.includes(detected.mime)) {
    logger.warn('File upload rejected - detected type not allowed', { detected: detected.mime, declared: declaredMime });
    return { valid: false, error: `Detected file type ${detected.mime} is not allowed` };
  }
  
  if (detected && detected.mime !== declaredMime) {
    logger.warn('MIME mismatch detected', { declared: declaredMime, detected: detected.mime });
    return { valid: false, error: `MIME type mismatch: declared ${declaredMime}, but file is ${detected.mime}` };
  }
  
  if (!detected && !ALLOWED_MIME_TYPES.includes(declaredMime)) {
    logger.warn('File upload rejected - undetectable and not allowed', { declaredMime });
    return { valid: false, error: `File type ${declaredMime} is not allowed` };
  }
  
  return { valid: true };
}
