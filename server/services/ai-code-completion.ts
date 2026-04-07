// @ts-nocheck
import { aiProviderManager } from '../ai/ai-provider-manager';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};
import { CodeAnalyzer } from '../ai/code-analyzer';
import { createLogger } from '../utils/logger';
import { LRUCache } from 'lru-cache';
import * as crypto from 'crypto';

const logger = createLogger('ai-code-completion');
const codeAnalyzer = new CodeAnalyzer();

interface CodeContext {
  currentFile: string;
  fileName: string;
  language: string;
  cursorPosition: {
    line: number;
    column: number;
  };
  currentLine: string;
  precedingCode: string;
  followingCode: string;
  visibleRange?: {
    startLine: number;
    endLine: number;
  };
}

interface CodeCompletionSuggestion {
  text: string;
  label: string;
  detail?: string;
  documentation?: string;
  insertText: string;
  kind: 'snippet' | 'function' | 'variable' | 'class' | 'keyword' | 'text';
  confidence: number;
  isAIGenerated: true;
  explanation?: string;
}

interface CompletionRequest {
  context: CodeContext;
  userId?: string;
  model?: string;
  triggerKind?: 'automatic' | 'manual';
  maxSuggestions?: number;
  temperature?: number;
}

class AICodeCompletionService {
  private suggestionCache: LRUCache<string, CodeCompletionSuggestion[]>;
  private pendingRequests: Map<string, Promise<CodeCompletionSuggestion[]>>;
  
  constructor() {
    // Cache with 100 entries and 5 minute TTL
    this.suggestionCache = new LRUCache({
      max: 100,
      ttl: 5 * 60 * 1000,
    });
    
    this.pendingRequests = new Map();
  }
  
  /**
   * Generate a cache key for the given context
   */
  private getCacheKey(context: CodeContext, model?: string): string {
    const keyData = {
      file: context.fileName,
      line: context.cursorPosition.line,
      column: context.cursorPosition.column,
      currentLine: context.currentLine,
      precedingCode: context.precedingCode.slice(-200), // Last 200 chars
      followingCode: context.followingCode.slice(0, 100), // First 100 chars
      model: model || 'default',
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }
  
  /**
   * Get intelligent code completions
   */
  async getCompletions(request: CompletionRequest): Promise<CodeCompletionSuggestion[]> {
    const { context, userId, model = 'Claude Sonnet 4.5', maxSuggestions = 5, temperature = 0.2 } = request;
    
    // Check cache first
    const cacheKey = this.getCacheKey(context, model);
    const cached = this.suggestionCache.get(cacheKey);
    if (cached) {
      logger.info('Returning cached suggestions', { cacheKey });
      return cached;
    }
    
    // Prevent duplicate requests for the same context
    if (this.pendingRequests.has(cacheKey)) {
      logger.info('Waiting for pending request', { cacheKey });
      return this.pendingRequests.get(cacheKey)!;
    }
    
    // Create the completion request
    const completionPromise = this.generateCompletions(context, model, maxSuggestions, temperature, userId);
    this.pendingRequests.set(cacheKey, completionPromise);
    
    try {
      const suggestions = await completionPromise;
      
      // Cache the result
      if (suggestions.length > 0) {
        this.suggestionCache.set(cacheKey, suggestions);
      }
      
      return suggestions;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }
  
  /**
   * Generate completions using AI
   */
  private async generateCompletions(
    context: CodeContext,
    model: string,
    maxSuggestions: number,
    temperature: number,
    userId?: string
  ): Promise<CodeCompletionSuggestion[]> {
    try {
      // Limit context size for performance
      const maxContextLines = 500;
      const contextCode = this.prepareContextCode(context, maxContextLines);
      
      // Analyze code for better understanding
      const codeAnalysis = await codeAnalyzer.analyzeCode(contextCode, context.language);
      
      // Build the prompt
      const prompt = this.buildCompletionPrompt(context, contextCode, codeAnalysis);
      
      // Get the AI provider
      const provider = aiProviderManager.getProvider(model) || aiProviderManager.getDefaultProvider();
      
      // Generate completion
      const systemPrompt = this.buildSystemPrompt(context.language);
      const response = await provider.generateCompletion(
        prompt, 
        systemPrompt, 
        1024, 
        temperature,
        userId ? parseInt(userId) : undefined
      );
      
      // Parse and format the suggestions
      const suggestions = this.parseSuggestions(response, context);
      
      logger.info('Generated code completions', {
        model,
        language: context.language,
        suggestionsCount: suggestions.length,
      });
      
      return suggestions;
    } catch (error) {
      logger.error('Error generating completions', { error, model });
      return [];
    }
  }
  
  /**
   * Prepare the context code with size limits
   */
  private prepareContextCode(context: CodeContext, maxLines: number): string {
    const lines = context.currentFile.split('\n');
    const currentLineIdx = context.cursorPosition.line - 1;
    
    // Calculate the window around the cursor
    const halfWindow = Math.floor(maxLines / 2);
    const startLine = Math.max(0, currentLineIdx - halfWindow);
    const endLine = Math.min(lines.length, currentLineIdx + halfWindow);
    
    // Get the relevant code window
    const relevantLines = lines.slice(startLine, endLine);
    
    return relevantLines.join('\n');
  }
  
  /**
   * Build the system prompt for the AI
   */
  private buildSystemPrompt(language: string): string {
    return `You are an expert ${language} developer providing intelligent code completions.
Your task is to provide helpful, contextually relevant code suggestions that:
1. Complete the current line or block being written
2. Follow the existing code style and patterns
3. Use appropriate variable names and conventions
4. Provide multiple relevant options when possible

Return suggestions in JSON format:
[
  {
    "text": "display text for the suggestion",
    "insertText": "actual text to insert",
    "detail": "brief description",
    "explanation": "why this suggestion is relevant",
    "kind": "snippet|function|variable|class|keyword|text",
    "confidence": 0.9
  }
]

Focus on practical, working code that the developer would actually want to use.
Provide between 1 and 5 suggestions, ordered by relevance.`;
  }
  
  /**
   * Build the completion prompt
   */
  private buildCompletionPrompt(
    context: CodeContext,
    contextCode: string,
    codeAnalysis: any
  ): string {
    const { cursorPosition, currentLine, language } = context;
    
    // Extract key information from analysis
    const functions = codeAnalysis.functions?.map((f: any) => f.name) || [];
    const classes = codeAnalysis.classes?.map((c: any) => c.name) || [];
    const variables = codeAnalysis.variables?.map((v: any) => v.name) || [];
    
    return `Language: ${language}
File: ${context.fileName}

Code Context:
\`\`\`${language}
${contextCode}
\`\`\`

Current cursor position: Line ${cursorPosition.line}, Column ${cursorPosition.column}
Current line being edited: "${currentLine}"

Available in scope:
- Functions: ${functions.join(', ') || 'none'}
- Classes: ${classes.join(', ') || 'none'}  
- Variables: ${variables.join(', ') || 'none'}

The user is typing at the cursor position. Provide intelligent code completions that would naturally continue from this point.
Consider:
1. What the user is likely trying to accomplish
2. Common patterns in ${language}
3. The existing code style and conventions

Provide practical suggestions that complete the current statement, expression, or block.`;
  }
  
  /**
   * Parse AI response into suggestions
   */
  private parseSuggestions(response: string, context: CodeContext): CodeCompletionSuggestion[] {
    try {
      // Try to parse as JSON first
      let suggestions: any[];
      
      // Extract JSON from the response if it's wrapped in markdown
      const jsonMatch = response.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[1]);
      } else {
        // Try direct JSON parse
        suggestions = JSON.parse(response);
      }
      
      // Validate and format suggestions
      return suggestions
        .filter(s => s.text && s.insertText)
        .map(s => ({
          text: s.text,
          label: s.text,
          detail: s.detail || `AI suggestion for ${context.language}`,
          documentation: s.explanation,
          insertText: s.insertText,
          kind: this.validateKind(s.kind),
          confidence: s.confidence || 0.7,
          isAIGenerated: true,
          explanation: s.explanation,
        }))
        .slice(0, 5); // Max 5 suggestions
      
    } catch (error) {
      logger.error('Failed to parse AI suggestions', { error, response });
      
      // Fallback: try to extract code blocks as suggestions
      const codeBlocks = response.match(/```[\w]*\n([\s\S]*?)```/g);
      if (codeBlocks && codeBlocks.length > 0) {
        return codeBlocks.slice(0, 3).map(block => {
          const code = block.replace(/```[\w]*\n?|```/g, '').trim();
          return {
            text: code.split('\n')[0].substring(0, 50) + '...',
            label: 'AI Suggestion',
            detail: 'AI-generated code',
            insertText: code,
            kind: 'snippet',
            confidence: 0.6,
            isAIGenerated: true,
            documentation: 'AI-generated completion',
          };
        });
      }
      
      return [];
    }
  }
  
  /**
   * Validate and normalize suggestion kind
   */
  private validateKind(kind: string): CodeCompletionSuggestion['kind'] {
    const validKinds: CodeCompletionSuggestion['kind'][] = [
      'snippet', 'function', 'variable', 'class', 'keyword', 'text'
    ];
    
    const normalizedKind = kind?.toLowerCase() as CodeCompletionSuggestion['kind'];
    return validKinds.includes(normalizedKind) ? normalizedKind : 'text';
  }
  
  /**
   * Get available AI models
   */
  getAvailableModels() {
    return aiProviderManager.getAvailableProviders();
  }
  
  /**
   * Clear the cache
   */
  clearCache() {
    this.suggestionCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.suggestionCache.size,
      calculatedSize: this.suggestionCache.calculatedSize,
    };
  }
}

// Export singleton instance
export const aiCodeCompletionService = new AICodeCompletionService();