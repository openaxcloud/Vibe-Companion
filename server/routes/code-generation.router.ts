import { Router } from 'express';
import { z } from 'zod';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { createLogger } from '../utils/logger';
import { tierRateLimiters } from '../middleware/tier-rate-limiter';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

const logger = createLogger('code-generation-router');
const router = Router();

// Validation schema
const codeGenerationSchema = z.object({
  prompt: z.string().min(10).max(5000),
  language: z.string().optional().default('typescript'),
  modelId: z.string().optional(),
  context: z.string().optional(),
  files: z.array(z.object({
    path: z.string(),
    content: z.string()
  })).optional()
});

/**
 * POST /api/code-generation/generate
 * Generate code using AI with Server-Sent Events streaming
 */
router.post('/generate', tierRateLimiters.api, async (req, res) => {
  try {
    const validated = codeGenerationSchema.parse(req.body);
    const { prompt, language, modelId, context, files } = validated;
    
    logger.info('[Code Generation] Request received', {
      promptLength: prompt.length,
      language,
      modelId,
      hasContext: !!context,
      fileCount: files?.length || 0
    });
    
    // Set SSE headers with CORS security - reject invalid origins with 403
    if (!validateAndSetSSEHeaders(res, req)) {
      return;
    }
    
    // Build system prompt
    const systemPrompt = `You are an expert ${language || 'code'} developer. Generate clean, production-ready code based on the user's requirements.

${context ? `Context: ${context}` : ''}

${files && files.length > 0 ? `Referenced Files:\n${files.map(f => `\n--- ${f.path} ---\n${f.content}`).join('\n')}` : ''}

Requirements:
1. Write ${language || 'code'} code only (no explanations unless asked)
2. Follow best practices and conventions for ${language || 'the language'}
3. Include proper error handling
4. Add comments for complex logic
5. Make code production-ready and maintainable

Generate the code now:`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ];
    
    // Get model or use default
    const model = modelId || 'gpt-4.1';
    logger.info('[Code Generation] Using model:', model);
    
    const usesMaxCompletionTokens = /^o[1-9]/.test(model) || /^gpt-4.1/.test(model);
    
    const streamOptions: any = {};
    
    // Set correct token limit parameter based on model
    if (usesMaxCompletionTokens) {
      streamOptions.max_completion_tokens = 4000;
    } else {
      streamOptions.max_tokens = 4000;
    }
    
    // Only add temperature for models that support it (GPT-4, Claude, Gemini, etc.)
    // GPT-4.1 family and o-series models don't support custom temperature
    if (!usesMaxCompletionTokens) {
      streamOptions.temperature = 0.3; // Lower temperature for more consistent code
    }
    
    const stream = aiProviderManager.streamChat(model, messages, streamOptions);
    
    let generatedCode = '';
    let chunkCount = 0;
    
    for await (const content of stream) {
      generatedCode += content;
      chunkCount++;
      
      // Send SSE event
      res.write(`data: ${JSON.stringify({
        type: 'chunk',
        content,
        totalLength: generatedCode.length,
        chunkNumber: chunkCount
      })}\n\n`);
    }
    
    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      totalLength: generatedCode.length,
      totalChunks: chunkCount
    })}\n\n`);
    
    logger.info('[Code Generation] Stream completed', {
      totalLength: generatedCode.length,
      totalChunks: chunkCount,
      model
    });
    
    res.end();
  } catch (error: any) {
    logger.error('[Code Generation] Error:', error);
    
    // Send error event
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message || 'Code generation failed'
    })}\n\n`);
    
    res.end();
  }
});

/**
 * GET /api/code-generation/models
 * Get available AI models for code generation
 */
router.get('/models', tierRateLimiters.api, async (req, res) => {
  try {
    const models = aiProviderManager.getAvailableModels();
    
    // Filter to only models suitable for code generation (all support streaming)
    const codeGenModels = models
      .filter(m => m.supportsStreaming)
      .map(m => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
        description: m.description,
        maxTokens: m.maxTokens,
        costPer1kTokens: m.costPer1kTokens
      }));
    
    res.json({
      models: codeGenModels,
      defaultModel: 'gpt-4.1'
    });
  } catch (error: any) {
    logger.error('[Code Generation] Error getting models:', error);
    res.status(500).json({ error: 'Failed to get available models' });
  }
});

/**
 * GET /api/code-generation/languages
 * Get supported programming languages
 */
router.get('/languages', tierRateLimiters.api, async (req, res) => {
  const languages = [
    { id: 'typescript', name: 'TypeScript', extension: '.ts' },
    { id: 'javascript', name: 'JavaScript', extension: '.js' },
    { id: 'python', name: 'Python', extension: '.py' },
    { id: 'java', name: 'Java', extension: '.java' },
    { id: 'csharp', name: 'C#', extension: '.cs' },
    { id: 'go', name: 'Go', extension: '.go' },
    { id: 'rust', name: 'Rust', extension: '.rs' },
    { id: 'cpp', name: 'C++', extension: '.cpp' },
    { id: 'ruby', name: 'Ruby', extension: '.rb' },
    { id: 'php', name: 'PHP', extension: '.php' },
    { id: 'swift', name: 'Swift', extension: '.swift' },
    { id: 'kotlin', name: 'Kotlin', extension: '.kt' },
    { id: 'sql', name: 'SQL', extension: '.sql' },
    { id: 'html', name: 'HTML', extension: '.html' },
    { id: 'css', name: 'CSS', extension: '.css' }
  ];
  
  res.json({ languages });
});

export default router;
