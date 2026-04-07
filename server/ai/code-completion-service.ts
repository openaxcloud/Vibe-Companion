/**
 * AI-powered inline code completion service
 * Provides real-time code suggestions as users type, similar to GitHub Copilot
 */

import Anthropic from '@anthropic-ai/sdk';
import { OpenAI } from 'openai';
import { createLogger } from '../utils/logger';

const logger = createLogger('code-completion-service');

interface CompletionRequest {
  code: string;
  position: { line: number; column: number };
  language: string;
  fileName: string;
  projectContext?: string;
}

interface CompletionResponse {
  completions: Array<{
    text: string;
    confidence: number;
    range?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
  }>;
}

export class CodeCompletionService {
  private static instance: CodeCompletionService;
  private anthropic: Anthropic;
  private openai: OpenAI | null = null;
  
  // Cache for recent completions to improve performance
  private completionCache = new Map<string, CompletionResponse>();
  private cacheTimeout = 5000; // 5 seconds

  private constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    });
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  static getInstance(): CodeCompletionService {
    if (!CodeCompletionService.instance) {
      CodeCompletionService.instance = new CodeCompletionService();
    }
    return CodeCompletionService.instance;
  }

  async getCompletions(request: CompletionRequest): Promise<CompletionResponse> {
    const cacheKey = this.getCacheKey(request);
    
    // Check cache first
    const cached = this.completionCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Extract context around cursor position
      const lines = request.code.split('\n');
      const currentLine = lines[request.position.line - 1] || '';
      const prefix = currentLine.substring(0, request.position.column);
      const suffix = currentLine.substring(request.position.column);
      
      // Get surrounding context (5 lines before and after)
      const contextStart = Math.max(0, request.position.line - 6);
      const contextEnd = Math.min(lines.length, request.position.line + 5);
      const contextLines = lines.slice(contextStart, contextEnd);
      
      // Build prompt for AI
      const prompt = this.buildCompletionPrompt({
        language: request.language,
        fileName: request.fileName,
        contextLines: contextLines.join('\n'),
        currentLinePrefix: prefix,
        currentLineSuffix: suffix,
        lineNumber: request.position.line - contextStart,
        projectContext: request.projectContext
      });

      // Use Claude for high-quality completions
      const response = await this.getClaudeCompletion(prompt);
      
      // Parse and format response
      const completions = this.parseCompletions(response, request.position);
      
      const result: CompletionResponse = { completions };
      
      // Cache the result
      this.completionCache.set(cacheKey, result);
      setTimeout(() => this.completionCache.delete(cacheKey), this.cacheTimeout);
      
      return result;
    } catch (error) {
      logger.error('Error getting completions:', error);
      return { completions: [] };
    }
  }

  private buildCompletionPrompt(context: {
    language: string;
    fileName: string;
    contextLines: string;
    currentLinePrefix: string;
    currentLineSuffix: string;
    lineNumber: number;
    projectContext?: string;
  }): string {
    return `You are an expert code completion assistant. Provide intelligent inline code completions.

Language: ${context.language}
File: ${context.fileName}
${context.projectContext ? `Project Context: ${context.projectContext}\n` : ''}

Current code context:
\`\`\`${context.language}
${context.contextLines}
\`\`\`

The cursor is at line ${context.lineNumber + 1}, after: "${context.currentLinePrefix}"
The rest of the line is: "${context.currentLineSuffix}"

Provide up to 3 high-quality code completions that would naturally continue from the cursor position.
Consider:
1. The programming language conventions and idioms
2. The existing code style and patterns
3. Variable names and functions already defined
4. Common patterns for the current context

Return completions in this JSON format:
{
  "completions": [
    {
      "text": "the code to insert",
      "confidence": 0.9,
      "reasoning": "why this completion makes sense"
    }
  ]
}

Only provide completions that are highly relevant and would actually help the developer.`;
  }

  private async getClaudeCompletion(prompt: string): Promise<string> {
    try {
      // Try Claude first (best for code completion)
      if (this.anthropic.apiKey) {
        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2, // Lower temperature for more deterministic completions
        });
        
        return message.content[0].type === 'text' ? message.content[0].text : '';
      }
      
      // Fallback to OpenAI if available
      if (this.openai) {
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 300,
        });
        
        return completion.choices[0]?.message?.content || '';
      }
      
      return '';
    } catch (error) {
      logger.error('AI provider error:', error);
      return '';
    }
  }

  private parseCompletions(aiResponse: string, position: { line: number; column: number }): CompletionResponse['completions'] {
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return parsed.completions.map((comp: any) => ({
        text: comp.text,
        confidence: comp.confidence || 0.5,
        range: {
          startLine: position.line,
          startColumn: position.column,
          endLine: position.line,
          endColumn: position.column + comp.text.length
        }
      })).filter((comp: any) => comp.text && comp.text.trim().length > 0);
    } catch (error) {
      logger.error('Error parsing completions:', error);
      return [];
    }
  }

  private getCacheKey(request: CompletionRequest): string {
    return `${request.fileName}:${request.position.line}:${request.position.column}:${request.code.substring(
      Math.max(0, request.position.column - 50),
      request.position.column
    )}`;
  }

  // Get quick completions for common patterns (no AI needed)
  getQuickCompletions(request: CompletionRequest): CompletionResponse {
    const completions: CompletionResponse['completions'] = [];
    const lines = request.code.split('\n');
    const currentLine = lines[request.position.line - 1] || '';
    const prefix = currentLine.substring(0, request.position.column).trimStart();
    
    // Quick patterns based on language
    if (request.language === 'javascript' || request.language === 'typescript') {
      if (prefix.endsWith('console.')) {
        completions.push(
          { text: 'log()', confidence: 0.9 },
          { text: 'error()', confidence: 0.7 },
          { text: 'warn()', confidence: 0.6 }
        );
      } else if (prefix.endsWith('async ')) {
        completions.push(
          { text: 'function ', confidence: 0.8 },
          { text: '() => ', confidence: 0.7 }
        );
      } else if (prefix === 'import ') {
        completions.push(
          { text: '{ } from \'\'', confidence: 0.9 },
          { text: '* as  from \'\'', confidence: 0.6 }
        );
      }
    }
    
    return { completions };
  }

  // Method to train/improve completions based on user acceptance
  async recordCompletionFeedback(
    completion: string,
    accepted: boolean,
    context: CompletionRequest
  ): Promise<void> {
    // This could be used to improve future completions
    // Feedback data could be stored in database for analysis
  }
}