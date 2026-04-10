import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { memoryMCP } from '../mcp/servers/memory-mcp';
import { db } from '../db';
import { agentSessions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';
import * as path from 'path';
import {
  getOrCreateEngine, getEngine, isEmbeddingAvailable,
  getProjectStats,
} from '../services/rag/index';

const router = Router();
const logger = createLogger('rag-router');

function getProjectPath(projectId: number | string): string {
  return path.join(process.cwd(), 'projects', String(projectId));
}

router.get('/stats', async (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({
      embeddingsCount: 0,
      nodesCount: 0,
      edgesCount: 0,
      conversationsCount: 0,
      lastUpdated: null,
      isAvailable: isEmbeddingAvailable(),
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
      }
    });
  }
  try {
    let nodesCount = 0;
    let edgesCount = 0;
    let conversationsCount = 0;
    let lastUpdated: string | null = null;

    try {
      const nodesResult = await db.execute(sql`SELECT COUNT(*) as count FROM knowledge_graph_nodes`) as unknown as { rows: { count: string }[] };
      nodesCount = parseInt(nodesResult.rows[0]?.count || '0', 10);

      const edgesResult = await db.execute(sql`SELECT COUNT(*) as count FROM knowledge_graph_edges`) as unknown as { rows: { count: string }[] };
      edgesCount = parseInt(edgesResult.rows[0]?.count || '0', 10);

      const conversationsResult = await db.execute(sql`SELECT COUNT(DISTINCT session_id) as count FROM conversation_memory`) as unknown as { rows: { count: string }[] };
      conversationsCount = parseInt(conversationsResult.rows[0]?.count || '0', 10);

      const lastUpdateResult = await db.execute(sql`SELECT MAX(updated_at) as last_update FROM knowledge_graph_nodes`) as unknown as { rows: { last_update: string | null }[] };
      lastUpdated = lastUpdateResult.rows[0]?.last_update || null;
    } catch (dbError) {
      logger.warn('Knowledge graph tables may not exist yet:', dbError);
    }

    let embeddingsCount = 0;
    try {
      const embeddingsResult = await db.execute(sql`SELECT COUNT(*) as count FROM code_embeddings WHERE embedding IS NOT NULL`) as unknown as { rows: { count: string }[] };
      embeddingsCount = parseInt(embeddingsResult.rows[0]?.count || '0', 10);
    } catch { embeddingsCount = 0; }

    let totalChunks = 0;
    let totalFiles = 0;
    try {
      const chunksResult = await db.execute(sql`SELECT COUNT(*) as count FROM code_embeddings`) as unknown as { rows: { count: string }[] };
      totalChunks = parseInt(chunksResult.rows[0]?.count || '0', 10);
      const filesResult = await db.execute(sql`SELECT COUNT(DISTINCT file_path) as count FROM code_embeddings`) as unknown as { rows: { count: string }[] };
      totalFiles = parseInt(filesResult.rows[0]?.count || '0', 10);
    } catch { /* tables may not exist */ }

    res.json({
      embeddingsCount,
      nodesCount,
      edgesCount,
      conversationsCount,
      totalChunks,
      totalFiles,
      lastUpdated,
      isAvailable: isEmbeddingAvailable(),
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
      searchModes: ['hybrid', 'vector', 'fts'],
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
      }
    });
  } catch (error: any) {
    logger.error('Failed to get RAG stats:', error);
    res.status(500).json({ error: 'Failed to get RAG statistics', message: error.message });
  }
});

router.post('/index', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, force = false } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const projectPath = getProjectPath(projectId);
    const engine = getOrCreateEngine(Number(projectId), projectPath);
    await engine.initialize();

    res.json({ status: 'started', projectId, message: 'Indexing started in background' });

    engine.indexProject(force).catch(err =>
      logger.error(`Background indexing failed for project ${projectId}: ${err.message}`)
    );
  } catch (error: any) {
    logger.error('Failed to start indexing:', error);
    res.status(500).json({ error: 'Failed to start indexing', message: error.message });
  }
});

router.post('/index-file', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId, filePath, force = false } = req.body;
    if (!projectId || !filePath) return res.status(400).json({ error: 'projectId and filePath are required' });

    const projectPath = getProjectPath(projectId);
    const engine = getOrCreateEngine(Number(projectId), projectPath);
    await engine.initialize();

    const fullPath = path.join(projectPath, filePath);
    const result = await engine.indexFile(fullPath, force);

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error('Failed to index file:', error);
    res.status(500).json({ error: 'Failed to index file', message: error.message });
  }
});

router.post('/search', ensureAuthenticated, async (req, res) => {
  try {
    const { query, projectId, limit = 10, mode = 'hybrid', fileFilter, minScore = 0.1 } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const projectPath = getProjectPath(projectId);
    const engine = getOrCreateEngine(Number(projectId), projectPath);
    await engine.initialize();

    const results = await engine.search(query, {
      limit: Math.min(limit, 50),
      fileFilter,
      mode,
      minScore,
    });

    res.json({
      query,
      projectId,
      mode,
      results: results.map(r => ({
        id: r.chunk.id,
        filePath: r.chunk.filePath,
        content: r.chunk.content,
        language: r.chunk.language,
        chunkType: r.chunk.chunkType,
        symbolName: r.chunk.symbolName,
        startLine: r.chunk.startLine,
        endLine: r.chunk.endLine,
        score: r.score,
        matchType: r.matchType,
      })),
      count: results.length,
    });
  } catch (error: any) {
    logger.error('Failed to search:', error);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

router.post('/context', ensureAuthenticated, async (req, res) => {
  try {
    const { query, projectId, maxTokens = 8000, fileFilter, includeImports = true } = req.body;
    if (!query || !projectId) return res.status(400).json({ error: 'query and projectId are required' });

    const projectPath = getProjectPath(projectId);
    const engine = getOrCreateEngine(Number(projectId), projectPath);
    await engine.initialize();

    const result = await engine.getContextForPrompt(query, maxTokens, { fileFilter, includeImports });

    res.json({
      query,
      projectId,
      context: result.context,
      chunks: result.chunks,
      tokenEstimate: result.tokenEstimate,
    });
  } catch (error: any) {
    logger.error('Failed to get context:', error);
    res.status(500).json({ error: 'Failed to get context', message: error.message });
  }
});

router.get('/status/:projectId', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.params;
    const engine = getEngine(Number(projectId));

    const status = engine ? await engine.getStatus() : null;
    const stats = engine ? await engine.getStats() : null;

    res.json({
      projectId: Number(projectId),
      status: status || { indexingInProgress: false, totalFiles: 0, indexedFiles: 0, totalChunks: 0, lastIndexedAt: null, errorCount: 0, lastError: null },
      stats: stats || { totalChunks: 0, embeddedChunks: 0, totalFiles: 0, languages: {}, chunkTypes: {} },
      embeddingAvailable: isEmbeddingAvailable(),
      watcherActive: engine ? !!engine['watcher'] : false,
    });
  } catch (error: any) {
    logger.error('Failed to get status:', error);
    res.status(500).json({ error: 'Failed to get status', message: error.message });
  }
});

router.post('/watcher/start', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const projectPath = getProjectPath(projectId);
    const engine = getOrCreateEngine(Number(projectId), projectPath);
    await engine.initialize();
    engine.startWatcher();

    res.json({ success: true, message: 'File watcher started' });
  } catch (error: any) {
    logger.error('Failed to start watcher:', error);
    res.status(500).json({ error: 'Failed to start watcher', message: error.message });
  }
});

router.post('/watcher/stop', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const engine = getEngine(Number(projectId));
    if (engine) engine.stopWatcher();

    res.json({ success: true, message: 'File watcher stopped' });
  } catch (error: any) {
    logger.error('Failed to stop watcher:', error);
    res.status(500).json({ error: 'Failed to stop watcher', message: error.message });
  }
});

router.post('/reindex', ensureAuthenticated, async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId is required' });

    const projectPath = getProjectPath(projectId);
    const engine = getOrCreateEngine(Number(projectId), projectPath);
    await engine.initialize();

    res.json({ status: 'started', projectId, message: 'Full reindex started' });

    engine.indexProject(true).catch(err =>
      logger.error(`Reindex failed for project ${projectId}: ${err.message}`)
    );
  } catch (error: any) {
    logger.error('Failed to reindex:', error);
    res.status(500).json({ error: 'Failed to reindex', message: error.message });
  }
});

router.get('/context/:sessionId', ensureAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = '10', query } = req.query;

    let contexts: any[] = [];

    if (query && typeof query === 'string') {
      const nodes = await memoryMCP.searchNodes(query, undefined, parseInt(limit as string, 10));
      contexts = await Promise.all(nodes.map(async (node: any, index: number) => {
        const edges = await memoryMCP.getEdges(node.id, 'both');
        return {
          id: node.id, type: node.type, content: node.content,
          relevanceScore: 1 - (index * 0.1), metadata: node.metadata,
          connections: edges.length,
        };
      }));
    }

    res.json({ sessionId, contexts, totalCount: contexts.length, retrievedAt: new Date().toISOString() });
  } catch (error: any) {
    logger.error('Failed to get RAG context:', error);
    res.status(500).json({ error: 'Failed to retrieve context', message: error.message });
  }
});

router.post('/session-config', ensureAuthenticated, async (req, res) => {
  try {
    const { sessionId, config } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const ragConfig = {
      enabled: config?.enabled ?? true,
      mode: config?.mode || 'auto',
      retrievalDepth: config?.retrievalDepth || 3,
      includeConversationHistory: config?.includeConversationHistory ?? true,
      maxContextTokens: config?.maxContextTokens || 8000,
      searchMode: config?.searchMode || 'hybrid',
    };

    await db.update(agentSessions)
      .set({ context: sql`jsonb_set(COALESCE(context, '{}'), '{ragConfig}', ${JSON.stringify(ragConfig)}::jsonb)` })
      .where(eq(agentSessions.sessionToken, sessionId));

    res.json({ success: true, sessionId, config: ragConfig });
  } catch (error: any) {
    logger.error('Failed to set RAG session config:', error);
    res.status(500).json({ error: 'Failed to update session config', message: error.message });
  }
});

router.get('/session-config/:sessionId', ensureAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.sessionToken, sessionId)).limit(1);

    const defaultConfig = {
      enabled: true, mode: 'auto', retrievalDepth: 3,
      includeConversationHistory: true, maxContextTokens: 8000, searchMode: 'hybrid',
    };

    const ragConfig = (session?.context as any)?.ragConfig || defaultConfig;
    res.json({ sessionId, config: ragConfig });
  } catch (error: any) {
    logger.error('Failed to get RAG session config:', error);
    res.status(500).json({ error: 'Failed to get session config', message: error.message });
  }
});

router.get('/models', ensureAuthenticated, async (_req, res) => {
  const ragCapableModels = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', ragSupport: true, embeddingModel: 'text-embedding-3-small', contextWindow: 128000, features: ['embeddings', 'function_calling', 'structured_outputs'] },
    { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', ragSupport: true, embeddingModel: 'text-embedding-3-small', contextWindow: 1000000, features: ['embeddings', 'function_calling'] },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'openai', ragSupport: true, embeddingModel: 'text-embedding-3-small', contextWindow: 1000000, features: ['embeddings', 'function_calling'] },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', ragSupport: true, embeddingModel: null, contextWindow: 200000, features: ['long_context', 'function_calling'] },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', ragSupport: true, embeddingModel: null, contextWindow: 200000, features: ['long_context', 'function_calling', 'extended_thinking'] },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini', ragSupport: true, embeddingModel: 'text-embedding-004', contextWindow: 1000000, features: ['embeddings', 'multimodal', 'function_calling'] },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini', ragSupport: true, embeddingModel: 'text-embedding-004', contextWindow: 2000000, features: ['embeddings', 'multimodal', 'function_calling', 'code_execution'] },
  ];

  const availableModels = ragCapableModels.map(model => ({
    ...model,
    available: (
      (model.provider === 'openai' && !!process.env.OPENAI_API_KEY) ||
      (model.provider === 'anthropic' && !!process.env.ANTHROPIC_API_KEY) ||
      (model.provider === 'gemini' && !!process.env.GEMINI_API_KEY)
    )
  }));

  res.json({ models: availableModels });
});

export default router;
