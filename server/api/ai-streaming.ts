import { Router } from 'express';
import { ensureAuthenticated } from '../middleware/auth';
import { aiUsageTracker } from '../middleware/ai-usage-tracker';
import { normalizeModelName } from '../utils/model-normalizer';
import { calculateRequestCost } from '../config/ai-pricing';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import winston from 'winston';
import { allTools, toOpenAITools, toAnthropicTools } from '../agent/tool-definitions';
import { ToolExecutor } from '../agent/tool-executor';
import { ProjectContextProvider } from '../agent/project-context';
import { truncateContext } from '../agent/context-manager';
import { memoryMCP } from '../mcp/servers/memory-mcp';
import { memoryBankService } from '../services/memory-bank.service';
import { getOrCreateEngine } from '../services/rag/index';
import { workspaceSnapshotService } from '../services/workspace-snapshot.service';
import { db } from '../db';
import { agentSessions, aiConversations } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import * as path from 'path';
import { DESIGN_SYSTEM_PROMPT } from '../ai/prompts/design-system';

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * OpenAI Model Capabilities Map
 * Centralized configuration for model-specific parameter requirements
 * - requiresMaxCompletionTokens: Use max_completion_tokens instead of max_tokens
 * - supportsTemperature: Whether the model supports the temperature parameter
 */
interface OpenAIModelCapabilities {
  requiresMaxCompletionTokens: boolean;
  supportsTemperature: boolean;
}

const OPENAI_MODEL_CAPABILITIES: Record<string, OpenAIModelCapabilities> = {
  // GPT-4.1 family — standard parameters
  'gpt-4.1':      { requiresMaxCompletionTokens: false, supportsTemperature: true },
  'gpt-4.1-mini': { requiresMaxCompletionTokens: false, supportsTemperature: true },
  'gpt-4.1-nano': { requiresMaxCompletionTokens: false, supportsTemperature: true },
  // GPT-4o family — standard parameters
  'gpt-4o': { requiresMaxCompletionTokens: false, supportsTemperature: true },
  'gpt-4o-mini': { requiresMaxCompletionTokens: false, supportsTemperature: true },
  // O-series — no temperature, max_completion_tokens
  'o4-mini':    { requiresMaxCompletionTokens: true, supportsTemperature: false },
  'o1':         { requiresMaxCompletionTokens: true, supportsTemperature: false },
  'o1-mini':    { requiresMaxCompletionTokens: true, supportsTemperature: false },
  'o1-preview': { requiresMaxCompletionTokens: true, supportsTemperature: false },
  'o3':         { requiresMaxCompletionTokens: true, supportsTemperature: false },
  'o3-mini':    { requiresMaxCompletionTokens: true, supportsTemperature: false },
  // GPT-4 legacy family — standard parameters
  'gpt-4-turbo': { requiresMaxCompletionTokens: false, supportsTemperature: true },
  'gpt-4':       { requiresMaxCompletionTokens: false, supportsTemperature: true },
  'gpt-3.5-turbo': { requiresMaxCompletionTokens: false, supportsTemperature: true },
};

/**
 * Get model capabilities with fallback to safe defaults
 * Unknown models default to legacy parameter support for backwards compatibility
 */
function getOpenAIModelCapabilities(model: string): OpenAIModelCapabilities {
  if (OPENAI_MODEL_CAPABILITIES[model]) {
    return OPENAI_MODEL_CAPABILITIES[model];
  }
  // o-series — no temperature, max_completion_tokens
  if (/^o[1-9]/.test(model)) {
    return { requiresMaxCompletionTokens: true, supportsTemperature: false };
  }
  // gpt-4.x family — standard parameters
  if (model.startsWith('gpt-4')) {
    return { requiresMaxCompletionTokens: false, supportsTemperature: true };
  }
  return { requiresMaxCompletionTokens: false, supportsTemperature: true };
}

const router = Router();

// AI Usage Tracking (Pay-As-You-Go) - Track ALL streaming endpoints for billing
// No blocking - users pay for what they use via Stripe metered billing
// CRITICAL: Streaming is high-cost and MUST be accurately tracked
router.use(aiUsageTracker);

// Helper to validate and setup SSE headers (Fortune 500-grade reliability with 403 rejection)
const setupSSE = (res: any, req?: any): ((cleanupFn?: () => void) => void) | null => {
  const origin = req?.headers?.origin;
  const isDevMode = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  const allowedOrigins = [
    'https://e-code.ai',
    'https://www.e-code.ai',
    process.env.APP_URL,
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
    process.env.REPLIT_DEV_URL,
    'http://localhost:5000',
    'http://localhost:3000',
  ].filter(Boolean);
  
  let validatedOrigin: string | null = null;
  
  if (!origin) {
    // No Origin header = same-origin request (safe by definition, always allow)
    validatedOrigin = 'http://localhost:5000';
  } else if (allowedOrigins.includes(origin)) {
    validatedOrigin = origin;
  } else {
    // Always check Replit patterns (not just in development)
    const replitPatterns = [
      /^https:\/\/[a-f0-9-]+\.replit\.dev$/,
      /^https:\/\/[a-f0-9-]+-\d+-[a-z0-9]+\.riker\.replit\.dev$/,
      /^https:\/\/[a-z0-9-]+\.repl\.co$/,
      /^https:\/\/[a-z0-9-]+\.replit\.app$/,
    ];
    if (replitPatterns.some(pattern => pattern.test(origin))) {
      validatedOrigin = origin;
    }
  }
  
  if (!validatedOrigin) {
    logger.warn('[SSE] Rejected SSE connection from invalid origin', { origin, ip: req?.ip, path: req?.path });
    res.status(403).json({ error: 'Origin not allowed' });
    return null;
  }
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', validatedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('X-Accel-Buffering', 'no');
  
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
  
  res.write('event: connected\n');
  res.write('data: {"status": "connected"}\n\n');
  
  const cleanupHandlers: (() => void)[] = [];
  
  if (req) {
    const handleClose = () => {
      logger.info('[SSE] Client connection closed - running cleanup');
      cleanupHandlers.forEach(fn => {
        try { fn(); } catch (e) { /* ignore cleanup errors */ }
      });
    };
    
    req.on('close', handleClose);
    req.on('error', (err: Error) => {
      logger.warn('[SSE] Client connection error', { error: err.message });
      handleClose();
    });
  }
  
  return (cleanupFn?: () => void) => {
    if (cleanupFn) cleanupHandlers.push(cleanupFn);
  };
};

// Helper to send SSE message
const sendSSE = (res: any, event: string, data: any) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Main streaming chat endpoint for AI Agent panel
 * Supports OpenAI, Anthropic, Google AI, and more
 */
router.post('/agent/chat/stream', ensureAuthenticated, async (req, res) => {
  // ✅ FORTUNE 500: Validate origin and setup SSE with 403 rejection for invalid origins
  const registerCleanup = setupSSE(res, req);
  if (!registerCleanup) {
    return; // 403 already sent by setupSSE
  }
  
  // ✅ FORTUNE 500: AbortController for graceful stream cancellation on client disconnect
  const abortController = new AbortController();
  let isConnectionClosed = false;
  
  registerCleanup(() => {
    isConnectionClosed = true;
    abortController.abort();
    logger.info('[AI Stream] Connection closed - aborting provider stream');
  });
  
  const { 
    message: rawMessage, 
    messages: rawMessages,  // Support both message (string) and messages (array)
    projectId, 
    conversationId,
    provider = 'openai',
    model: rawModel,
    modelId, // Frontend sends modelId, map to model
    fastMode = false, // Fast Mode for quick 10-60s targeted changes
    context = [],
    temperature = 0.7,
    maxTokens: rawMaxTokens = 4096,
    tools = [],
    systemPrompt,
    capabilities = {}
  } = req.body;
  
  const maxTokens = Math.min(Number(rawMaxTokens) || 4096, 16384);
  
  // Handle both message (string) and messages (array) input formats
  // If messages array is provided, extract the last user message
  let message: string | undefined = rawMessage;
  if (!message && Array.isArray(rawMessages) && rawMessages.length > 0) {
    const lastUserMsg = rawMessages.find((m: any) => m.role === 'user' && m.content);
    message = lastUserMsg?.content || '';
  }
  
  // Ensure message is a string (fallback to empty string if still undefined)
  if (!message || typeof message !== 'string') {
    message = '';
  }
  
  // Map modelId (from frontend) to model, with provider-specific defaults
  // These MUST match the defaults in each stream function for consistency
  // ✅ ALIGNED Dec 5, 2025: Defaults MUST match AI_MODELS catalog IDs
  const getDefaultModel = (prov: string): string => {
    switch (prov) {
      case 'openai': return 'gpt-4.1';
      case 'anthropic': return 'claude-sonnet-4-20250514';
      case 'gemini': return 'gemini-2.5-flash';
      case 'xai': return 'grok-3';
      case 'moonshot': return 'kimi-k2';
      default: return 'gpt-4.1';
    }
  };
  
  const getFastModel = (prov: string): string => {
    switch (prov) {
      case 'anthropic': return 'claude-sonnet-4-20250514';
      case 'openai': return 'gpt-4.1-nano';
      case 'gemini': return 'gemini-2.5-flash';
      case 'xai': return 'grok-3-mini';
      default: return 'gpt-4.1-nano';
    }
  };
  
  // Select model: Fast Mode overrides user selection with fast model
  let model = fastMode 
    ? getFastModel(provider) 
    : (rawModel || modelId || getDefaultModel(provider));
  
  if (provider === 'openai' && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    const MODELFARM_SUPPORTED = new Set([
      'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
      'gpt-4o', 'gpt-4o-mini',
      'o4-mini', 'o3', 'o3-mini',
    ]);
    if (!MODELFARM_SUPPORTED.has(model)) {
      logger.info(`[AI Stream] ModelFarm: model ${model} not in supported set → gpt-4.1`);
      model = 'gpt-4.1';
    }
  }

  // Log Fast Mode activation for debugging
  if (fastMode) {
    logger.info('[AI Stream] Fast Mode activated', { fastModel: model, provider });
  }
  
  const userId = (req as any).user?.id;
  const requestStartTime = Date.now();
  let tokensInput = 0;
  let tokensOutput = 0;
  let agentMode: 'plan' | 'build' | 'edit' = 'build';
  
  // ✅ REPLIT-SPEED: Detect quick questions that don't need heavy context
  const isQuickQuestion = message && message.length < 150 && 
    !message.toLowerCase().includes('build') && 
    !message.toLowerCase().includes('create') && 
    !message.toLowerCase().includes('code') &&
    !message.toLowerCase().includes('file') &&
    !message.toLowerCase().includes('project');
  
  // ✅ FORTUNE 500: Enhanced telemetry for streaming reliability tracking
  const streamStartTime = Date.now();
  logger.info('[AI Stream] Starting chat stream', {
    provider,
    model,
    projectId,
    userId,
    conversationId: conversationId || 'new',
    hasMessage: !!message,
    messageLength: message?.length || 0,
    isQuickQuestion,
    streamStartTime: new Date(streamStartTime).toISOString()
  });
  
  try {
    // ✅ REPLIT-SPEED: Parallel context loading for maximum performance
    let enforcedTools: any[] | undefined = undefined;
    let modeSystemPrompt = '';
    let contextPrompt = '';
    
    // For quick questions, skip heavy context loading entirely
    if (isQuickQuestion) {
      logger.info('[AI Stream] Quick mode - skipping heavy context loading');
      enforcedTools = tools && tools.length > 0 ? tools : undefined;
      modeSystemPrompt = 'You are a helpful AI assistant. Respond concisely and quickly.';
      contextPrompt = '';
    } else {
      // ✅ PARALLEL: Load conversation mode and project context simultaneously
      const [conversationResult, projectContextResult] = await Promise.all([
        // Task 1: Load conversation mode from database
        (async () => {
          if (!conversationId) return { mode: 'build' as const, enforcedTools: tools && tools.length > 0 ? tools : undefined };
          try {
            const [conversation] = await db
              .select({ agentMode: aiConversations.agentMode })
              .from(aiConversations)
              .where(eq(aiConversations.id, conversationId))
              .limit(1);
            
            if (conversation?.agentMode === 'plan') {
              return { 
                mode: 'plan' as const, 
                enforcedTools: [] as any[],
                prompt: `IMPORTANT: You are in PLAN MODE. Do NOT execute any code changes.
Focus on planning, design, and collaboration - not implementation.`
              };
            }
            return { 
              mode: conversation?.agentMode || 'build' as const, 
              enforcedTools: tools && tools.length > 0 ? tools : undefined,
              prompt: 'You are in BUILD MODE. You can execute actions like creating files and modifying code.'
            };
          } catch (err: any) { console.error("[catch]", err?.message || err);
            return { mode: 'build' as const, enforcedTools: tools && tools.length > 0 ? tools : undefined };
          }
        })(),
        // Task 2: Load project context (only if projectId exists)
        (async () => {
          if (!projectId) return '';
          try {
            const contextProvider = new ProjectContextProvider(projectId);
            const projectContext = await contextProvider.getContext();
            return ProjectContextProvider.formatAsSystemPrompt(projectContext);
          } catch (err: any) { console.error("[catch]", err?.message || err);
            return '';
          }
        })()
      ]);
      
      agentMode = conversationResult.mode;
      enforcedTools = conversationResult.enforcedTools;
      modeSystemPrompt = conversationResult.prompt || '';
      contextPrompt = projectContextResult;
    }
    
    // ============================================================
    // RAG + MEMORY BANK INTEGRATION - Optimized with config respect
    // ============================================================
    let ragContextPrompt = '';
    let memoryBankContext = '';
    const ragSessionId = conversationId || `session_${userId}_${projectId}`;
    
    // ✅ REPLIT-SPEED: Skip heavy context for quick questions
    if (isQuickQuestion) {
      logger.info('[AI Stream] Quick question - skipping RAG and Memory Bank');
      sendSSE(res, 'rag_status', { enabled: false, nodesRetrieved: 0, status: 'skipped_quick' });
    } else if (context && context.length >= 4) {
      logger.info('[AI Stream] Skipping RAG - frontend context already provided');
      sendSSE(res, 'rag_status', { enabled: false, nodesRetrieved: 0, status: 'skipped_context_provided' });
    } else {
      // Lookup RAG session config first (respects user settings)
      let ragEnabled = true;
      let retrievalDepth = 3;
      let includeConversationHistory = false;
      let ragConfig: any = null;
      
      try {
        const [session] = await db.select()
          .from(agentSessions)
          .where(eq(agentSessions.sessionToken, ragSessionId))
          .limit(1);
        
        if (session?.context && (session.context as any).ragConfig) {
          ragConfig = (session.context as any).ragConfig;
          ragEnabled = ragConfig?.enabled ?? true;
          retrievalDepth = ragConfig?.retrievalDepth ?? 3;
          includeConversationHistory = ragConfig?.includeConversationHistory ?? false;
        }
      } catch (err: any) { console.error("[catch]", err?.message || err);
      }
      
      if (!ragEnabled) {
        sendSSE(res, 'rag_status', { enabled: false, nodesRetrieved: 0, sessionId: ragSessionId, status: 'disabled' });
      } else {
        const [ragResult, memoryResult] = await Promise.all([
          (async () => {
            try {
              const searchQuery = message && message.length > 0 ? message.substring(0, 500) : '';
              if (!searchQuery) return '';

              if (projectId) {
                const projectPath = path.join(process.cwd(), 'projects', String(projectId));
                const engine = getOrCreateEngine(Number(projectId), projectPath);
                const maxTokens = Math.min((ragConfig?.maxContextTokens || 8000), 12000);
                const searchMode = ragConfig?.searchMode || 'hybrid';

                const contextResult = await Promise.race([
                  engine.getContextForPrompt(searchQuery, maxTokens, { includeImports: true }),
                  new Promise<{ context: string; chunks: any[]; tokenEstimate: number }>((resolve) =>
                    setTimeout(() => resolve({ context: '', chunks: [], tokenEstimate: 0 }), 3000)
                  ),
                ]);

                if (contextResult.chunks.length > 0) {
                  sendSSE(res, 'rag_status', {
                    enabled: true,
                    nodesRetrieved: contextResult.chunks.length,
                    sessionId: ragSessionId,
                    status: 'success',
                    mode: searchMode,
                    tokenEstimate: contextResult.tokenEstimate,
                    files: [...new Set(contextResult.chunks.map((c: any) => c.filePath))],
                  });

                  let historyContext = '';
                  if (includeConversationHistory) {
                    try {
                      const history = await memoryMCP.getConversationHistory(String(userId), ragSessionId, 5);
                      if (history.length > 0) {
                        historyContext = '\n=== CONVERSATION MEMORY ===\n' +
                          history.map(h => `${h.role}: ${h.content.substring(0, 300)}`).join('\n') +
                          '\n===========================\n';
                      }
                    } catch (err: any) { console.error("[catch]", err?.message || err); }
                  }

                  return contextResult.context + historyContext;
                }
              }

              const fallbackNodes = await Promise.race([
                memoryMCP.searchNodes(searchQuery, undefined, Math.min(retrievalDepth, 5)),
                new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 500)),
              ]);

              if (fallbackNodes && fallbackNodes.length > 0) {
                const ragItems = fallbackNodes.slice(0, 5).map((node: any, index: number) =>
                  `[${index + 1}] ${node.type}: ${node.content.substring(0, 500)}`
                ).join('\n');
                sendSSE(res, 'rag_status', { enabled: true, nodesRetrieved: fallbackNodes.length, sessionId: ragSessionId, status: 'success_fts' });
                return `\n=== CONTEXT ===\n${ragItems}\n===============\n`;
              }

              sendSSE(res, 'rag_status', { enabled: true, nodesRetrieved: 0, sessionId: ragSessionId, status: 'no_results' });
              return '';
            } catch (e: any) {
              const status = e.message?.includes('timeout') ? 'timeout' : 'error';
              sendSSE(res, 'rag_status', { enabled: true, nodesRetrieved: 0, sessionId: ragSessionId, status, error: e.message });
              logger.debug(`[RAG] ${status}: ${e.message}`);
              return '';
            }
          })(),
          (async () => {
            if (!projectId) return '';
            try {
              const projectBasePath = path.join(process.cwd(), 'projects', String(projectId));
              memoryBankService.setProjectBasePath(Number(projectId), projectBasePath);
              const context = await Promise.race([
                memoryBankService.getContextForAgent(projectId),
                new Promise<string>((resolve) => setTimeout(() => resolve(''), 500))
              ]);
              if (context) {
                sendSSE(res, 'memory_bank_status', { enabled: true, projectId, hasContext: true, contextLength: context.length });
                return context.substring(0, 4000);
              }
              sendSSE(res, 'memory_bank_status', { enabled: false, projectId, hasContext: false });
              return '';
            } catch (e: any) {
              sendSSE(res, 'memory_bank_status', { enabled: false, projectId, hasContext: false, error: e.message });
              return '';
            }
          })()
        ]);

        ragContextPrompt = ragResult;
        memoryBankContext = memoryResult;
      }
    }
    
    // Build messages array with context (including RAG and Memory Bank if enabled)
    const rawMessages = [
      {
        role: 'system',
        content: systemPrompt || `You are an expert AI coding assistant integrated into the E-Code Platform IDE.
You help users build, debug, and improve their applications with detailed explanations and high-quality code.
You have access to the project context and can execute actions like creating files, running commands, and modifying code.

CRITICAL: When the user asks you to build, create, or generate an application,
you MUST use the create_file tool to create complete, working files.

${DESIGN_SYSTEM_PROMPT}

NEVER generate plain HTML without Tailwind CSS.
NEVER use default browser styling.
NEVER create ugly or basic-looking apps.
ALWAYS produce a modern, polished, startup-level design.
ALWAYS make the app look like it was designed by a professional UI designer.

${modeSystemPrompt}

${contextPrompt}

${memoryBankContext}

${ragContextPrompt}`
      },
      ...context,
      { role: 'user', content: message }
    ];
    
    // Apply context truncation to prevent exceeding provider limits
    const truncationResult = truncateContext(rawMessages, provider);
    const messages = truncationResult.messages;
    
    // Warn user if context was truncated
    if (truncationResult.truncated) {
      logger.info(`Context truncated for ${provider}: dropped ${truncationResult.droppedCount} messages (${truncationResult.originalSize} → ${truncationResult.finalSize})`);
      sendSSE(res, 'warning', {
        message: truncationResult.warning,
        droppedCount: truncationResult.droppedCount,
        originalSize: truncationResult.originalSize,
        finalSize: truncationResult.finalSize
      });
    }
    
    // Track usage (send normalized model to prevent client-side 'default' bugs)
    const normalizedModelForEvent = normalizeModelName(model, provider);
    sendSSE(res, 'usage', { 
      provider, 
      model: normalizedModelForEvent,
      tokens: 0 
    });
    
    let fullResponse = '';
    
    // ✅ Stream based on provider and CAPTURE token usage for billing
    // ✅ FORTUNE 500: Pass abort signal and connection state for graceful cleanup
    const abortState = { signal: abortController.signal, isAborted: () => isConnectionClosed };
    
    let usage: { tokensInput: number; tokensOutput: number } | undefined;
    switch (provider) {
      case 'openai':
        usage = await streamOpenAI(res, messages, { model, temperature, maxTokens, tools: enforcedTools, projectId, userId, abortState });
        break;
        
      case 'anthropic':
        usage = await streamAnthropic(res, messages, { 
          model, 
          temperature, 
          maxTokens,
          tools: enforcedTools,
          projectId,
          userId,
          extendedThinking: capabilities.extendedThinking || false,
          abortState
        });
        break;
        
      case 'gemini':
        usage = await streamGemini(res, messages, { model, temperature, maxTokens, tools: enforcedTools, projectId, userId, abortState });
        break;
        
      case 'xai':
        usage = await streamXAI(res, messages, { model, temperature, maxTokens, tools: enforcedTools, projectId, userId, abortState });
        break;
        
      case 'moonshot':
        usage = await streamMoonshot(res, messages, { model, temperature, maxTokens, tools: enforcedTools, projectId, userId, abortState });
        break;
        
      default:
        logger.warn(`Unknown provider "${provider}", falling back to OpenAI`);
        usage = await streamOpenAI(res, messages, { model, temperature, maxTokens, tools: enforcedTools, projectId, userId, abortState });
    }
    
    // ✅ CRITICAL: Track AI usage for billing (Pay-As-You-Go)
    if (usage && userId) {
      const user = (req as any).user;
      const requestDurationMs = Date.now() - requestStartTime;
      
      // ✅ CRITICAL: Normalize model name to prevent DB insert failures
      const normalizedModel = normalizeModelName(model, provider);
      
      // Import trackAiUsageManually for SSE tracking
      const { trackAiUsageManually } = await import('../middleware/ai-usage-tracker');
      
      await trackAiUsageManually({
        userId,
        endpoint: req.path,
        model: normalizedModel,
        provider,
        tokensInput: usage.tokensInput,
        tokensOutput: usage.tokensOutput,
        userTier: user?.subscriptionTier || 'free',
        subscriptionId: user?.stripeSubscriptionId,
        requestDurationMs,
        status: 'success',
        metadata: {
          conversationId,
          projectId,
          agentMode: agentMode || 'build',
          originalModel: model, // Keep original for debugging
        },
      });
      
      tokensInput = usage.tokensInput;
      tokensOutput = usage.tokensOutput;
    }
    
    // ✅ FORTUNE 500: Skip final events if client disconnected
    if (isConnectionClosed) {
      logger.info('[AI Stream] Client disconnected - skipping final done event');
      return;
    }
    
    // Calculate cost for this request
    const normalizedModel = normalizeModelName(model, provider);
    const requestCost = calculateRequestCost(normalizedModel, tokensInput, tokensOutput);
    
    // Send completion event with cost and token data
    sendSSE(res, 'done', { 
      conversationId,
      projectId,
      totalTokens: tokensInput + tokensOutput,
      tokensInput,
      tokensOutput,
      cost: requestCost.toFixed(6),
      model: normalizedModel,
      provider
    });
    
    res.end();
    
    // Fire-and-forget: post-response background work
    (async () => {
      try {
        // ============================================================
        // AUTO-UPDATE MEMORY BANK - Log AI activity to activeContext.md
        // ============================================================
        if (projectId && agentMode === 'build') {
          try {
            await memoryBankService.updateActiveContext(Number(projectId), {
              action: 'AI assistant interaction completed'
            });
            logger.info(`[MemoryBank] Auto-updated activeContext.md for project ${projectId}`);
          } catch (mbError: any) {
            logger.warn(`[MemoryBank] Failed to auto-update: ${mbError.message}`);
          }
        }
        
        // ============================================================
        // AUTO-CHECKPOINT - Create checkpoint after successful AI response
        // Captures actual file content, database snapshot, and conversation history
        // Only checkpoint when tools were available (build mode with actions)
        // ============================================================
        const shouldCheckpoint = enforcedTools && enforcedTools.length > 0;
        if (projectId && agentMode === 'build' && shouldCheckpoint) {
          try {
            const { checkpointService } = await import('../services/checkpoint.service');
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const fs = await import('fs/promises');
            const execAsync = promisify(exec);
            
            const projectIdNum = Number(projectId);
            
            // Compute project base path (relative to cwd where projects are stored)
            const projectBasePath = path.join(process.cwd(), 'projects', String(projectIdNum));
            
            // Capture actual file state from the project directory
            const snapshot = await workspaceSnapshotService.captureFileState(
              projectBasePath,
              projectIdNum,
              { includeHidden: false } // Skip hidden files like .git
            );
            
            // Build filesSnapshot metadata for the checkpoint record
            const filesSnapshot: Record<string, { hash: string; size: number }> = {};
            for (const file of snapshot.files) {
              filesSnapshot[file.path] = { hash: file.hash, size: file.size };
            }
            
            // Create the checkpoint record with metadata
            const checkpoint = await checkpointService.createCheckpoint(projectIdNum, {
              type: 'auto',
              triggerSource: 'ai_response',
              aiSummary: `AI build checkpoint - ${snapshot.totalFiles} files captured`,
              filesSnapshot,
            });
            
            // Store actual file content in autoCheckpointFiles table for restore
            if (snapshot.files.length > 0) {
              const filesToStore = snapshot.files.map(file => ({
                filePath: file.path,
                fileHash: file.hash,
                fileContent: file.content,
              }));
              
              await checkpointService.addCheckpointFiles(checkpoint.id, filesToStore);
              logger.info(`[Checkpoint] Stored ${filesToStore.length} files for checkpoint ${checkpoint.id}`);
            }
            
            // ============================================================
            // DATABASE SNAPSHOT - Capture database state with pg_dump
            // SECURITY: Use spawn with args array to prevent command injection
            // ============================================================
            let includesDatabase = false;
            let dbSnapshotPath: string | undefined;
            const databaseUrl = process.env.DATABASE_URL;
            if (databaseUrl) {
              try {
                const { spawn } = await import('child_process');
                const checkpointDir = path.join(process.cwd(), '.checkpoints', String(checkpoint.id));
                await fs.mkdir(checkpointDir, { recursive: true });
                
                const dumpFile = path.join(checkpointDir, 'database.sql');
                
                // Parse DATABASE_URL safely to extract components
                const dbUrlParsed = new URL(databaseUrl);
                const pgDumpArgs = [
                  '-h', dbUrlParsed.hostname,
                  '-p', dbUrlParsed.port || '5432',
                  '-U', dbUrlParsed.username,
                  '-d', dbUrlParsed.pathname.slice(1), // remove leading /
                  '--schema=public',
                  '--no-owner',
                  '--no-acl',
                  '-f', dumpFile
                ];
                
                // Execute pg_dump using spawn with args array (secure - no shell injection)
                await new Promise<void>((resolve, reject) => {
                  const child = spawn('pg_dump', pgDumpArgs, {
                    env: { ...process.env, PGPASSWORD: dbUrlParsed.password },
                    stdio: ['pipe', 'pipe', 'pipe']
                  });
                  
                  let stderr = '';
                  child.stderr?.on('data', (data) => { stderr += data.toString(); });
                  
                  child.on('close', (code) => {
                    if (code === 0) {
                      resolve();
                    } else {
                      reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
                    }
                  });
                  
                  child.on('error', (err) => reject(err));
                });
                
                includesDatabase = true;
                dbSnapshotPath = dumpFile;
                logger.info(`[Checkpoint] Database snapshot saved to ${dumpFile}`);
              } catch (dbError: any) {
                logger.warn(`[Checkpoint] Database snapshot failed (non-fatal): ${dbError.message}`);
              }
            }
            
            // ============================================================
            // CONVERSATION SNAPSHOT - Capture AI conversation history
            // ============================================================
            let conversationSnapshot: Array<{ role: string; content: string; timestamp?: string }> | undefined;
            if (conversationId) {
              try {
                const { aiConversations, agentMessages } = await import('../../shared/schema');
                const { eq, desc } = await import('drizzle-orm');
                
                // Get conversation messages from agentMessages table
                const messages = await db
                  .select({
                    role: agentMessages.role,
                    content: agentMessages.content,
                    createdAt: agentMessages.createdAt,
                  })
                  .from(agentMessages)
                  .where(eq(agentMessages.conversationId, Number(conversationId)))
                  .orderBy(agentMessages.createdAt)
                  .limit(100); // Limit to prevent huge snapshots
                
                if (messages.length > 0) {
                  conversationSnapshot = messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.createdAt?.toISOString(),
                  }));
                  logger.info(`[Checkpoint] Captured ${messages.length} conversation messages`);
                }
              } catch (convError: any) {
                logger.warn(`[Checkpoint] Conversation snapshot failed (non-fatal): ${convError.message}`);
              }
            }
            
            // Update checkpoint with database and conversation data
            // RELIABILITY: Persist dbSnapshotPath and conversationId for reliable restore
            if (includesDatabase || conversationSnapshot || dbSnapshotPath) {
              await checkpointService.updateCheckpointData(checkpoint.id, {
                includesDatabase,
                conversationSnapshot,
                dbSnapshotPath,
                conversationId: conversationId ? Number(conversationId) : undefined,
              });
            }
            
            logger.info(`[Checkpoint] Auto-created checkpoint ${checkpoint.id} for project ${projectId} with ${snapshot.totalFiles} files, db=${includesDatabase}, conv=${!!conversationSnapshot}`);
          } catch (cpError: any) {
            // Handle rate-limited checkpoints silently - this is expected behavior
            if (cpError.code === 'RATE_LIMITED') {
              logger.debug(`[Checkpoint] Rate-limited auto-checkpoint for project ${projectId} - skipping silently`);
            } else {
              logger.warn(`[Checkpoint] Failed to create auto-checkpoint: ${cpError.message}`);
            }
          }
        }
      } catch (bgErr: any) {
        logger.warn('[AI Stream] Background post-response work failed (non-fatal):', bgErr.message);
      }
    })();
    
  } catch (error: any) {
    logger.error('Streaming chat error:', error);
    
    // ✅ Issue #34 FIX: Classify errors as retryable vs permanent
    const isRetryableError = (err: any): boolean => {
      const status = err.status || err.statusCode || err.response?.status;
      // 429 = Rate limit, 502/503/504 = Temporary server errors
      const retryableStatuses = [429, 502, 503, 504];
      if (retryableStatuses.includes(status)) return true;
      // Network/timeout errors are retryable
      const retryableMessages = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'socket hang up', 'network'];
      if (err.code && retryableMessages.some(m => err.code?.includes(m))) return true;
      if (err.message && retryableMessages.some(m => err.message?.toLowerCase().includes(m))) return true;
      return false;
    };
    
    const errorClassification = {
      isRetryable: isRetryableError(error),
      status: error.status || error.statusCode || error.response?.status,
      code: error.code || 'STREAM_ERROR'
    };
    
    // ✅ CRITICAL: Track failed AI requests for billing (error = still costs money!)
    if (userId) {
      try {
        const user = (req as any).user;
        const requestDurationMs = Date.now() - requestStartTime;
        const normalizedModel = normalizeModelName(model, provider);
        const { trackAiUsageManually } = await import('../middleware/ai-usage-tracker');
        
        await trackAiUsageManually({
          userId,
          endpoint: req.path,
          model: normalizedModel,
          provider,
          tokensInput: tokensInput || 0, // Fallback to 0 if error before streaming
          tokensOutput: 0,
          userTier: user?.subscriptionTier || 'free',
          subscriptionId: user?.stripeSubscriptionId,
          requestDurationMs,
          status: 'error',
          errorMessage: error.message || 'Unknown streaming error',
          metadata: {
            conversationId,
            projectId,
            agentMode: agentMode || 'build',
            originalModel: model,
            errorCode: error.code || 'STREAM_ERROR',
          },
        });
      } catch (trackingError) {
        logger.error('Failed to track error AI usage', { trackingError, originalError: error });
      }
    }
    
    // ✅ FORTUNE 500: Skip error event if client already disconnected
    if (isConnectionClosed) {
      logger.info('[AI Stream] Client disconnected - skipping error event');
      return;
    }
    
    // Send error event with retryability classification
    sendSSE(res, 'error', {
      message: error.message || 'An error occurred during streaming',
      code: errorClassification.code,
      isRetryable: errorClassification.isRetryable,
      status: errorClassification.status,
      provider
    });
    
    res.end();
  }
});

/**
 * Stream from OpenAI API with tool execution
 */
async function streamOpenAI(res: any, messages: any[], options: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    sendSSE(res, 'error', { 
      message: 'OpenAI API key not configured. Please add OPENAI_API_KEY to secrets.',
      code: 'MISSING_API_KEY'
    });
    return;
  }
  
  // ✅ MODELFARM FIX: Use Replit ModelFarm (free) when available, fall back to direct key
  const modelfarmURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const openai = new OpenAI({
    apiKey,
    ...(modelfarmURL ? { baseURL: modelfarmURL } : {})
  });
  const executor = new ToolExecutor(options.projectId || 'default', options.userId);
  
  const requestedTools = options.tools !== undefined ? options.tools : allTools;
  const tools = toOpenAITools(requestedTools);
  
  const modelToUse = options.model || 'gpt-4.1';
  logger.info(`[OpenAI Stream] Using model: ${modelToUse}`);
  
  // Get model capabilities for correct parameter usage
  const capabilities = getOpenAIModelCapabilities(modelToUse);
  
  const stream = await openai.chat.completions.create({
    model: modelToUse,
    messages,
    temperature: capabilities.supportsTemperature ? options.temperature : undefined,
    ...(capabilities.requiresMaxCompletionTokens 
      ? { max_completion_tokens: options.maxTokens }
      : { max_tokens: options.maxTokens }),
    stream: true,
    stream_options: { include_usage: true },
    tools: tools.length > 0 ? tools : undefined
  });
  
  let fullContent = '';
  let toolCalls: any[] = [];
  let currentToolCall: any = null;
  let tokensInput = 0;
  let tokensOutput = 0;
  
  for await (const chunk of stream) {
    // ✅ FORTUNE 500: Check for client disconnect before processing
    if (options.abortState?.isAborted?.()) {
      logger.info('[OpenAI Stream] Client disconnected - aborting stream early');
      break;
    }
    
    const delta = chunk.choices[0]?.delta;
    
    // ✅ Capture token usage from final chunk
    if (chunk.usage) {
      tokensInput = chunk.usage.prompt_tokens || 0;
      tokensOutput = chunk.usage.completion_tokens || 0;
    }
    
    if (delta?.content) {
      fullContent += delta.content;
      sendSSE(res, 'token', { content: delta.content });
    }
    
    // Handle tool calls
    if (delta?.tool_calls) {
      for (const toolCallDelta of delta.tool_calls) {
        if (toolCallDelta.index !== undefined) {
          if (!toolCalls[toolCallDelta.index]) {
            toolCalls[toolCallDelta.index] = {
              id: toolCallDelta.id,
              type: 'function',
              function: { name: '', arguments: '' }
            };
          }
          
          const toolCall = toolCalls[toolCallDelta.index];
          
          if (toolCallDelta.function?.name) {
            toolCall.function.name += toolCallDelta.function.name;
          }
          if (toolCallDelta.function?.arguments) {
            toolCall.function.arguments += toolCallDelta.function.arguments;
          }
        }
      }
    }
  }
  
  // Execute tools autonomously
  const toolResults: any[] = [];
  for (const toolCall of toolCalls) {
    // ✅ FORTUNE 500: Skip tool execution if client disconnected
    if (options.abortState?.isAborted?.()) {
      logger.info('[OpenAI Stream] Client disconnected - skipping tool execution');
      break;
    }
    
    try {
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);
      
      sendSSE(res, 'tool_start', {
        toolCallId: toolCall.id,
        tool: functionName,
        parameters: functionArgs
      });
      
      const result = await executor.execute(functionName, functionArgs);
      
      toolResults.push({
        tool_call_id: toolCall.id,
        role: 'tool',
        name: functionName,
        content: JSON.stringify(result)
      });
      
      sendSSE(res, 'tool_result', {
        toolCallId: toolCall.id,
        tool: functionName,
        result: result.output,
        success: result.success,
        metadata: result.metadata
      });
      
    } catch (error: any) {
      sendSSE(res, 'tool_error', {
        toolCallId: toolCall.id,
        error: error.message
      });
    }
  }
  
  // Send final message
  sendSSE(res, 'message', { 
    content: fullContent,
    tool_calls: toolCalls,
    tool_results: toolResults,
    model: options.model || 'gpt-4.1'
  });
  
  // ✅ Return token usage for billing
  return { tokensInput, tokensOutput };
}

/**
 * Stream from Anthropic API with Extended Thinking support
 */
async function streamAnthropic(res: any, messages: any[], options: any) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    sendSSE(res, 'error', { 
      message: 'Anthropic API key not configured. Please add ANTHROPIC_API_KEY to secrets.',
      code: 'MISSING_API_KEY'
    });
    return;
  }
  
  const anthropic = new Anthropic({ apiKey });
  const executor = new ToolExecutor(options.projectId || 'default', options.userId);
  
  // Convert messages format for Anthropic
  const systemMessage = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system');
  
  // Add tools to the request (respect Plan Mode enforcement from options)
  const requestedTools = options.tools !== undefined ? options.tools : allTools;
  const tools = toAnthropicTools(requestedTools);
  
  const modelToUse = options.model || 'claude-sonnet-4-20250514';
  logger.info(`[Anthropic Stream] Using model: ${modelToUse}`);
  
  // ✅ Use .stream() helper to get finalMessage() with usage
  const stream = anthropic.messages.stream({
    model: modelToUse,
    messages: userMessages,
    system: systemMessage?.content,
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    tools: tools.length > 0 ? tools : undefined,
    thinking: options.extendedThinking ? {
      type: 'enabled',
      budget_tokens: 10000
    } : undefined
  });
  
  let fullContent = '';
  let thinkingContent = '';
  let currentThinkingStep: any = null;
  let toolCalls: any[] = [];
  let currentToolUse: any = null;
  
  // ✅ Process stream events
  for await (const event of stream) {
    // ✅ FORTUNE 500: Check for client disconnect before processing
    if (options.abortState?.isAborted?.()) {
      logger.info('[Anthropic Stream] Client disconnected - aborting stream early');
      break;
    }
    
    // Handle thinking blocks (extended thinking)
    if (event.type === 'content_block_start' && (event as any).content_block?.type === 'thinking') {
      currentThinkingStep = {
        id: Date.now().toString(),
        type: 'reasoning',
        title: 'AI Thinking',
        content: '',
        status: 'active',
        timestamp: new Date(),
        isStreaming: true
      };
      sendSSE(res, 'thinking_start', { step: currentThinkingStep });
    }
    
    // Handle tool use blocks
    if (event.type === 'content_block_start' && (event as any).content_block?.type === 'tool_use') {
      currentToolUse = {
        id: (event as any).content_block.id,
        name: (event as any).content_block.name,
        input: ''
      };
    }
    
    if (event.type === 'content_block_delta') {
      const delta = event.delta as any;
      
      // Thinking content
      if (delta.type === 'thinking_delta' && delta.thinking) {
        thinkingContent += delta.thinking;
        if (currentThinkingStep) {
          currentThinkingStep.content = thinkingContent;
          sendSSE(res, 'thinking_update', { 
            step: currentThinkingStep,
            content: delta.thinking 
          });
        }
      }
      
      // Regular text content
      if (delta.type === 'text_delta' && delta.text) {
        fullContent += delta.text;
        sendSSE(res, 'token', { content: delta.text });
      }
      
      // Tool use input
      if (delta.type === 'input_json_delta' && delta.partial_json && currentToolUse) {
        currentToolUse.input += delta.partial_json;
      }
    }
    
    if (event.type === 'content_block_stop') {
      if (currentThinkingStep) {
        currentThinkingStep.status = 'complete';
        currentThinkingStep.isStreaming = false;
        sendSSE(res, 'thinking_complete', { step: currentThinkingStep });
        currentThinkingStep = null;
        thinkingContent = '';
      }
      
      if (currentToolUse) {
        toolCalls.push(currentToolUse);
        currentToolUse = null;
      }
    }
  }
  
  // Execute tools autonomously
  const toolResults: any[] = [];
  for (const toolCall of toolCalls) {
    // ✅ FORTUNE 500: Skip tool execution if client disconnected
    if (options.abortState?.isAborted?.()) {
      logger.info('[Anthropic Stream] Client disconnected - skipping tool execution');
      break;
    }
    
    try {
      const functionArgs = JSON.parse(toolCall.input);
      
      sendSSE(res, 'tool_start', {
        toolCallId: toolCall.id,
        tool: toolCall.name,
        parameters: functionArgs
      });
      
      const result = await executor.execute(toolCall.name, functionArgs);
      
      toolResults.push({
        tool_use_id: toolCall.id,
        type: 'tool_result',
        content: JSON.stringify(result)
      });
      
      sendSSE(res, 'tool_result', {
        toolCallId: toolCall.id,
        tool: toolCall.name,
        result: result.output,
        success: result.success,
        metadata: result.metadata
      });
      
    } catch (error: any) {
      sendSSE(res, 'tool_error', {
        toolCallId: toolCall.id,
        error: error.message
      });
    }
  }
  
  // ✅ FORTUNE 500: Skip final message if client disconnected
  if (options.abortState?.isAborted?.()) {
    logger.info('[Anthropic Stream] Client disconnected - skipping final message');
    return { tokensInput: 0, tokensOutput: 0 };
  }
  
  // Send final message
  sendSSE(res, 'message', { 
    content: fullContent,
    tool_calls: toolCalls,
    tool_results: toolResults,
    model: options.model || 'claude-sonnet-4-20250514',
    thinking: thinkingContent
  });
  
  // ✅ Get token usage from finalMessage AFTER stream completes
  const finalMessage = await stream.finalMessage();
  const tokensInput = finalMessage.usage.input_tokens || 0;
  const tokensOutput = finalMessage.usage.output_tokens || 0;
  
  // ✅ Return token usage for billing
  return { tokensInput, tokensOutput };
}

/**
 * Stream from Google Gemini API
 */
async function streamGemini(res: any, messages: any[], options: any) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    sendSSE(res, 'error', { 
      message: 'Google AI API key not configured. Please add GOOGLE_AI_API_KEY to secrets.',
      code: 'MISSING_API_KEY'
    });
    return;
  }
  
  // Use provided model or default to gemini-2.5-flash (stable production model)
  const modelToUse = options.model || 'gemini-2.5-flash';
  logger.info(`[Gemini Stream] Using model: ${modelToUse}`);
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: modelToUse 
  });
  
  // Convert messages to Gemini format
  const chat = model.startChat({
    history: messages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))
  });
  
  const result = await chat.sendMessageStream(messages[messages.length - 1].content);
  
  let fullContent = '';
  let tokensInput = 0;
  let tokensOutput = 0;
  
  for await (const chunk of result.stream) {
    // ✅ FORTUNE 500: Check for client disconnect before processing
    if (options.abortState?.isAborted?.()) {
      logger.info('[Gemini Stream] Client disconnected - aborting stream early');
      break;
    }
    
    const text = chunk.text();
    if (text) {
      fullContent += text;
      sendSSE(res, 'token', { content: text });
    }
    
    // ✅ Capture token usage if available
    const usageMetadata = (chunk as any).usageMetadata;
    if (usageMetadata) {
      tokensInput = usageMetadata.promptTokenCount || 0;
      tokensOutput = usageMetadata.candidatesTokenCount || 0;
    }
  }
  
  // Fallback: Estimate tokens if not provided (1 token ≈ 4 chars)
  if (tokensInput === 0 && tokensOutput === 0) {
    const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
    tokensInput = Math.ceil(inputChars / 4);
    tokensOutput = Math.ceil(fullContent.length / 4);
  }
  
  // Send final message
  sendSSE(res, 'message', { 
    content: fullContent,
    model: modelToUse
  });
  
  // ✅ Return token usage for billing
  return { tokensInput, tokensOutput };
}

/**
 * Stream from xAI (Grok) API - OpenAI-compatible
 * Uses xAI's OpenAI-compatible API at https://api.x.ai/v1
 */
async function streamXAI(res: any, messages: any[], options: any) {
  const apiKey = process.env.XAI_API_KEY;
  
  if (!apiKey) {
    sendSSE(res, 'error', { 
      message: 'xAI API key not configured. Please add XAI_API_KEY to secrets.',
      code: 'MISSING_API_KEY'
    });
    return { tokensInput: 0, tokensOutput: 0 };
  }
  
  // xAI uses OpenAI-compatible API
  const xaiClient = new OpenAI({ 
    apiKey,
    baseURL: 'https://api.x.ai/v1'
  });
  
  // ✅ FIXED: grok-2-1212 returns 400 "model not found" — use grok-3 (confirmed working)
  const modelToUse = options.model || 'grok-3';
  logger.info(`[xAI Stream] Using model: ${modelToUse}`);
  
  try {
    const stream = await xaiClient.chat.completions.create({
      model: modelToUse,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    });
    
    let fullContent = '';
    let tokensInput = 0;
    let tokensOutput = 0;
    
    for await (const chunk of stream) {
      // ✅ FORTUNE 500: Check for client disconnect before processing
      if (options.abortState?.isAborted?.()) {
        logger.info('[xAI Stream] Client disconnected - aborting stream early');
        break;
      }
      
      const delta = chunk.choices[0]?.delta;
      
      // Capture token usage from final chunk
      if (chunk.usage) {
        tokensInput = chunk.usage.prompt_tokens || 0;
        tokensOutput = chunk.usage.completion_tokens || 0;
      }
      
      if (delta?.content) {
        fullContent += delta.content;
        sendSSE(res, 'token', { content: delta.content });
      }
    }
    
    // ✅ FORTUNE 500: Skip final message if client disconnected
    if (options.abortState?.isAborted?.()) {
      return { tokensInput, tokensOutput };
    }
    
    // Send final message
    sendSSE(res, 'message', { 
      content: fullContent,
      model: modelToUse
    });
    
    return { tokensInput, tokensOutput };
  } catch (error: any) {
    logger.error(`[xAI Stream] Error:`, error);
    sendSSE(res, 'error', { 
      message: error.message || 'xAI streaming error',
      code: error.code || 'XAI_ERROR'
    });
    return { tokensInput: 0, tokensOutput: 0 };
  }
}

/**
 * Stream from Moonshot AI (Kimi) API - OpenAI-compatible
 * Uses Moonshot's OpenAI-compatible API at https://api.moonshot.ai/v1
 * 
 * KIMI K2 CONFIGURATION (per official docs):
 * 1. Temperature = 1.0 - Required for optimal thinking quality
 * 2. Streaming = true - Prevents timeouts, delivers reasoning_content before final answer
 * 3. max_tokens >= 16000 - Thinking is token-intensive
 * 4. Preserve reasoning_content - Automatic server-side handling
 */
async function streamMoonshot(res: any, messages: any[], options: any) {
  const apiKey = process.env.MOONSHOT_API_KEY;
  
  if (!apiKey) {
    sendSSE(res, 'error', { 
      message: 'Moonshot API key not configured. Please add MOONSHOT_API_KEY to secrets.',
      code: 'MISSING_API_KEY'
    });
    return { tokensInput: 0, tokensOutput: 0 };
  }
  
  // Moonshot uses OpenAI-compatible API
  const moonshotClient = new OpenAI({ 
    apiKey,
    baseURL: 'https://api.moonshot.ai/v1'
  });
  
  const modelToUse = options.model || 'kimi-k2';
  
  // ✅ KIMI K2 OPTIMIZATION: Detect thinking models for special configuration
  const isThinkingModel = modelToUse.includes('thinking') || modelToUse.includes('kimi-k2');
  
  // ✅ KIMI REQUIREMENT 1: Temperature = 1.0 for thinking models (optimal performance)
  // Per Moonshot docs: "Set Temperature = 1.0 - Deviating from this value can impact thinking quality"
  const temperature = isThinkingModel ? 1.0 : (options.temperature ?? 0.7);
  
  // ✅ KIMI REQUIREMENT 4: max_tokens >= 16000 for thinking models
  // Thinking content + final answer must fit within limit
  const maxTokens = isThinkingModel 
    ? Math.max(options.maxTokens || 16384, 16384)  // Minimum 16k for thinking
    : (options.maxTokens || 4096);
  
  logger.info(`[Moonshot Stream] Using model: ${modelToUse}, thinking: ${isThinkingModel}, temp: ${temperature}, maxTokens: ${maxTokens}`);
  
  try {
    // ✅ KIMI REQUIREMENT 3: Enable Streaming (stream = true)
    // Prevents network timeouts and delivers reasoning_content before final answer
    const stream = await moonshotClient.chat.completions.create({
      model: modelToUse,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    });
    
    let fullContent = '';
    let fullReasoningContent = '';
    let tokensInput = 0;
    let tokensOutput = 0;
    
    for await (const chunk of stream) {
      // ✅ FORTUNE 500: Check for client disconnect before processing
      if (options.abortState?.isAborted?.()) {
        logger.info('[Moonshot Stream] Client disconnected - aborting stream early');
        break;
      }
      
      const delta = chunk.choices[0]?.delta as any;
      
      // Capture token usage from final chunk
      if (chunk.usage) {
        tokensInput = chunk.usage.prompt_tokens || 0;
        tokensOutput = chunk.usage.completion_tokens || 0;
      }
      
      // ✅ KIMI REQUIREMENT 2: Handle reasoning_content for thinking models
      // reasoning_content appears in streaming before the final answer
      if (delta?.reasoning_content) {
        fullReasoningContent += delta.reasoning_content;
        // Send thinking content to client for transparency
        sendSSE(res, 'thinking', { content: delta.reasoning_content });
      }
      
      if (delta?.content) {
        fullContent += delta.content;
        sendSSE(res, 'token', { content: delta.content });
      }
    }
    
    // ✅ FORTUNE 500: Skip final message if client disconnected
    if (options.abortState?.isAborted?.()) {
      return { tokensInput, tokensOutput };
    }
    
    // Send final message with optional reasoning context
    sendSSE(res, 'message', { 
      content: fullContent,
      model: modelToUse,
      ...(fullReasoningContent && { reasoning: fullReasoningContent })
    });
    
    return { tokensInput, tokensOutput };
  } catch (error: any) {
    logger.error(`[Moonshot Stream] Error:`, error);
    sendSSE(res, 'error', { 
      message: error.message || 'Moonshot streaming error',
      code: error.code || 'MOONSHOT_ERROR'
    });
    return { tokensInput: 0, tokensOutput: 0 };
  }
}

/**
 * Stop streaming endpoint - allows client to cancel ongoing stream
 */
router.post('/agent/chat/stop', ensureAuthenticated, (req, res) => {
  const { conversationId } = req.body;
  
  // In a production system, you'd track active streams and close them
  logger.info(`Stopping stream for conversation: ${conversationId}`);
  
  res.json({ success: true, conversationId });
});

/**
 * Get available AI models endpoint
 * Returns ALL models from centralized catalog with availability based on configured API keys
 */
router.get('/agent/models', ensureAuthenticated, (req, res) => {
  const { AI_MODELS } = require('../ai/models-catalog');
  const providerAvailability: Record<string, boolean> = {
    openai: !!process.env.OPENAI_API_KEY || !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    anthropic: !!process.env.ANTHROPIC_API_KEY || !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_AI_API_KEY || !!process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
    xai: !!process.env.XAI_API_KEY || !!process.env.AI_INTEGRATIONS_XAI_API_KEY,
    moonshot: !!process.env.MOONSHOT_API_KEY || !!process.env.AI_INTEGRATIONS_MOONSHOT_API_KEY,
    groq: !!process.env.GROQ_API_KEY || !!process.env.AI_INTEGRATIONS_GROQ_API_KEY,
  };
  const models = AI_MODELS.map((m: any) => ({
    provider: m.provider,
    model: m.id,
    name: m.name,
    description: m.description,
    context: m.maxTokens,
    available: providerAvailability[m.provider] || false,
  }));
  res.json(models);
});

export default router;