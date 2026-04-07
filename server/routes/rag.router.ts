/**
 * RAG (Retrieval-Augmented Generation) API Routes
 * Provides endpoints for Agentic RAG capabilities across all platforms
 */

import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { memoryMCP } from '../mcp/servers/memory-mcp';
import { db } from '../db';
import { agentSessions } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { createLogger } from '../utils/logger';

const router = Router();
const logger = createLogger('rag-router');

interface RAGStats {
  embeddingsCount: number;
  nodesCount: number;
  edgesCount: number;
  conversationsCount: number;
  lastUpdated: string | null;
  isAvailable: boolean;
  providers: {
    openai: boolean;
    anthropic: boolean;
    gemini: boolean;
  };
}

interface RAGContext {
  id: string;
  type: string;
  content: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
  connections: number;
}

interface RAGSessionConfig {
  enabled: boolean;
  mode: 'auto' | 'manual' | 'hybrid';
  retrievalDepth: number;
  includeConversationHistory: boolean;
  maxContextTokens: number;
}

/**
 * GET /api/rag/stats
 * Get RAG system statistics (public endpoint - returns defaults for unauthenticated users)
 */
router.get('/stats', async (req, res) => {
  // For unauthenticated users, return minimal stats
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({
      embeddingsCount: 0,
      nodesCount: 0,
      edgesCount: 0,
      conversationsCount: 0,
      lastUpdated: null,
      isAvailable: !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY,
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
      const nodesResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM knowledge_graph_nodes
      `) as unknown as { rows: { count: string }[] };
      nodesCount = parseInt(nodesResult.rows[0]?.count || '0', 10);

      const edgesResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM knowledge_graph_edges
      `) as unknown as { rows: { count: string }[] };
      edgesCount = parseInt(edgesResult.rows[0]?.count || '0', 10);

      const conversationsResult = await db.execute(sql`
        SELECT COUNT(DISTINCT session_id) as count FROM conversation_memory
      `) as unknown as { rows: { count: string }[] };
      conversationsCount = parseInt(conversationsResult.rows[0]?.count || '0', 10);

      const lastUpdateResult = await db.execute(sql`
        SELECT MAX(updated_at) as last_update FROM knowledge_graph_nodes
      `) as unknown as { rows: { last_update: string | null }[] };
      lastUpdated = lastUpdateResult.rows[0]?.last_update || null;
    } catch (dbError) {
      logger.warn('Knowledge graph tables may not exist yet:', dbError);
    }

    let embeddingsCount = 0;
    try {
      const embeddingsResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM knowledge_graph_nodes WHERE embedding IS NOT NULL
      `) as unknown as { rows: { count: string }[] };
      embeddingsCount = parseInt(embeddingsResult.rows[0]?.count || '0', 10);
    } catch {
      embeddingsCount = 0;
    }

    const stats: RAGStats = {
      embeddingsCount,
      nodesCount,
      edgesCount,
      conversationsCount,
      lastUpdated,
      isAvailable: !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY,
      providers: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        gemini: !!process.env.GEMINI_API_KEY,
      }
    };

    res.json(stats);
  } catch (error: any) {
    logger.error('Failed to get RAG stats:', error);
    res.status(500).json({ 
      error: 'Failed to get RAG statistics',
      message: error.message 
    });
  }
});

/**
 * GET /api/rag/context/:sessionId
 * Get retrieved context for a session
 */
router.get('/context/:sessionId', ensureAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = '10', query } = req.query;

    let contexts: RAGContext[] = [];

    if (query && typeof query === 'string') {
      const nodes = await memoryMCP.searchNodes(query, undefined, parseInt(limit as string, 10));
      
      contexts = await Promise.all(nodes.map(async (node, index) => {
        const edges = await memoryMCP.getEdges(node.id, 'both');
        return {
          id: node.id,
          type: node.type,
          content: node.content,
          relevanceScore: 1 - (index * 0.1),
          metadata: node.metadata,
          connections: edges.length
        };
      }));
    } else {
      const history = await memoryMCP.getConversationHistory(
        String(req.user!.id), 
        sessionId, 
        5
      );

      if (history.length > 0) {
        const lastUserMessage = history.find(h => h.role === 'user');
        if (lastUserMessage) {
          const nodes = await memoryMCP.searchNodes(
            lastUserMessage.content.substring(0, 200), 
            undefined, 
            parseInt(limit as string, 10)
          );

          contexts = await Promise.all(nodes.map(async (node, index) => {
            const edges = await memoryMCP.getEdges(node.id, 'both');
            return {
              id: node.id,
              type: node.type,
              content: node.content,
              relevanceScore: 1 - (index * 0.1),
              metadata: node.metadata,
              connections: edges.length
            };
          }));
        }
      }
    }

    res.json({
      sessionId,
      contexts,
      totalCount: contexts.length,
      retrievedAt: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to get RAG context:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve context',
      message: error.message 
    });
  }
});

/**
 * POST /api/rag/session-config
 * Set RAG configuration for a session
 */
router.post('/session-config', ensureAuthenticated, async (req, res) => {
  try {
    const { sessionId, config } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const ragConfig: RAGSessionConfig = {
      enabled: config?.enabled ?? true,
      mode: config?.mode || 'auto',
      retrievalDepth: config?.retrievalDepth || 3,
      includeConversationHistory: config?.includeConversationHistory ?? true,
      maxContextTokens: config?.maxContextTokens || 4000
    };

    await db.update(agentSessions)
      .set({
        context: sql`jsonb_set(COALESCE(context, '{}'), '{ragConfig}', ${JSON.stringify(ragConfig)}::jsonb)`
      })
      .where(eq(agentSessions.sessionToken, sessionId));

    res.json({ 
      success: true, 
      sessionId, 
      config: ragConfig 
    });
  } catch (error: any) {
    logger.error('Failed to set RAG session config:', error);
    res.status(500).json({ 
      error: 'Failed to update session config',
      message: error.message 
    });
  }
});

/**
 * GET /api/rag/session-config/:sessionId
 * Get RAG configuration for a session
 */
router.get('/session-config/:sessionId', ensureAuthenticated, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [session] = await db.select()
      .from(agentSessions)
      .where(eq(agentSessions.sessionToken, sessionId))
      .limit(1);

    const defaultConfig: RAGSessionConfig = {
      enabled: true,
      mode: 'auto',
      retrievalDepth: 3,
      includeConversationHistory: true,
      maxContextTokens: 4000
    };

    const ragConfig = (session?.context as any)?.ragConfig || defaultConfig;

    res.json({ 
      sessionId, 
      config: ragConfig 
    });
  } catch (error: any) {
    logger.error('Failed to get RAG session config:', error);
    res.status(500).json({ 
      error: 'Failed to get session config',
      message: error.message 
    });
  }
});

/**
 * POST /api/rag/index
 * Index content into the knowledge graph
 */
router.post('/index', ensureAuthenticated, async (req, res) => {
  try {
    const { content, type = 'fact', metadata = {} } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const node = await memoryMCP.createNode({
      type: type as 'concept' | 'entity' | 'event' | 'fact' | 'idea',
      content,
      metadata: {
        ...metadata,
        userId: req.user!.id,
        indexedAt: new Date().toISOString()
      }
    });

    res.status(201).json({
      success: true,
      node: {
        id: node.id,
        type: node.type,
        content: node.content.substring(0, 100) + '...',
        createdAt: node.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to index content:', error);
    res.status(500).json({ 
      error: 'Failed to index content',
      message: error.message 
    });
  }
});

/**
 * POST /api/rag/search
 * Search the knowledge graph
 */
router.post('/search', ensureAuthenticated, async (req, res) => {
  try {
    const { query, type, limit = 10 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const nodes = await memoryMCP.searchNodes(query, type, Math.min(limit, 50));

    const results = await Promise.all(nodes.map(async (node) => {
      const edges = await memoryMCP.getEdges(node.id, 'both');
      return {
        id: node.id,
        type: node.type,
        content: node.content,
        metadata: node.metadata,
        connections: edges.length,
        createdAt: node.createdAt
      };
    }));

    res.json({
      query,
      results,
      count: results.length
    });
  } catch (error: any) {
    logger.error('Failed to search knowledge graph:', error);
    res.status(500).json({ 
      error: 'Search failed',
      message: error.message 
    });
  }
});

/**
 * GET /api/rag/models
 * Get AI models with RAG capabilities
 */
router.get('/models', ensureAuthenticated, async (req, res) => {
  try {
    const ragCapableModels = [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        ragSupport: true,
        embeddingModel: 'text-embedding-3-small',
        contextWindow: 128000,
        features: ['embeddings', 'function_calling', 'structured_outputs']
      },
      {
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        provider: 'openai',
        ragSupport: true,
        embeddingModel: 'text-embedding-3-small',
        contextWindow: 1000000,
        features: ['embeddings', 'function_calling']
      },
      {
        id: 'gpt-4.1-nano',
        name: 'GPT-4.1 Nano',
        provider: 'openai',
        ragSupport: true,
        embeddingModel: 'text-embedding-3-small',
        contextWindow: 1000000,
        features: ['embeddings', 'function_calling']
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        provider: 'anthropic',
        ragSupport: true,
        embeddingModel: null,
        contextWindow: 200000,
        features: ['long_context', 'function_calling']
      },
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        provider: 'anthropic',
        ragSupport: true,
        embeddingModel: null,
        contextWindow: 200000,
        features: ['long_context', 'function_calling', 'extended_thinking']
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        ragSupport: true,
        embeddingModel: 'text-embedding-004',
        contextWindow: 1000000,
        features: ['embeddings', 'multimodal', 'function_calling']
      },
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        provider: 'gemini',
        ragSupport: true,
        embeddingModel: 'text-embedding-004',
        contextWindow: 2000000,
        features: ['embeddings', 'multimodal', 'function_calling', 'code_execution']
      },
      {
        id: 'grok-3',
        name: 'Grok 3',
        provider: 'xai',
        ragSupport: true,
        embeddingModel: null,
        contextWindow: 131072,
        features: ['real_time_data', 'function_calling']
      },
      {
        id: 'moonshot-v1-128k',
        name: 'Kimi 128K',
        provider: 'moonshot',
        ragSupport: true,
        embeddingModel: null,
        contextWindow: 131072,
        features: ['agentic_coding', 'function_calling']
      }
    ];

    const availableModels = ragCapableModels.map(model => ({
      ...model,
      available: (
        (model.provider === 'openai' && !!process.env.OPENAI_API_KEY) ||
        (model.provider === 'anthropic' && !!process.env.ANTHROPIC_API_KEY) ||
        (model.provider === 'gemini' && !!process.env.GEMINI_API_KEY) ||
        (model.provider === 'xai' && !!process.env.XAI_API_KEY) ||
        (model.provider === 'moonshot' && !!process.env.MOONSHOT_API_KEY)
      )
    }));

    res.json({ models: availableModels });
  } catch (error: any) {
    logger.error('Failed to get RAG models:', error);
    res.status(500).json({ 
      error: 'Failed to get models',
      message: error.message 
    });
  }
});

export default router;
