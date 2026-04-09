import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { watch, FSWatcher } from 'chokidar';
import { createLogger } from '../../utils/logger';
import { chunkFile, detectLanguage, CodeChunk } from './chunker';
import { generateEmbedding, generateEmbeddingsBatch, isEmbeddingAvailable } from './embedding.service';
import {
  upsertChunk, deleteFileChunks, deleteProjectChunks,
  hybridSearch, searchByVector, searchByFTS, getProjectStats,
  setIndexStatus, getIndexStatus, SearchResult,
  getChunksByFilePaths, getExportedSymbolFiles, StoredChunk,
} from './vector-store';

const logger = createLogger('rag-engine');

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h', '.hpp',
  '.cs', '.rb', '.php', '.scala', '.lua', '.dart', '.ex', '.exs', '.erl',
  '.hs', '.ml', '.clj', '.zig', '.nim', '.v', '.r', '.R',
  '.css', '.scss', '.less', '.sass',
  '.html', '.htm', '.vue', '.svelte',
  '.json', '.yaml', '.yml', '.toml', '.xml',
  '.graphql', '.gql', '.proto', '.prisma',
  '.md', '.mdx', '.rst', '.txt',
  '.sql', '.sh', '.bash', '.zsh',
  '.dockerfile', '.env',
]);

const IGNORE_PATTERNS = [
  'node_modules', '.git', 'dist', 'build', '.next', 'out', 'coverage',
  '.DS_Store', '__pycache__', '.pytest_cache', '.mypy_cache',
  'vendor', 'target', '.cargo', 'bin', 'obj',
  '.ecode', '.vscode', '.idea', '.cache',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  '.env', '.env.local', '.env.production',
];

const MAX_FILE_SIZE = 512 * 1024;
const BATCH_SIZE = 20;
const INDEX_DEBOUNCE_MS = 1000;

export interface RAGEngineConfig {
  projectId: number;
  projectPath: string;
  enableWatcher?: boolean;
  autoIndex?: boolean;
}

export interface ContextChunk {
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  symbolName?: string;
  score: number;
  matchType: string;
}

export class RAGEngine extends EventEmitter {
  private projectId: number;
  private projectPath: string;
  private watcher: FSWatcher | null = null;
  private indexQueue: Set<string> = new Set();
  private debounceTimer: NodeJS.Timeout | null = null;
  private isIndexing = false;
  private fileHashes: Map<string, string> = new Map();

  constructor(config: RAGEngineConfig) {
    super();
    this.projectId = config.projectId;
    this.projectPath = config.projectPath;
  }

  async initialize(): Promise<void> {
    const status = await getIndexStatus(this.projectId);
    if (status?.fileHashes) {
      const hashes = status.fileHashes as unknown as Record<string, string>;
      for (const [k, v] of Object.entries(hashes)) {
        this.fileHashes.set(k, v as string);
      }
    }
    logger.info(`RAG engine initialized for project ${this.projectId}`);
  }

  async indexProject(force = false): Promise<{ filesIndexed: number; chunksCreated: number; errors: number }> {
    if (this.isIndexing) {
      logger.warn('Indexing already in progress');
      return { filesIndexed: 0, chunksCreated: 0, errors: 0 };
    }

    this.isIndexing = true;
    this.emit('indexing:start', { projectId: this.projectId });

    await setIndexStatus(this.projectId, { indexingInProgress: true, errorCount: 0, lastError: null });

    let filesIndexed = 0;
    let chunksCreated = 0;
    let errors = 0;

    try {
      const files = await this.collectFiles(this.projectPath);

      await setIndexStatus(this.projectId, { totalFiles: files.length });

      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map(f => this.indexFile(f, force))
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            if (result.value.indexed) {
              filesIndexed++;
              chunksCreated += result.value.chunks;
            }
          } else {
            errors++;
            logger.error(`File indexing failed: ${result.reason}`);
          }
        }

        await setIndexStatus(this.projectId, {
          indexedFiles: filesIndexed,
          totalChunks: chunksCreated,
        });

        this.emit('indexing:progress', {
          projectId: this.projectId,
          filesIndexed,
          totalFiles: files.length,
          chunksCreated,
          errors,
        });
      }

      const hashObj: Record<string, string> = {};
      this.fileHashes.forEach((v, k) => { hashObj[k] = v; });

      await setIndexStatus(this.projectId, {
        indexingInProgress: false,
        indexedFiles: filesIndexed,
        totalChunks: chunksCreated,
        lastIndexedAt: new Date().toISOString(),
        errorCount: errors,
        lastError: null,
        fileHashes: hashObj,
      });

      logger.info(`Project ${this.projectId} indexed: ${filesIndexed} files, ${chunksCreated} chunks, ${errors} errors`);
    } catch (error: any) {
      await setIndexStatus(this.projectId, {
        indexingInProgress: false,
        lastError: error.message,
        errorCount: errors,
      });
      throw error;
    } finally {
      this.isIndexing = false;
      this.emit('indexing:complete', { projectId: this.projectId, filesIndexed, chunksCreated, errors });
    }

    return { filesIndexed, chunksCreated, errors };
  }

  async indexFile(filePath: string, force = false): Promise<{ indexed: boolean; chunks: number }> {
    const relativePath = path.relative(this.projectPath, filePath);

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_FILE_SIZE) return { indexed: false, chunks: 0 };
      if (stat.size === 0) return { indexed: false, chunks: 0 };

      const content = await fs.readFile(filePath, 'utf-8');
      const hash = crypto.createHash('md5').update(content).digest('hex');

      if (!force && this.fileHashes.get(relativePath) === hash) {
        return { indexed: false, chunks: 0 };
      }

      const chunks = chunkFile(content, relativePath);
      if (chunks.length === 0) return { indexed: false, chunks: 0 };

      await deleteFileChunks(this.projectId, relativePath);

      const textsForEmbedding = chunks.map(c => {
        const prefix = c.symbolName ? `${c.symbolType || c.chunkType} ${c.symbolName} in ${relativePath}:\n` : `${relativePath}:\n`;
        return prefix + c.content;
      });

      let embeddings: (number[] | null)[] = [];
      if (isEmbeddingAvailable()) {
        embeddings = await generateEmbeddingsBatch(textsForEmbedding);
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await upsertChunk({
          id: `${this.projectId}_${relativePath}_${chunk.chunkIndex}`,
          projectId: this.projectId,
          filePath: relativePath,
          chunkIndex: chunk.chunkIndex,
          chunkType: chunk.chunkType,
          content: chunk.content,
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbolName: chunk.symbolName,
          symbolType: chunk.symbolType,
          imports: chunk.imports,
          exports: chunk.exports,
          embedding: embeddings[i] || null,
          fileHash: hash,
          metadata: {
            totalChunks: chunks.length,
            fileSize: stat.size,
          },
        });
      }

      this.fileHashes.set(relativePath, hash);
      return { indexed: true, chunks: chunks.length };
    } catch (error: any) {
      logger.error(`Failed to index ${relativePath}: ${error.message}`);
      throw error;
    }
  }

  async removeFile(filePath: string): Promise<void> {
    const relativePath = path.relative(this.projectPath, filePath);
    await deleteFileChunks(this.projectId, relativePath);
    this.fileHashes.delete(relativePath);
  }

  async search(query: string, options: {
    limit?: number;
    fileFilter?: string;
    mode?: 'hybrid' | 'vector' | 'fts';
    minScore?: number;
  } = {}): Promise<SearchResult[]> {
    const { limit = 10, fileFilter, mode = 'hybrid', minScore = 0.1 } = options;

    let queryEmbedding: number[] | null = null;
    if ((mode === 'hybrid' || mode === 'vector') && isEmbeddingAvailable()) {
      queryEmbedding = await generateEmbedding(query);
    }

    let results: SearchResult[];
    switch (mode) {
      case 'vector':
        results = queryEmbedding
          ? await searchByVector(this.projectId, queryEmbedding, limit, minScore, fileFilter)
          : [];
        break;
      case 'fts':
        results = await searchByFTS(this.projectId, query, limit, fileFilter);
        break;
      default:
        results = await hybridSearch(this.projectId, query, queryEmbedding, limit, fileFilter);
    }

    return this.rerank(results, query);
  }

  async getContextForPrompt(
    query: string,
    maxTokens: number = 8000,
    options: { fileFilter?: string; includeImports?: boolean } = {}
  ): Promise<{ context: string; chunks: ContextChunk[]; tokenEstimate: number }> {
    const results = await this.search(query, {
      limit: 30,
      fileFilter: options.fileFilter,
      mode: 'hybrid',
    });

    const selectedChunks: ContextChunk[] = [];
    let tokenCount = 0;
    const seenFiles = new Set<string>();
    const seenContent = new Set<string>();

    for (const result of results) {
      const chunk = result.chunk;
      const contentHash = crypto.createHash('md5').update(chunk.content).digest('hex');
      if (seenContent.has(contentHash)) continue;
      seenContent.add(contentHash);

      const chunkTokens = Math.ceil(chunk.content.length / 4);
      if (tokenCount + chunkTokens > maxTokens) continue;

      selectedChunks.push({
        filePath: chunk.filePath,
        content: chunk.content,
        language: chunk.language,
        startLine: chunk.startLine || 0,
        endLine: chunk.endLine || 0,
        symbolName: chunk.symbolName || undefined,
        score: result.score,
        matchType: result.matchType,
      });

      tokenCount += chunkTokens;
      seenFiles.add(chunk.filePath);

      if (options.includeImports && chunk.imports && chunk.imports.length > 0) {
        const importContext = chunk.imports.join('\n');
        const importTokens = Math.ceil(importContext.length / 4);
        if (tokenCount + importTokens <= maxTokens) {
          tokenCount += importTokens;
        }
      }
    }

    if (options.includeImports !== false && selectedChunks.length > 0) {
      const depTokenBudget = Math.min(maxTokens - tokenCount, Math.floor(maxTokens * 0.35));
      if (depTokenBudget > 500) {
        try {
          const depResult = await this.resolveImportGraph(
            selectedChunks,
            2,
            12,
            depTokenBudget
          );

          for (const depChunk of depResult.chunks) {
            const contentHash = crypto.createHash('md5').update(depChunk.content).digest('hex');
            if (seenContent.has(contentHash)) continue;
            seenContent.add(contentHash);
            selectedChunks.push(depChunk);
            tokenCount += Math.ceil(depChunk.content.length / 4);
          }

          if (depResult.resolvedFiles.length > 0) {
            logger.debug(`Import graph resolved ${depResult.resolvedFiles.length} files, ${depResult.chunks.length} chunks (${depResult.tokenEstimate} tokens)`);
          }
        } catch (err: any) {
          logger.warn(`Import graph resolution failed: ${err.message}`);
        }
      }
    }

    selectedChunks.sort((a, b) => {
      if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
      return a.startLine - b.startLine;
    });

    let context = '=== CODEBASE CONTEXT (RAG) ===\n';
    let currentFile = '';
    const depFiles = new Set<string>();
    for (const chunk of selectedChunks) {
      if (chunk.matchType?.startsWith('dep-')) depFiles.add(chunk.filePath);
      if (chunk.filePath !== currentFile) {
        currentFile = chunk.filePath;
        const isDep = depFiles.has(chunk.filePath);
        context += `\n--- ${chunk.filePath} (${chunk.language})${isDep ? ' [dependency]' : ''} ---\n`;
      }
      if (chunk.symbolName) {
        context += `[${chunk.symbolName}] L${chunk.startLine}-${chunk.endLine}:\n`;
      }
      context += chunk.content + '\n';
    }
    context += '\n=== END CODEBASE CONTEXT ===\n';

    return { context, chunks: selectedChunks, tokenEstimate: tokenCount };
  }

  async resolveImportGraph(
    seedChunks: ContextChunk[],
    maxDepth: number = 2,
    maxFiles: number = 15,
    maxTokens: number = 4000
  ): Promise<{ chunks: ContextChunk[]; resolvedFiles: string[]; tokenEstimate: number }> {
    const visitedFiles = new Set<string>(seedChunks.map(c => c.filePath));
    const resultChunks: ContextChunk[] = [];
    let tokenCount = 0;

    const allImports: string[] = [];
    for (const chunk of seedChunks) {
      const rawImports = this.extractImportPaths(chunk.content, chunk.language);
      allImports.push(...rawImports);
    }

    let frontier = this.resolveImportsToPaths(allImports, seedChunks[0]?.filePath || '');

    for (let depth = 0; depth < maxDepth && frontier.length > 0 && visitedFiles.size < maxFiles; depth++) {
      const unvisited = frontier.filter(f => !visitedFiles.has(f));
      if (unvisited.length === 0) break;

      const batch = unvisited.slice(0, maxFiles - visitedFiles.size);
      for (const f of batch) visitedFiles.add(f);

      let depChunks: StoredChunk[];
      try {
        depChunks = await getChunksByFilePaths(this.projectId, batch, {
          chunkTypes: ['function', 'class', 'interface', 'type', 'export', 'method'],
        });
      } catch {
        depChunks = [];
      }

      const nextImports: string[] = [];

      for (const dc of depChunks) {
        const chunkTokens = Math.ceil(dc.content.length / 4);
        if (tokenCount + chunkTokens > maxTokens) break;

        resultChunks.push({
          filePath: dc.filePath,
          content: dc.content,
          language: dc.language,
          startLine: dc.startLine || 0,
          endLine: dc.endLine || 0,
          symbolName: dc.symbolName || undefined,
          score: 0.5 - depth * 0.1,
          matchType: `dep-d${depth}`,
        });
        tokenCount += chunkTokens;

        if (depth < maxDepth - 1 && dc.imports && dc.imports.length > 0) {
          nextImports.push(...this.extractImportPaths(dc.content, dc.language));
        }
      }

      frontier = this.resolveImportsToPaths(nextImports, batch[0] || '');
    }

    const importedSymbols = this.extractImportedSymbols(allImports);
    if (importedSymbols.length > 0 && tokenCount < maxTokens) {
      try {
        const symbolFileMap = await getExportedSymbolFiles(this.projectId, importedSymbols);
        const extraFiles: string[] = [];
        for (const [, files] of symbolFileMap) {
          for (const f of files) {
            if (!visitedFiles.has(f)) {
              extraFiles.push(f);
              visitedFiles.add(f);
            }
          }
        }

        if (extraFiles.length > 0) {
          const extraChunks = await getChunksByFilePaths(this.projectId, extraFiles.slice(0, 5), {
            chunkTypes: ['function', 'class', 'interface', 'type', 'export'],
          });

          for (const ec of extraChunks) {
            const chunkTokens = Math.ceil(ec.content.length / 4);
            if (tokenCount + chunkTokens > maxTokens) break;

            resultChunks.push({
              filePath: ec.filePath,
              content: ec.content,
              language: ec.language,
              startLine: ec.startLine || 0,
              endLine: ec.endLine || 0,
              symbolName: ec.symbolName || undefined,
              score: 0.3,
              matchType: 'dep-symbol',
            });
            tokenCount += chunkTokens;
          }
        }
      } catch {
      }
    }

    return {
      chunks: resultChunks,
      resolvedFiles: Array.from(visitedFiles),
      tokenEstimate: tokenCount,
    };
  }

  private extractImportPaths(content: string, language: string): string[] {
    const paths: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      let match: RegExpMatchArray | null = null;

      if (language === 'typescript' || language === 'javascript') {
        match = trimmed.match(/(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/);
        if (!match) match = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (!match) match = trimmed.match(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      } else if (language === 'python') {
        match = trimmed.match(/^from\s+(\S+)\s+import/);
        if (!match) match = trimmed.match(/^import\s+(\S+)/);
      } else if (language === 'go') {
        match = trimmed.match(/["']([^"']+)["']/);
      } else if (language === 'rust') {
        match = trimmed.match(/^use\s+(\S+)/);
      }

      if (match && match[1]) {
        paths.push(match[1]);
      }
    }

    return paths;
  }

  private extractImportedSymbols(importStatements: string[]): string[] {
    const symbols: string[] = [];
    for (const imp of importStatements) {
      const namedMatch = imp.match(/\{\s*([^}]+)\s*\}/);
      if (namedMatch) {
        const names = namedMatch[1].split(',').map(s => {
          const parts = s.trim().split(/\s+as\s+/);
          return parts[0].trim();
        }).filter(s => s.length > 0 && s !== 'type');
        symbols.push(...names);
      }

      const defaultMatch = imp.match(/import\s+([A-Za-z_$][\w$]*)\s+from/);
      if (defaultMatch && defaultMatch[1] !== 'type') {
        symbols.push(defaultMatch[1]);
      }
    }
    return [...new Set(symbols)];
  }

  private resolveImportsToPaths(importPaths: string[], contextFilePath: string): string[] {
    const resolved: string[] = [];
    const contextDir = path.dirname(contextFilePath);
    const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
    const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

    for (const imp of importPaths) {
      if (!imp.startsWith('.') && !imp.startsWith('@')) continue;

      let target = imp;
      if (imp.startsWith('@/') || imp.startsWith('@shared/')) {
        target = imp.replace(/^@\//, 'src/').replace(/^@shared\//, 'shared/');
      } else if (imp.startsWith('./') || imp.startsWith('../')) {
        target = path.posix.join(contextDir, imp);
      } else {
        continue;
      }

      target = target.replace(/\\/g, '/');

      const ext = path.extname(target);
      if (ext && SUPPORTED_EXTENSIONS.has(ext)) {
        resolved.push(target);
      } else {
        for (const e of TS_EXTENSIONS) {
          resolved.push(target + e);
        }
        for (const idx of INDEX_FILES) {
          resolved.push(target + '/' + idx);
        }
      }
    }

    return [...new Set(resolved)];
  }

  startWatcher(): void {
    if (this.watcher) return;

    try {
      const ignoredGlobs = IGNORE_PATTERNS.map(p => `**/${p}/**`);

      this.watcher = watch(this.projectPath, {
        ignored: ignoredGlobs,
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
        depth: 10,
      });

      this.watcher
        .on('add', (fp: string) => this.onFileChange(fp))
        .on('change', (fp: string) => this.onFileChange(fp))
        .on('unlink', (fp: string) => this.onFileDelete(fp))
        .on('error', (err: Error) => logger.error('Watcher error:', err));

      logger.info(`File watcher started for project ${this.projectId}`);
    } catch (error: any) {
      logger.error(`Failed to start watcher: ${error.message}`);
    }
  }

  stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      logger.info(`File watcher stopped for project ${this.projectId}`);
    }
  }

  private onFileChange(filePath: string): void {
    if (!this.isSupported(filePath)) return;
    this.indexQueue.add(filePath);
    this.scheduleFlush();
  }

  private onFileDelete(filePath: string): void {
    if (!this.isSupported(filePath)) return;
    this.removeFile(filePath).catch(err =>
      logger.error(`Failed to remove deleted file ${filePath}: ${err.message}`)
    );
    this.emit('file:removed', { filePath: path.relative(this.projectPath, filePath) });
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.flushQueue(), INDEX_DEBOUNCE_MS);
  }

  private async flushQueue(): Promise<void> {
    if (this.indexQueue.size === 0) return;

    const files = Array.from(this.indexQueue);
    this.indexQueue.clear();

    let indexed = 0;
    for (const fp of files) {
      try {
        const result = await this.indexFile(fp, false);
        if (result.indexed) indexed++;
        this.emit('file:indexed', {
          filePath: path.relative(this.projectPath, fp),
          chunks: result.chunks,
        });
      } catch (err: any) {
        logger.error(`Incremental index failed for ${fp}: ${err.message}`);
      }
    }

    if (indexed > 0) {
      const hashObj: Record<string, string> = {};
      this.fileHashes.forEach((v, k) => { hashObj[k] = v; });
      await setIndexStatus(this.projectId, { fileHashes: hashObj }).catch(() => {});
    }
  }

  private rerank(results: SearchResult[], query: string): SearchResult[] {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const querySymbols = query.match(/[A-Z][a-z]+|[a-z]+/g) || [];

    return results.map(r => {
      let boost = 0;

      const contentLower = r.chunk.content.toLowerCase();
      for (const term of queryTerms) {
        if (contentLower.includes(term)) boost += 0.05;
      }

      if (r.chunk.symbolName) {
        const symLower = r.chunk.symbolName.toLowerCase();
        for (const qs of querySymbols) {
          if (symLower.includes(qs.toLowerCase())) boost += 0.15;
        }
      }

      const typeBoosts: Record<string, number> = {
        function: 0.1, class: 0.08, interface: 0.06, type: 0.05,
        method: 0.1, export: 0.04, import: -0.05, block: 0, config: 0.02,
      };
      boost += typeBoosts[r.chunk.chunkType] || 0;

      if (r.chunk.exports && r.chunk.exports.length > 0) boost += 0.03;

      const pathParts = r.chunk.filePath.toLowerCase().split('/');
      for (const term of queryTerms) {
        if (pathParts.some(p => p.includes(term))) boost += 0.1;
      }

      return { ...r, score: r.score + boost };
    }).sort((a, b) => b.score - a.score);
  }

  private async collectFiles(dir: string, result: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectPath, fullPath);

        if (this.shouldIgnore(relativePath, entry.name)) continue;

        if (entry.isDirectory()) {
          await this.collectFiles(fullPath, result);
        } else if (this.isSupported(entry.name)) {
          result.push(fullPath);
        }
      }
    } catch (error: any) {
      logger.warn(`Cannot read directory ${dir}: ${error.message}`);
    }
    return result;
  }

  private shouldIgnore(relativePath: string, name: string): boolean {
    return IGNORE_PATTERNS.some(pattern => {
      if (name === pattern) return true;
      if (relativePath.includes(`/${pattern}/`) || relativePath.startsWith(`${pattern}/`)) return true;
      return false;
    });
  }

  private isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    if (basename === 'dockerfile' || basename === 'makefile') return true;
    return SUPPORTED_EXTENSIONS.has(ext);
  }

  async getStats() {
    return getProjectStats(this.projectId);
  }

  async getStatus() {
    return getIndexStatus(this.projectId);
  }

  destroy(): void {
    this.stopWatcher();
    this.removeAllListeners();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }
}

const engines = new Map<number, RAGEngine>();

export function getOrCreateEngine(projectId: number, projectPath: string): RAGEngine {
  let engine = engines.get(projectId);
  if (!engine) {
    engine = new RAGEngine({ projectId, projectPath });
    engines.set(projectId, engine);
  }
  return engine;
}

export function getEngine(projectId: number): RAGEngine | undefined {
  return engines.get(projectId);
}

export function removeEngine(projectId: number): void {
  const engine = engines.get(projectId);
  if (engine) {
    engine.destroy();
    engines.delete(projectId);
  }
}
