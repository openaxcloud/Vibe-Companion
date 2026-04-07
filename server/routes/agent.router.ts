// @ts-nocheck
import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { ensureAdmin } from '../middleware/admin-auth';
import { agentOrchestrator } from '../services/agent-orchestrator.service';
import { agentFileOperations } from '../services/agent-file-operations.service';
import { agentCommandExecution } from '../services/agent-command-execution.service';
import { agentToolFramework } from '../services/agent-tool-framework.service';
import { agentWorkflowEngine } from '../services/agent-workflow-engine.service';
import { AgentPreferencesService } from '../services/agent-preferences.service';
import { schemaWarming } from '../services/schema-warming.service';
import { withScopedTransaction } from '../services/persistence-engine';
import { db } from '../db';
import { agentSessions, fileOperations, commandExecutions, toolExecutions, agentWorkflows, AI_MODELS } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import type { IStorage } from '../storage';
import { createLogger } from '../utils/logger';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';
import { createSecureUpload, validateUpload, sanitizeFilename } from '../middleware/upload-validation';

const logger = createLogger('agent-router');
const router = Router();

// Public agent routes (require authentication only)
router.use(ensureAuthenticated);

// Model Selection & Preferences Routes (for all authenticated users)
// GET /api/agent/models - Get available AI models
router.get('/models', async (req, res) => {
  try {
    const storage: IStorage = (req.app.locals as any).storage;
    const preferencesService = new AgentPreferencesService(storage);
    const models = preferencesService.getAvailableModels();
    res.json({ models });
  } catch (error: any) {
    logger.error('[AgentRouter] Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// GET /api/agent/preferences - Get user agent preferences
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user!.id;
    const storage: IStorage = (req.app.locals as any).storage;
    const preferencesService = new AgentPreferencesService(storage);
    
    const preferences = await preferencesService.getUserPreferences(userId);
    
    // Return defaults if no preferences found
    if (!preferences) {
      return res.json({
        extendedThinking: false,
        highPowerMode: false,
        autoWebSearch: true,
        preferredModel: 'claude-sonnet-4-20250514',
        customInstructions: null,
        improvePromptEnabled: false,
        progressTabEnabled: false,
        pauseResumeEnabled: false,
        autoCheckpoints: true,
      });
    }

    res.json(preferences);
  } catch (error: any) {
    logger.error('[AgentRouter] Error fetching preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// PUT /api/agent/preferences - Update user agent preferences
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user!.id;
    const storage: IStorage = (req.app.locals as any).storage;
    const preferencesService = new AgentPreferencesService(storage);
    const updates = req.body;

    // Validate model if provided
    if (updates.preferredModel && !AI_MODELS.includes(updates.preferredModel)) {
      return res.status(400).json({
        error: `Invalid model: ${updates.preferredModel}`,
        validModels: AI_MODELS,
      });
    }

    const updated = await preferencesService.updateUserPreferences(userId, updates);
    res.json(updated);
  } catch (error: any) {
    logger.error('[AgentRouter] Error updating preferences:', error);
    res.status(500).json({ error: error.message || 'Failed to update preferences' });
  }
});

// POST /api/agent/recommend-model - Get model recommendation
router.post('/recommend-model', async (req, res) => {
  try {
    const storage: IStorage = (req.app.locals as any).storage;
    const preferencesService = new AgentPreferencesService(storage);
    const { requiresExtendedThinking, complexity, speedPriority } = req.body;

    const recommended = preferencesService.getRecommendedModel({
      requiresExtendedThinking,
      complexity,
      speedPriority,
    });

    const models = preferencesService.getAvailableModels();
    const modelInfo = models.find(m => m.id === recommended);

    res.json({
      recommended,
      modelInfo,
      reasoning: `Selected ${recommended} based on: complexity=${complexity || 'medium'}, speedPriority=${speedPriority || 'balanced'}, extendedThinking=${requiresExtendedThinking || false}`,
    });
  } catch (error: any) {
    logger.error('[AgentRouter] Error recommending model:', error);
    res.status(500).json({ error: 'Failed to recommend model' });
  }
});

// GET /api/agent/conversation - Get conversation by projectId query param
router.get('/conversation', async (req, res) => {
  try {
    const projectIdStr = req.query.projectId as string;
    const userId = req.user!.id;

    if (!projectIdStr) {
      return res.status(400).json({ error: 'projectId query parameter required' });
    }

    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid projectId - must be a number' });
    }

    const { aiConversations } = await import('@shared/schema');
    const { eq, and, desc } = await import('drizzle-orm');

    // Use withScopedTransaction to verify project ownership via tenant isolation
    const result = await withScopedTransaction(userId, userId, async (scopedQueries, context) => {
      // Verify project ownership - returns null if user doesn't own this project
      const project = await scopedQueries.getProjectById(projectId);
      if (!project && projectId >= 0) {
        return { error: 'Project not found or access denied', status: 403 };
      }

      // Project ownership verified, now query for conversation
      const [conversation] = await db
        .select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.projectId, projectId),
          eq(aiConversations.userId, userId)
        ))
        .orderBy(desc(aiConversations.createdAt))
        .limit(1);

      if (!conversation) {
        return { error: 'No conversation found for this project', status: 404 };
      }

      return {
        conversationId: conversation.id,
        agentMode: conversation.agentMode,
        projectId: conversation.projectId,
      };
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error?.message || 'Transaction failed' });
    }
    if (result.data && 'error' in result.data) {
      return res.status(result.data.status).json({ error: result.data.error });
    }

    res.json(result.data);
  } catch (error: any) {
    logger.error('[AgentRouter] Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/agent/conversation - Create or get conversation for project
router.post('/conversation', async (req, res) => {
  try {
    const { projectId: projectIdRaw, initialPrompt } = req.body;
    const userId = req.user!.id;

    const { aiConversations } = await import('@shared/schema');
    const { eq, and, desc } = await import('drizzle-orm');

    // Parse projectId as integer
    const projectId = projectIdRaw ? parseInt(String(projectIdRaw), 10) : null;
    if (projectIdRaw && (projectId === null || isNaN(projectId))) {
      return res.status(400).json({ error: 'Invalid projectId - must be a number' });
    }

    // projectId is required per schema
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required to create a conversation' });
    }

    // Use withScopedTransaction to verify project ownership via tenant isolation
    // Skip ownership check for negative projectIds (temp/bootstrap mode)
    if (projectId < 0) {
      // Temp mode: allow creating conversations without project ownership check
      const [existingConversation] = await db
        .select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.projectId, projectId),
          eq(aiConversations.userId, userId)
        ))
        .orderBy(desc(aiConversations.createdAt))
        .limit(1);

      if (existingConversation) {
        return res.json({
          conversationId: existingConversation.id,
          agentMode: existingConversation.agentMode,
          existing: true,
        });
      }

      const [newConversation] = await db
        .insert(aiConversations)
        .values({
          projectId: projectId,
          userId: userId,
          messages: [],
          agentMode: 'build',
          model: 'claude-sonnet-4-20250514',
        })
        .returning();

      return res.json({
        conversationId: newConversation.id,
        agentMode: newConversation.agentMode,
        existing: false,
      });
    }

    // Positive projectId: verify project ownership via tenant isolation
    const result = await withScopedTransaction(userId, userId, async (scopedQueries, context) => {
      // Verify project ownership - returns null if user doesn't own this project
      const project = await scopedQueries.getProjectById(projectId);
      if (!project) {
        return { error: 'Project not found or access denied', status: 403 };
      }

      // Project ownership verified, check for existing conversation
      const [existingConversation] = await db
        .select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.projectId, projectId),
          eq(aiConversations.userId, userId)
        ))
        .orderBy(desc(aiConversations.createdAt))
        .limit(1);

      if (existingConversation) {
        return {
          conversationId: existingConversation.id,
          agentMode: existingConversation.agentMode,
          existing: true,
        };
      }

      // Create new conversation
      const [newConversation] = await db
        .insert(aiConversations)
        .values({
          projectId: projectId,
          userId: userId,
          messages: [],
          agentMode: 'build',
          model: 'claude-sonnet-4-20250514',
        })
        .returning();

      return {
        conversationId: newConversation.id,
        agentMode: newConversation.agentMode,
        existing: false,
      };
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error?.message || 'Transaction failed' });
    }
    if (result.data?.error) {
      return res.status(result.data.status).json({ error: result.data.error });
    }

    res.json(result.data);
  } catch (error: any) {
    logger.error('[AgentRouter] Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// POST /api/agent/conversation/:id/mode - Update conversation mode (Plan vs Build)
router.post('/conversation/:id/mode', async (req, res) => {
  try {
    const conversationIdStr = req.params.id;
    const conversationId = parseInt(conversationIdStr, 10);
    const { mode } = req.body;
    const userId = req.user!.id;

    // Validate conversation ID
    if (isNaN(conversationId)) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
      });
    }

    // Validate mode
    if (!mode || (mode !== 'plan' && mode !== 'build')) {
      return res.status(400).json({
        error: 'Invalid mode. Must be "plan" or "build"',
      });
    }

    const { aiConversations } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    // First get the conversation to find its projectId
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId)
      ))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found or access denied',
      });
    }

    const projectId = conversation.projectId;

    // Skip project ownership check for negative projectIds (temp/bootstrap mode)
    if (projectId < 0) {
      await db
        .update(aiConversations)
        .set({ agentMode: mode })
        .where(eq(aiConversations.id, conversationId));

      return res.json({
        success: true,
        conversationId,
        mode,
        message: `Conversation mode updated to ${mode.toUpperCase()}`,
      });
    }

    // Verify project ownership via tenant isolation
    const result = await withScopedTransaction(userId, userId, async (scopedQueries, context) => {
      const project = await scopedQueries.getProjectById(projectId);
      if (!project) {
        return { error: 'Project not found or access denied', status: 403 };
      }

      // Project ownership verified, update mode
      await db
        .update(aiConversations)
        .set({ agentMode: mode })
        .where(eq(aiConversations.id, conversationId));

      return {
        success: true,
        conversationId,
        mode,
        message: `Conversation mode updated to ${mode.toUpperCase()}`,
      };
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error?.message || 'Transaction failed' });
    }
    if (result.data?.error) {
      return res.status(result.data.status).json({ error: result.data.error });
    }

    res.json(result.data);
  } catch (error: any) {
    logger.error('[AgentRouter] Error updating conversation mode:', error);
    res.status(500).json({ error: 'Failed to update conversation mode' });
  }
});

// GET /api/agent/conversation/:id/messages - Load existing messages for a conversation
// Supports pagination with ?limit=N&offset=N query params (Replit-style "Show Previous Messages")
router.get('/conversation/:id/messages', async (req, res) => {
  try {
    const conversationIdStr = req.params.id;
    const conversationId = parseInt(conversationIdStr, 10);
    const userId = req.user!.id;
    
    // Pagination params - default to loading last 20 messages like Replit
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;
    const loadAll = req.query.all === 'true'; // ?all=true bypasses pagination for initial full load

    if (isNaN(conversationId)) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
      });
    }

    const { aiConversations, agentMessages } = await import('@shared/schema');
    const { eq, and, desc, asc, count } = await import('drizzle-orm');

    // First get the conversation to find its projectId
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId)
      ))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found or access denied',
      });
    }

    const projectId = conversation.projectId;

    // Helper function to get messages with pagination support
    const getMessages = async () => {
      // Get total count first
      const [countResult] = await db
        .select({ count: count() })
        .from(agentMessages)
        .where(eq(agentMessages.conversationId, conversationId));
      
      const totalCount = countResult?.count || 0;
      
      // Get messages with pagination (Replit-style: load most recent N messages)
      // When user requests more, they increase the limit to get more older messages
      let dbMessages;
      if (loadAll || totalCount <= limit) {
        // Load all messages if requested or if count is small
        dbMessages = await db
          .select()
          .from(agentMessages)
          .where(eq(agentMessages.conversationId, conversationId))
          .orderBy(asc(agentMessages.createdAt));
      } else {
        // Return the last N messages (skip oldest ones)
        // Frontend increases limit incrementally to load more history
        const skipCount = Math.max(0, totalCount - limit);
        dbMessages = await db
          .select()
          .from(agentMessages)
          .where(eq(agentMessages.conversationId, conversationId))
          .orderBy(asc(agentMessages.createdAt))
          .offset(skipCount)
          .limit(limit);
      }

      if (dbMessages.length > 0) {
        const messages = dbMessages.map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.createdAt,
          type: (msg.metadata as any)?.type || 'text',
          thinking: msg.extendedThinking?.steps || undefined,
          toolExecutions: (msg.metadata as any)?.toolExecutions || undefined,
          metadata: msg.metadata || undefined,
        }));

        return {
          conversationId,
          messages,
          source: 'agentMessages',
          count: messages.length,
          totalCount,
          hasMore: totalCount > messages.length,
        };
      }

      if (conversation.messages && Array.isArray(conversation.messages) && conversation.messages.length > 0) {
        const allMsgs = conversation.messages;
        const total = allMsgs.length;
        const paginatedMsgs = loadAll ? allMsgs : allMsgs.slice(Math.max(0, total - limit - offset));
        return {
          conversationId,
          messages: paginatedMsgs,
          source: 'aiConversations',
          count: paginatedMsgs.length,
          totalCount: total,
          hasMore: total > paginatedMsgs.length,
        };
      }

      return {
        conversationId,
        messages: [],
        source: 'none',
        count: 0,
        totalCount: 0,
        hasMore: false,
      };
    };

    // Skip project ownership check for negative projectIds (temp/bootstrap mode)
    if (projectId < 0) {
      const messagesData = await getMessages();
      return res.json(messagesData);
    }

    // Verify project ownership via tenant isolation
    const result = await withScopedTransaction(userId, userId, async (scopedQueries, context) => {
      const project = await scopedQueries.getProjectById(projectId);
      if (!project) {
        return { error: 'Project not found or access denied', status: 403 };
      }

      // Project ownership verified, get messages
      return await getMessages();
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error?.message || 'Transaction failed' });
    }
    if (result.data && 'error' in result.data) {
      return res.status(result.data.status).json({ error: result.data.error });
    }

    res.json(result.data);
  } catch (error: any) {
    logger.error('[AgentRouter] Error fetching conversation messages:', error);
    res.status(500).json({ error: 'Failed to fetch conversation messages' });
  }
});

// POST /api/agent/conversation/:id/messages - Persist a message to the database
router.post('/conversation/:id/messages', async (req, res) => {
  try {
    const conversationIdStr = req.params.id;
    const conversationId = parseInt(conversationIdStr, 10);
    const userId = req.user!.id;
    const { role, content, timestamp, metadata, extendedThinking } = req.body;

    // Validate conversation ID
    if (isNaN(conversationId)) {
      return res.status(400).json({
        error: 'Invalid conversation ID',
      });
    }

    // Validate required fields
    if (!role || !content) {
      return res.status(400).json({
        error: 'Missing required fields: role and content are required',
      });
    }

    // Validate role
    if (!['user', 'assistant', 'system'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be "user", "assistant", or "system"',
      });
    }

    const { aiConversations, agentMessages } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    // First get the conversation to find its projectId
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(and(
        eq(aiConversations.id, conversationId),
        eq(aiConversations.userId, userId)
      ))
      .limit(1);

    if (!conversation) {
      return res.status(404).json({
        error: 'Conversation not found or access denied',
      });
    }

    const projectId = conversation.projectId;

    // Helper function to save message
    const saveMessage = async () => {
      const [savedMessage] = await db
        .insert(agentMessages)
        .values({
          conversationId,
          projectId: projectId,
          userId,
          role,
          content,
          metadata: metadata || null,
          extendedThinking: extendedThinking || null,
          model: metadata?.model || null,
        })
        .returning();

      logger.info('[AgentRouter] Message persisted:', {
        id: savedMessage.id,
        conversationId,
        role,
        contentLength: content.length,
      });

      return {
        success: true,
        message: savedMessage,
      };
    };

    // Skip project ownership check for negative projectIds (temp/bootstrap mode)
    if (projectId < 0) {
      const savedData = await saveMessage();
      return res.json(savedData);
    }

    // Verify project ownership via tenant isolation
    const result = await withScopedTransaction(userId, userId, async (scopedQueries, context) => {
      const project = await scopedQueries.getProjectById(projectId);
      if (!project) {
        return { error: 'Project not found or access denied', status: 403 };
      }

      // Project ownership verified, save message
      return await saveMessage();
    });

    if (!result.success) {
      return res.status(500).json({ error: result.error?.message || 'Transaction failed' });
    }
    if (result.data && 'error' in result.data) {
      return res.status(result.data.status).json({ error: result.data.error });
    }

    res.json(result.data);
  } catch (error: any) {
    logger.error('[AgentRouter] Error persisting message:', error);
    res.status(500).json({ error: 'Failed to persist message' });
  }
});

// ====== ADMIN-ONLY ROUTES ======
// These routes require admin authentication
// Create new agent session
router.post('/sessions', ensureAdmin, async (req, res) => {
  try {
    const { projectId, model } = req.body;
    const userId = String(req.user!.id);

    const session = await agentOrchestrator.createSession(userId, projectId, model);
    res.json({ success: true, session });
  } catch (error: any) {
    logger.error('Error creating agent session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active sessions
router.get('/sessions', ensureAdmin, async (req, res) => {
  try {
    const userId = String(req.user!.id);
    const sessions = await agentOrchestrator.getActiveSessions(userId);
    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Execute agent command
router.post('/sessions/:sessionId/execute', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messages } = req.body;
    const userId = String(req.user!.id);

    const result = await agentOrchestrator.executeAgent(sessionId, messages, userId);
    res.json(result);
  } catch (error: any) {
    logger.error('Error executing agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stream agent execution
router.post('/sessions/:sessionId/stream', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { prompt } = req.body;
    const userId = String(req.user!.id);

    if (!validateAndSetSSEHeaders(res, req)) {
      return;
    }

    const stream = agentOrchestrator.streamAgentExecution(sessionId, prompt, userId);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    logger.error('Error streaming agent execution:', error);
    res.status(500).json({ error: error.message });
  }
});

// Close session
router.post('/sessions/:sessionId/close', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await agentOrchestrator.closeSession(sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// File operations
router.post('/files/read', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, path } = req.body;
    const userId = String(req.user!.id);

    const result = await agentFileOperations.readFile(sessionId, path, userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/write', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, path, content } = req.body;
    const userId = String(req.user!.id);

    const result = await agentFileOperations.createOrUpdateFile(sessionId, path, content, userId);
    res.json({ success: true, operation: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/delete', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, path } = req.body;
    const userId = String(req.user!.id);

    const result = await agentFileOperations.deleteFile(sessionId, path, userId);
    res.json({ success: true, operation: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/files/list', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, path, recursive } = req.body;
    
    const result = await agentFileOperations.listDirectory(sessionId, path, recursive);
    res.json({ files: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/files/history/:sessionId', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await agentFileOperations.getOperationHistory(sessionId);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Command execution
router.post('/commands/execute', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, command, args, options } = req.body;
    const userId = String(req.user!.id);

    const result = await agentCommandExecution.executeCommand(
      sessionId,
      command,
      args,
      options,
      userId
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/commands/kill', ensureAdmin, async (req, res) => {
  try {
    const { executionId, sessionId } = req.body;
    
    await agentCommandExecution.killCommand(executionId, sessionId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/commands/history/:sessionId', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await agentCommandExecution.getExecutionHistory(sessionId);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Tool execution
router.get('/tools', ensureAdmin, async (req, res) => {
  try {
    const { capability } = req.query;
    const tools = await agentToolFramework.getAvailableTools(capability as string);
    res.json({ tools });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tools/execute', ensureAdmin, async (req, res) => {
  try {
    const { toolName, input, sessionId } = req.body;
    const userId = String(req.user!.id);

    const context = {
      sessionId,
      userId,
      projectId: 0,
      projectPath: process.cwd(),
      environment: {}
    };

    const result = await agentToolFramework.executeTool(toolName, input, context);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/tools/history/:sessionId', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await agentToolFramework.getExecutionHistory(sessionId);
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Workflow execution
router.post('/workflows/create', ensureAdmin, async (req, res) => {
  try {
    const { sessionId, projectId, name, description, steps, initialVariables } = req.body;
    const userId = String(req.user!.id);

    const workflow = await agentWorkflowEngine.executeWorkflow(
      sessionId,
      projectId,
      name,
      description,
      steps,
      userId,
      initialVariables || {}
    );
    res.json({ workflow });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workflows/generate', ensureAdmin, async (req, res) => {
  try {
    const { prompt, sessionId } = req.body;
    
    const steps = await agentWorkflowEngine.generateWorkflowFromPrompt(prompt, sessionId);
    res.json({ steps });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/workflows/:workflowId/status', ensureAdmin, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const status = await agentWorkflowEngine.getWorkflowStatus(workflowId);
    res.json({ status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workflows/:workflowId/cancel', ensureAdmin, async (req, res) => {
  try {
    const { workflowId } = req.params;
    await agentWorkflowEngine.cancelWorkflow(workflowId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workflows/:workflowId/restore', ensureAdmin, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { checkpointIndex } = req.body;
    const userId = String(req.user!.id);

    await agentWorkflowEngine.restoreFromCheckpoint(workflowId, checkpointIndex, userId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get project context
router.get('/context/:projectId', ensureAdmin, async (req, res) => {
  try {
    const { projectId } = req.params;
    const projectPath = projectId ? 
      `./projects/${projectId}` : 
      process.cwd();

    const context = await agentOrchestrator.getProjectContext(projectPath);
    res.json({ context });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket events for real-time updates
import { Server as SocketIOServer } from 'socket.io';

export function setupAgentWebSocket(io: SocketIOServer) {
  const agentNamespace = io.of('/agent');

  agentNamespace.use((socket, next) => {
    // Authenticate socket connection
    const token = socket.handshake.auth.token;
    // Verify admin token here
    next();
  });

  agentNamespace.on('connection', (socket) => {
    // Subscribe to agent events
    const handlers = {
      fileOperation: (event: any) => socket.emit('file:operation', event),
      commandEvent: (event: any) => socket.emit('command:event', event),
      toolEvent: (event: any) => socket.emit('tool:event', event),
      workflowEvent: (event: any) => socket.emit('workflow:event', event),
      agentFunction: (event: any) => socket.emit('agent:function', event)
    };

    agentFileOperations.on('operation:progress', handlers.fileOperation);
    agentCommandExecution.on('command:event', handlers.commandEvent);
    agentToolFramework.on('tool:event', handlers.toolEvent);
    agentWorkflowEngine.on('workflow:event', handlers.workflowEvent);
    agentOrchestrator.on('agent:function_start', handlers.agentFunction);
    agentOrchestrator.on('agent:function_complete', handlers.agentFunction);
    agentOrchestrator.on('agent:function_error', handlers.agentFunction);

    socket.on('disconnect', () => {
      // Cleanup event listeners
      agentFileOperations.off('operation:progress', handlers.fileOperation);
      agentCommandExecution.off('command:event', handlers.commandEvent);
      agentToolFramework.off('tool:event', handlers.toolEvent);
      agentWorkflowEngine.off('workflow:event', handlers.workflowEvent);
      agentOrchestrator.off('agent:function_start', handlers.agentFunction);
      agentOrchestrator.off('agent:function_complete', handlers.agentFunction);
      agentOrchestrator.off('agent:function_error', handlers.agentFunction);
    });
  });
}

// Dashboard stats
router.get('/stats/:sessionId', ensureAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get session info
    const [session] = await db.select()
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId));
    
    // Get operation counts
    const fileOps = await db.select()
      .from(fileOperations)
      .where(eq(fileOperations.sessionId, sessionId));
    
    const commands = await db.select()
      .from(commandExecutions)
      .where(eq(commandExecutions.sessionId, sessionId));
    
    const tools = await db.select()
      .from(toolExecutions)
      .where(eq(toolExecutions.sessionId, sessionId));
    
    const workflows = await db.select()
      .from(agentWorkflows)
      .where(eq(agentWorkflows.sessionId, sessionId));
    
    res.json({
      session,
      stats: {
        fileOperations: fileOps.length,
        commandExecutions: commands.length,
        toolExecutions: tools.length,
        workflows: workflows.length,
        tokensUsed: session?.totalTokensUsed || 0,
        totalOperations: session?.totalOperations || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Schema Warming Routes - Background data structure pre-drafting
// POST /api/agent/schema/warm - Start schema warming for a project
router.post('/schema/warm', async (req, res) => {
  try {
    const { projectId, prompt } = req.body;
    
    if (!projectId || !prompt) {
      return res.status(400).json({ error: 'projectId and prompt are required' });
    }
    
    // Start background warming (non-blocking)
    schemaWarming.startWarming(String(projectId), prompt);
    
    // Return current status
    const status = schemaWarming.getStatus(String(projectId));
    
    res.json({
      success: true,
      status,
      message: 'Schema warming started in background',
    });
  } catch (error: any) {
    logger.error('[AgentRouter] Error starting schema warming:', error);
    res.status(500).json({ error: error.message || 'Failed to start schema warming' });
  }
});

// GET /api/agent/schema/status/:projectId - Get schema warming status
router.get('/schema/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const status = schemaWarming.getStatus(projectId);
    const isReady = schemaWarming.isReady(projectId);
    
    res.json({
      projectId,
      ...status,
      isReady,
    });
  } catch (error: any) {
    logger.error('[AgentRouter] Error getting schema status:', error);
    res.status(500).json({ error: error.message || 'Failed to get schema status' });
  }
});

// GET /api/agent/schema/stream/:projectId - SSE stream for schema warming progress
router.get('/schema/stream/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Set up SSE with CORS security - reject invalid origins with 403
    if (!validateAndSetSSEHeaders(res, req)) {
      return;
    }
    
    // Send initial status
    const initialStatus = schemaWarming.getStatus(projectId);
    res.write(`data: ${JSON.stringify({ type: 'status', ...initialStatus })}\n\n`);
    
    // Listen for progress updates
    const onProgress = (data: { projectId: string; progress: any }) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...data.progress })}\n\n`);
      }
    };
    
    const onReady = (data: { projectId: string; schema: any }) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({ type: 'ready', schemaPreview: 'Schema ready' })}\n\n`);
        cleanup();
        res.end();
      }
    };
    
    const onError = (data: { projectId: string; error: string }) => {
      if (data.projectId === projectId) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: data.error })}\n\n`);
        cleanup();
        res.end();
      }
    };
    
    schemaWarming.on('progress', onProgress);
    schemaWarming.on('ready', onReady);
    schemaWarming.on('error', onError);
    
    const cleanup = () => {
      schemaWarming.off('progress', onProgress);
      schemaWarming.off('ready', onReady);
      schemaWarming.off('error', onError);
    };
    
    // Handle client disconnect
    req.on('close', () => {
      cleanup();
    });
    
    // If already ready, close immediately
    if (schemaWarming.isReady(projectId)) {
      res.write(`data: ${JSON.stringify({ type: 'ready', schemaPreview: 'Schema already ready' })}\n\n`);
      cleanup();
      res.end();
    }
  } catch (error: any) {
    logger.error('[AgentRouter] Error in schema stream:', error);
    res.status(500).json({ error: error.message || 'Failed to create schema stream' });
  }
});

// ============================================================================
// Agent File Attachments API
// ============================================================================

const agentUpload = createSecureUpload({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for agent attachments
    files: 5 // Max 5 files at once
  }
});

// Supported text-based file types for AI context
const TEXT_EXTENSIONS = [
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.html',
  '.xml', '.yaml', '.yml', '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.swift', '.kt', '.sql', '.sh', '.bash', '.zsh', '.ps1',
  '.csv', '.env', '.gitignore', '.dockerfile', '.toml', '.ini', '.cfg',
  '.vue', '.svelte', '.astro', '.php', '.pl', '.lua', '.r', '.scala'
];

// Image types that can be processed (for vision-capable models)
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// POST /api/agent/attachments - Upload files for agent context
router.post('/attachments', agentUpload.array('files', 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    
    const attachments: Array<{
      id: string;
      name: string;
      type: 'text' | 'image' | 'binary';
      mimeType: string;
      size: number;
      content?: string;
      base64?: string;
      preview?: string;
    }> = [];
    
    for (const file of files) {
      const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
      const safeName = sanitizeFilename(file.originalname);
      const id = `attachment-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Validate upload
      const validation = await validateUpload(file.buffer, file.mimetype);
      if (!validation.valid) {
        logger.warn(`[AgentRouter] File rejected: ${safeName} - ${validation.error}`);
        continue; // Skip invalid files but continue with others
      }
      
      if (TEXT_EXTENSIONS.includes(ext)) {
        // Text file - include content directly
        const content = file.buffer.toString('utf-8');
        const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
        
        attachments.push({
          id,
          name: safeName,
          type: 'text',
          mimeType: file.mimetype || 'text/plain',
          size: file.size,
          content,
          preview
        });
      } else if (IMAGE_EXTENSIONS.includes(ext)) {
        // Image file - include as base64 for vision models
        const base64 = file.buffer.toString('base64');
        
        attachments.push({
          id,
          name: safeName,
          type: 'image',
          mimeType: file.mimetype || 'image/png',
          size: file.size,
          base64,
          preview: `[Image: ${safeName}]`
        });
      } else {
        // Binary file - just include metadata
        attachments.push({
          id,
          name: safeName,
          type: 'binary',
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          preview: `[Binary file: ${safeName} (${(file.size / 1024).toFixed(1)} KB)]`
        });
      }
    }
    
    if (attachments.length === 0) {
      return res.status(400).json({ error: 'No valid files could be processed' });
    }
    
    logger.info(`[AgentRouter] Processed ${attachments.length} file attachments`);
    res.json({ attachments });
    
  } catch (error: any) {
    logger.error('[AgentRouter] Error processing attachments:', error);
    res.status(500).json({ error: 'Failed to process file attachments' });
  }
});

export default router;