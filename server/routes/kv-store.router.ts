import { Router, Request, Response } from 'express';
import { replitDB } from '../database/replitdb';
import { createLogger } from '../utils/logger';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();
const logger = createLogger('kv-store');

const DEFAULT_PROJECT_ID = 1;
const MAX_SIZE = 50 * 1024 * 1024;

function getProjectId(req: Request): number {
  const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : DEFAULT_PROJECT_ID;
  return isNaN(projectId) ? DEFAULT_PROJECT_ID : projectId;
}

function detectType(value: any): 'string' | 'number' | 'boolean' | 'json' | 'binary' {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object') return 'json';
  return 'string';
}

function calculateSize(value: any): number {
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return new TextEncoder().encode(str).length;
}

router.get('/', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const keys = await replitDB.keys(projectId);
    
    const entries = await Promise.all(
      keys.map(async (key) => {
        const value = await replitDB.get(projectId, key);
        const type = detectType(value);
        const size = calculateSize(value);
        
        return {
          key,
          value,
          type,
          size,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      })
    );
    
    res.json(entries);
  } catch (error) {
    logger.error('Failed to list KV entries', { error });
    res.status(500).json({ error: 'Failed to list entries' });
  }
});

router.get('/stats', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const dbStats = await replitDB.getStats(projectId);
    const keys = await replitDB.keys(projectId);
    
    let totalSize = 0;
    let totalKeySize = 0;
    let totalValueSize = 0;
    
    for (const key of keys) {
      const value = await replitDB.get(projectId, key);
      const keySize = new TextEncoder().encode(key).length;
      const valueSize = calculateSize(value);
      
      totalKeySize += keySize;
      totalValueSize += valueSize;
      totalSize += keySize + valueSize;
    }
    
    const stats = {
      totalKeys: dbStats.keyCount,
      totalSize: totalSize,
      maxSize: MAX_SIZE,
      avgKeySize: keys.length > 0 ? Math.round(totalKeySize / keys.length) : 0,
      avgValueSize: keys.length > 0 ? Math.round(totalValueSize / keys.length) : 0,
      expiringKeys: 0
    };
    
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get KV stats', { error });
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.post('/', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const { key, value, type } = req.body;
    
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    await replitDB.set(projectId, key, value);
    
    const entry = {
      key,
      value,
      type: type || detectType(value),
      size: calculateSize(value),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    logger.info('KV entry created', { projectId, key });
    res.status(201).json(entry);
  } catch (error) {
    logger.error('Failed to create KV entry', { error });
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

router.put('/:key', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const key = decodeURIComponent(req.params.key);
    const { value, type } = req.body;
    
    const existing = await replitDB.get(projectId, key);
    if (existing === undefined) {
      return res.status(404).json({ error: 'Key not found' });
    }
    
    await replitDB.set(projectId, key, value);
    
    const entry = {
      key,
      value,
      type: type || detectType(value),
      size: calculateSize(value),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    logger.info('KV entry updated', { projectId, key });
    res.json(entry);
  } catch (error) {
    logger.error('Failed to update KV entry', { error });
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

router.delete('/bulk', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const { keys } = req.body;
    
    if (!Array.isArray(keys)) {
      return res.status(400).json({ error: 'Keys array is required' });
    }
    
    let deletedCount = 0;
    for (const key of keys) {
      const deleted = await replitDB.delete(projectId, key);
      if (deleted) deletedCount++;
    }
    
    logger.info('KV entries bulk deleted', { projectId, count: deletedCount });
    res.json({ deleted: deletedCount });
  } catch (error) {
    logger.error('Failed to bulk delete KV entries', { error });
    res.status(500).json({ error: 'Failed to delete entries' });
  }
});

router.delete('/:key', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const key = decodeURIComponent(req.params.key);
    
    const deleted = await replitDB.delete(projectId, key);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Key not found' });
    }
    
    logger.info('KV entry deleted', { projectId, key });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete KV entry', { error });
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

router.post('/import', ensureAuthenticated, async (req: Request, res: Response) => {
  try {
    const projectId = getProjectId(req);
    const { data } = req.body;
    
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Data object is required' });
    }
    
    let importedCount = 0;
    for (const [key, value] of Object.entries(data)) {
      await replitDB.set(projectId, key, value);
      importedCount++;
    }
    
    logger.info('KV data imported', { projectId, count: importedCount });
    res.json({ imported: importedCount });
  } catch (error) {
    logger.error('Failed to import KV data', { error });
    res.status(500).json({ error: 'Failed to import data' });
  }
});

export default router;
