import compression from 'compression';
import { Request, Response } from 'express';
import * as zlib from 'zlib';

// Compression middleware for Cloud Run optimization
export const compressionMiddleware = compression({
  // Only compress responses above 1kb
  threshold: 1024,
  
  // Compression level (1-9, 6 is good balance)
  level: 6,
  
  // Only compress specific MIME types
  filter: (req: Request, res: Response) => {
    // Don't compress responses if the client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Use compression filter
    return compression.filter(req, res);
  },
  
  // Memory level (1-9, 8 is good for production)
  memLevel: 8,
  
  // Window bits (9-15, 15 is maximum compression)
  windowBits: 15,
  
  // Compression strategy
  strategy: zlib.constants.Z_DEFAULT_STRATEGY
});

export default compressionMiddleware;