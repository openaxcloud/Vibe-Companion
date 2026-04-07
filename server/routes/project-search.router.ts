import { Router } from 'express';
import { z } from 'zod';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();
const logger = createLogger('project-search');

router.use(ensureAuthenticated);

const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  caseSensitive: z.string().optional().transform(v => v === 'true'),
  useRegex: z.string().optional().transform(v => v === 'true'),
  type: z.enum(['all', 'files', 'code', 'symbols']).optional().default('all'),
});

interface SearchMatch {
  line: number;
  column: number;
  text: string;
  matchText: string;
}

interface SearchResult {
  id: string;
  file: string;
  line: number;
  column: number;
  match: string;
  preview: string;
  type: 'file' | 'code' | 'symbol';
}

function searchInContent(
  content: string,
  query: string,
  options: { caseSensitive?: boolean; useRegex?: boolean }
): SearchMatch[] {
  const matches: SearchMatch[] = [];
  const lines = content.split('\n');

  let searchRegex: RegExp;
  
  try {
    if (options.useRegex) {
      searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escapedQuery, options.caseSensitive ? 'g' : 'gi');
    }
  } catch (e) {
    return matches;
  }

  lines.forEach((lineText, lineIndex) => {
    let match;
    searchRegex.lastIndex = 0;
    while ((match = searchRegex.exec(lineText)) !== null) {
      matches.push({
        line: lineIndex + 1,
        column: match.index + 1,
        text: lineText,
        matchText: match[0]
      });
      if (!searchRegex.global) break;
    }
  });

  return matches;
}

function isSymbolMatch(lineText: string, match: string): boolean {
  const symbolPatterns = [
    /^(export\s+)?(async\s+)?function\s+/,
    /^(export\s+)?(const|let|var)\s+\w+\s*=/,
    /^(export\s+)?class\s+/,
    /^(export\s+)?interface\s+/,
    /^(export\s+)?type\s+/,
    /^(export\s+)?enum\s+/,
    /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?[\w<>]+\s*\(/,
  ];
  return symbolPatterns.some(pattern => pattern.test(lineText.trim()));
}

router.get('/:projectId/search', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const parsed = searchQuerySchema.safeParse(req.query);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }

    const { q: query, caseSensitive, useRegex, type } = parsed.data;
    
    const files = await storage.getProjectFiles(projectId);
    const results: SearchResult[] = [];
    let resultId = 0;

    const excludePatterns = ['node_modules', 'dist', '.git', '.next', 'build', 'coverage'];

    for (const file of files) {
      if (excludePatterns.some(pattern => file.path.includes(pattern))) {
        continue;
      }
      if (file.isDirectory) continue;
      
      const content = file.content || '';
      const matches = searchInContent(content, query, { caseSensitive, useRegex });

      for (const match of matches) {
        const matchType: 'file' | 'code' | 'symbol' = isSymbolMatch(match.text, match.matchText) ? 'symbol' : 'code';
        
        if (type !== 'all' && type !== 'code' && type !== 'symbols') continue;
        if (type === 'symbols' && matchType !== 'symbol') continue;
        
        results.push({
          id: String(++resultId),
          file: file.path,
          line: match.line,
          column: match.column,
          match: match.matchText,
          preview: match.text.trim(),
          type: matchType
        });

        if (results.length >= 100) break;
      }
      
      if (results.length >= 100) break;
    }

    res.json({
      results,
      totalResults: results.length,
      query
    });
  } catch (error: any) {
    logger.error('Project search error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:projectId/files', async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const parsed = searchQuerySchema.safeParse(req.query);
    
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid query parameters', details: parsed.error.errors });
    }

    const { q: query, caseSensitive } = parsed.data;
    
    const files = await storage.getProjectFiles(projectId);
    const results: SearchResult[] = [];
    let resultId = 0;

    const excludePatterns = ['node_modules', 'dist', '.git', '.next', 'build', 'coverage'];

    const searchQuery = caseSensitive ? query : query.toLowerCase();

    for (const file of files) {
      if (excludePatterns.some(pattern => file.path.includes(pattern))) {
        continue;
      }
      if (file.isDirectory) continue;
      
      const fileName = file.name || file.path.split('/').pop() || '';
      const fileNameToSearch = caseSensitive ? fileName : fileName.toLowerCase();
      
      if (fileNameToSearch.includes(searchQuery)) {
        results.push({
          id: String(++resultId),
          file: file.path,
          line: 1,
          column: 1,
          match: fileName,
          preview: file.path,
          type: 'file'
        });

        if (results.length >= 50) break;
      }
    }

    res.json({
      results,
      totalResults: results.length,
      query
    });
  } catch (error: any) {
    logger.error('Project file search error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
