import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ensureAuthenticated } from '../middleware/auth';
import { csrfProtection } from '../middleware/csrf';

const router = Router();
const logger = createLogger('global-search');

/**
 * ✅ 40-YEAR SENIOR SECURITY FIX
 * Global search/replace is a CRITICAL operation - requires authentication
 * Replace operation can modify ALL files in a project
 */
router.use(ensureAuthenticated);

/**
 * CSRF protection for replace operations (mutating)
 */
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return csrfProtection(req, res, next);
  }
  return next();
});

const searchSchema = z.object({
  query: z.string().min(1).max(500),
  projectId: z.string(),
  caseSensitive: z.boolean().optional().default(false),
  wholeWord: z.boolean().optional().default(false),
  useRegex: z.boolean().optional().default(false),
  filePattern: z.string().optional(), // e.g., "*.ts,*.tsx"
  excludePattern: z.string().optional() // e.g., "node_modules,dist"
});

const replaceSchema = z.object({
  query: z.string().min(1).max(500),
  replacement: z.string().max(500),
  projectId: z.string(),
  caseSensitive: z.boolean().optional().default(false),
  wholeWord: z.boolean().optional().default(false),
  useRegex: z.boolean().optional().default(false),
  filePattern: z.string().optional(),
  excludePattern: z.string().optional(),
  filePaths: z.array(z.string()).optional() // Specific files to replace in
});

interface SearchResult {
  filePath: string;
  matches: {
    line: number;
    column: number;
    text: string;
    matchText: string;
  }[];
  totalMatches: number;
}

interface ReplaceResult {
  filePath: string;
  replacements: number;
  success: boolean;
  error?: string;
}

/**
 * Search across all files in a project
 * POST /api/search/global
 */
router.post('/global', async (req, res) => {
  try {
    const {
      query,
      projectId,
      caseSensitive,
      wholeWord,
      useRegex,
      filePattern,
      excludePattern
    } = searchSchema.parse(req.body);

    // Get all files in project
    const files = await storage.getProjectFiles(projectId);
    
    const results: SearchResult[] = [];
    const excludePatterns = excludePattern?.split(',').map(p => p.trim()) || ['node_modules', 'dist', '.git'];
    const includePatterns = filePattern?.split(',').map(p => p.trim()) || [];

    for (const file of files) {
      // Skip excluded files
      if (excludePatterns.some(pattern => file.path.includes(pattern))) {
        continue;
      }

      // Check file pattern if specified
      if (includePatterns.length > 0) {
        const matchesPattern = includePatterns.some(pattern => {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(file.path);
        });
        if (!matchesPattern) continue;
      }

      // Skip directories and binary files
      if (file.isDirectory) continue;
      
      // Search in file content
      const content = file.content || '';
      const matches = searchInContent(content, query, {
        caseSensitive,
        wholeWord,
        useRegex
      });

      if (matches.length > 0) {
        results.push({
          filePath: file.path,
          matches,
          totalMatches: matches.length
        });
      }
    }

    res.json({
      results,
      totalFiles: results.length,
      totalMatches: results.reduce((sum, r) => sum + r.totalMatches, 0),
      query
    });
  } catch (error: any) {
    logger.error('Global search error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Replace text across multiple files
 * POST /api/search/replace
 */
router.post('/replace', async (req, res) => {
  try {
    const {
      query,
      replacement,
      projectId,
      caseSensitive,
      wholeWord,
      useRegex,
      filePattern,
      excludePattern,
      filePaths
    } = replaceSchema.parse(req.body);

    // Get files to replace in
    let files = await storage.getProjectFiles(projectId);
    
    // Filter to specific files if provided
    if (filePaths && filePaths.length > 0) {
      files = files.filter(f => filePaths.includes(f.path));
    }

    const excludePatterns = excludePattern?.split(',').map(p => p.trim()) || ['node_modules', 'dist', '.git'];
    const includePatterns = filePattern?.split(',').map(p => p.trim()) || [];

    const results: ReplaceResult[] = [];

    for (const file of files) {
      try {
        // Skip directories and excluded files
        if (file.isDirectory) continue;
        
        if (excludePatterns.some(pattern => file.path.includes(pattern))) {
          continue;
        }

        // Check file pattern if specified
        if (includePatterns.length > 0) {
          const matchesPattern = includePatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(file.path);
          });
          if (!matchesPattern) continue;
        }

        // Perform replacement
        const content = file.content || '';
        const { newContent, count } = replaceInContent(content, query, replacement, {
          caseSensitive,
          wholeWord,
          useRegex
        });

        if (count > 0) {
          // Update file through storage interface (not direct fs)
          await storage.updateFile(file.id, { content: newContent });
          
          results.push({
            filePath: file.path,
            replacements: count,
            success: true
          });
        }
      } catch (error: any) {
        logger.error(`Replace failed for ${file.path}:`, error);
        results.push({
          filePath: file.path,
          replacements: 0,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      results,
      totalFiles: results.length,
      totalReplacements: results.reduce((sum, r) => sum + r.replacements, 0)
    });
  } catch (error: any) {
    logger.error('Global replace error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper: Search in content
 */
function searchInContent(
  content: string,
  query: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean; useRegex?: boolean }
): Array<{ line: number; column: number; text: string; matchText: string }> {
  const matches: Array<{ line: number; column: number; text: string; matchText: string }> = [];
  const lines = content.split('\n');

  let searchRegex: RegExp;
  
  if (options.useRegex) {
    searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
  } else {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
    searchRegex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
  }

  lines.forEach((lineText, lineIndex) => {
    let match;
    while ((match = searchRegex.exec(lineText)) !== null) {
      matches.push({
        line: lineIndex + 1,
        column: match.index + 1,
        text: lineText,
        matchText: match[0]
      });
    }
  });

  return matches;
}

/**
 * Helper: Replace in content
 */
function replaceInContent(
  content: string,
  query: string,
  replacement: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean; useRegex?: boolean }
): { newContent: string; count: number } {
  let count = 0;
  
  let searchRegex: RegExp;
  
  if (options.useRegex) {
    searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
  } else {
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
    searchRegex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
  }

  const newContent = content.replace(searchRegex, (match) => {
    count++;
    return replacement;
  });

  return { newContent, count };
}

export default router;
