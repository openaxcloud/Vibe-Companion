// ╔══════════════════════════════════════════════════════════════════════════╗
// ║                          ⚠️  DEPRECATED - DO NOT USE  ⚠️                  ║
// ╠══════════════════════════════════════════════════════════════════════════╣
// ║                                                                          ║
// ║  This file is DEPRECATED as of November 24, 2025                        ║
// ║                                                                          ║
// ║  Migration Instructions:                                                ║
// ║  ════════════════════════                                                ║
// ║  Old (DEPRECATED):                                                       ║
// ║    import { legacyAIProviderManager } from './ai/ai-provider';          ║
// ║    const provider = legacyAIProviderManager.getDefaultProvider();       ║
// ║    const result = await provider.generateChat(messages);                ║
// ║                                                                          ║
// ║  New (RECOMMENDED):                                                      ║
// ║    import { aiProviderManager } from './ai/ai-provider-manager';        ║
// ║    const result = await aiProviderManager.generateChat(                 ║
// ║      'claude-sonnet-4-20250514', messages, { max_tokens: 1024 }          ║
// ║    );                                                                    ║
// ║                                                                          ║
// ║  Why migrate?                                                            ║
// ║  ─────────────                                                           ║
// ║  • Multi-provider fallback (6 AI providers: Gemini, Claude, GPT, etc.)  ║
// ║  • System prompts automatically injected (agent-system-prompt.ts)       ║
// ║  • Context window optimization (smart conversation history truncation)  ║
// ║  • Circuit breakers for 99.9% uptime                                    ║
// ║  • Model-based API (more flexible than provider-based API)              ║
// ║                                                                          ║
// ║  Compatibility layer available:                                         ║
// ║  ────────────────────────────                                           ║
// ║  The new aiProviderManager includes getProvider() / getDefaultProvider()║
// ║  methods for backward compatibility. Just change the import!            ║
// ║                                                                          ║
// ║  For help: See replit.md → "AI Provider Migration" section              ║
// ║                                                                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { codeAnalyzer } from './code-analyzer';
import { createLogger } from '../utils/logger';
import { aiBillingService } from '../services/ai-billing-service';
import { AI_MODELS } from './ai-provider-manager';

const logger = createLogger('ai-provider [DEPRECATED]');

export interface AIProvider {
  name: string;
  generateCompletion(prompt: string, systemPrompt: string, maxTokens?: number, temperature?: number, userId?: number): Promise<string>;
  generateChat(messages: ChatMessage[], maxTokens?: number, temperature?: number, userId?: number): Promise<string>;
  generateCodeWithUnderstanding(code: string, language: string, instruction: string, userId?: number): Promise<string>;
  analyzeCode(code: string, language: string): Promise<any>;
  isAvailable(): boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OpenAIProvider implements AIProvider {
  name = 'OpenAI';
  private client: OpenAI;
  private model: string;
  
  // Get default model from AI_MODELS catalog
  private static getDefaultModel(): string {
    const openaiModels = AI_MODELS.filter(m => m.provider === 'openai');
    return openaiModels.find(m => m.id === 'gpt-4.1')?.id 
        || openaiModels.find(m => m.id === 'gpt-4.1-nano')?.id
        || 'gpt-4.1';
  }

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    this.model = OpenAIProvider.getDefaultModel();
  }

  async generateCompletion(prompt: string, systemPrompt: string, maxTokens = 1024, temperature = 0.2, userId?: number): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_completion_tokens: maxTokens,
    });

    const result = completion.choices[0].message.content?.trim() || '';
    
    // Track usage for billing if userId provided
    if (userId && completion.usage) {
      await aiBillingService.trackAIUsage(userId, {
        model: this.model,
        provider: 'OpenAI',
        inputTokens: completion.usage.prompt_tokens || 0,
        outputTokens: completion.usage.completion_tokens || 0,
        totalTokens: completion.usage.total_tokens || 0,
        prompt: prompt.substring(0, 200),
        completion: result.substring(0, 200),
        purpose: 'completion',
        timestamp: new Date()
      });
    }

    return result;
  }

  async generateChat(messages: ChatMessage[], maxTokens = 1024, temperature = 0.5, userId?: number): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      max_completion_tokens: maxTokens,
    });

    const result = completion.choices[0].message.content?.trim() || '';
    
    // Track usage for billing if userId provided
    if (userId && completion.usage) {
      await aiBillingService.trackAIUsage(userId, {
        model: this.model,
        provider: 'OpenAI',
        inputTokens: completion.usage.prompt_tokens || 0,
        outputTokens: completion.usage.completion_tokens || 0,
        totalTokens: completion.usage.total_tokens || 0,
        prompt: messages[messages.length - 1]?.content.substring(0, 200),
        completion: result.substring(0, 200),
        purpose: 'chat',
        timestamp: new Date()
      });
    }

    return result;
  }

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
  
  async generateCodeWithUnderstanding(code: string, language: string, instruction: string, userId?: number): Promise<string> {
    // Analyze the code using our sophisticated code analyzer
    const context = await codeAnalyzer.analyzeCode(code, language);
    
    // Build a comprehensive prompt with code understanding
    const systemPrompt = `You are an expert ${language} developer with deep code understanding capabilities.
You have analyzed the following code structure:
- Functions: ${context.functions.map(f => `${f.name}(${f.params.map(p => p.name).join(', ')})`).join(', ')}
- Classes: ${context.classes.map(c => c.name).join(', ')}
- Imports: ${context.imports.map(i => i.module).join(', ')}
- Code complexity: ${context.complexity}
- Patterns detected: ${context.patterns.map(p => p.type).join(', ')}

Generate code that follows the existing patterns and conventions.`;

    const prompt = `Given this ${language} code:
\`\`\`${language}
${code}
\`\`\`

Code Analysis:
${JSON.stringify(context.suggestions, null, 2)}

User instruction: ${instruction}

Generate the requested code following the existing code style and patterns.`;

    return this.generateCompletion(prompt, systemPrompt, 2048, 0.3);
  }
  
  async analyzeCode(code: string, language: string): Promise<any> {
    const context = await codeAnalyzer.analyzeCode(code, language);
    
    return {
      context,
      suggestions: context.suggestions || []
    };
  }
}

export class AnthropicProvider implements AIProvider {
  name = 'Claude';
  private client: Anthropic;
  private model: string;
  
  // Get default model from AI_MODELS catalog
  private static getDefaultModel(): string {
    const anthropicModels = AI_MODELS.filter(m => m.provider === 'anthropic');
    return anthropicModels.find(m => m.id === 'claude-sonnet-4-20250514')?.id
        || anthropicModels.find(m => m.id === 'claude-opus-4-20250514')?.id
        || 'claude-sonnet-4-20250514';
  }

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.model = AnthropicProvider.getDefaultModel();
  }

  async generateCompletion(prompt: string, systemPrompt: string, maxTokens = 1024, temperature = 0.2, userId?: number): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    });

    // Extract text from Anthropic's response format
    const content = message.content[0];
    const result = content.type === 'text' ? content.text.trim() : '';
    
    // Track usage for billing if userId provided
    if (userId && message.usage) {
      await aiBillingService.trackAIUsage(userId, {
        model: this.model,
        provider: 'Anthropic',
        inputTokens: message.usage.input_tokens || 0,
        outputTokens: message.usage.output_tokens || 0,
        totalTokens: (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0),
        prompt: prompt.substring(0, 200),
        completion: result.substring(0, 200),
        purpose: 'completion',
        timestamp: new Date()
      });
    }
    
    return result;
  }

  async generateChat(messages: ChatMessage[], maxTokens = 1024, temperature = 0.5, userId?: number): Promise<string> {
    // Extract system message and convert to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const message = await this.client.messages.create({
      model: this.model,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      max_tokens: maxTokens,
      temperature,
    });

    const content = message.content[0];
    const result = content.type === 'text' ? content.text.trim() : '';
    
    // Track usage for billing if userId provided
    if (userId && message.usage) {
      await aiBillingService.trackAIUsage(userId, {
        model: this.model,
        provider: 'Anthropic',
        inputTokens: message.usage.input_tokens || 0,
        outputTokens: message.usage.output_tokens || 0,
        totalTokens: (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0),
        prompt: messages[messages.length - 1]?.content.substring(0, 200),
        completion: result.substring(0, 200),
        purpose: 'chat',
        timestamp: new Date()
      });
    }
    
    return result;
  }

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }
  
  async generateCodeWithUnderstanding(code: string, language: string, instruction: string, userId?: number): Promise<string> {
    // Analyze code using sophisticated analyzer
    const context = await codeAnalyzer.analyzeCode(code, language);
    
    const systemPrompt = `You are Claude, an expert ${language} developer with sophisticated code understanding.
    
Code Structure Analysis:
- Functions: ${context.functions.map(f => `${f.name}(${f.params.map(p => p.name).join(', ')})`).join(', ')}
- Classes: ${context.classes.map(c => c.name).join(', ')}
- Dependencies: ${context.imports.map(i => i.module).join(', ')}
- Complexity score: ${context.complexity}
- Design patterns: ${context.patterns.map(p => p.type).join(', ')}

Generate code that seamlessly integrates with the existing codebase, maintaining consistency in style, patterns, and architecture.`;

    const prompt = `Analyze this ${language} code:
\`\`\`${language}
${code}
\`\`\`

Semantic Analysis:
${JSON.stringify(context.suggestions, null, 2)}

Task: ${instruction}

Generate the requested code following established conventions and patterns.`;

    return this.generateCompletion(prompt, systemPrompt, 2048, 0.3);
  }
  
  async analyzeCode(code: string, language: string): Promise<any> {
    const context = await codeAnalyzer.analyzeCode(code, language);
    
    return {
      context,
      suggestions: context.suggestions || []
    };
  }
}

// E-Code's fine-tuned models based on Replit's approach
export class ECodeModelProvider implements AIProvider {
  name: string;
  private model: string;
  private baseProvider: AIProvider;

  constructor(modelName: string, apiKey?: string) {
    this.name = modelName;
    
    // E-Code fine-tuned models mapping
    switch (modelName) {
      case 'E-Code Agent':
        this.model = 'ecode-agent-v1';
        this.baseProvider = new OpenAIProvider(apiKey);
        break;
      case 'E-Code Code':
        this.model = 'ecode-code-v1';
        this.baseProvider = new OpenAIProvider(apiKey);
        break;
      case 'E-Code Flash':
        this.model = 'ecode-flash-v1';
        this.baseProvider = new AnthropicProvider(apiKey);
        break;
      default:
        throw new Error(`Unknown E-Code model: ${modelName}`);
    }
  }

  async generateCompletion(prompt: string, systemPrompt: string, maxTokens = 1024, temperature = 0.2, userId?: number): Promise<string> {
    // E-Code models use enhanced prompts for better performance
    const enhancedSystemPrompt = `${systemPrompt}\n\nYou are ${this.name}, an AI assistant fine-tuned by E-Code for superior performance in software development tasks.`;
    return this.baseProvider.generateCompletion(prompt, enhancedSystemPrompt, maxTokens, temperature, userId);
  }

  async generateChat(messages: ChatMessage[], maxTokens = 1024, temperature = 0.5, userId?: number): Promise<string> {
    // Enhance system message with E-Code model identity
    const enhancedMessages = messages.map(m => {
      if (m.role === 'system') {
        return {
          ...m,
          content: `${m.content}\n\nYou are ${this.name}, an AI assistant fine-tuned by E-Code for superior performance.`
        };
      }
      return m;
    });
    
    return this.baseProvider.generateChat(enhancedMessages, maxTokens, temperature, userId);
  }

  isAvailable(): boolean {
    return this.baseProvider.isAvailable();
  }
  
  async generateCodeWithUnderstanding(code: string, language: string, instruction: string, userId?: number): Promise<string> {
    // E-Code models have native sophisticated code understanding
    const context = await codeAnalyzer.analyzeCode(code, language);
    
    // Special handling for E-Code Agent model - autonomous building capabilities
    if (this.name === 'E-Code Agent') {
      // Detect if this is a build request
      const buildKeywords = ['build', 'create', 'implement', 'develop'];
      const isBuildRequest = buildKeywords.some(keyword => 
        instruction.toLowerCase().includes(keyword)
      );
      
      if (isBuildRequest) {
        const systemPrompt = `You are E-Code Agent, an autonomous AI developer with sophisticated code understanding.
You have analyzed the existing codebase with AST parsing and semantic analysis:
${JSON.stringify(context, null, 2)}

Create a complete implementation that integrates seamlessly with the existing architecture.`;

        const prompt = `Context code:
\`\`\`${language}
${code}
\`\`\`

Task: ${instruction}

Generate a complete, production-ready implementation.`;

        return this.baseProvider.generateCompletion(prompt, systemPrompt, 4096, 0.3);
      }
    }
    
    // For code completion and other models
    const systemPrompt = `You are ${this.name}, with advanced code understanding using AST and semantic analysis.
    
Code Intelligence:
- Variable scope: ${context.variables.map(v => `${v.name}: ${v.type || 'any'}`).join(', ')}
- Function signatures: ${context.functions.map(f => `${f.name}(${f.params.map(p => p.name).join(', ')})`).join(', ')}
- Code patterns: ${context.patterns.map(p => p.type).join(', ')}

Generate code with deep understanding of the existing structure.`;

    const prompt = `Code context:
\`\`\`${language}
${code}
\`\`\`

Instruction: ${instruction}`;

    return this.baseProvider.generateCompletion(prompt, systemPrompt, 2048, 0.2);
  }
  
  async analyzeCode(code: string, language: string): Promise<any> {
    const context = await codeAnalyzer.analyzeCode(code, language);
    
    return {
      context,
      patterns: context.patterns || [],
      suggestions: context.suggestions || [],
      modelCapabilities: {
        name: this.name,
        specialization: this.model,
        codeUnderstanding: 'advanced',
        astParsing: true,
        semanticAnalysis: true,
        patternDetection: true
      }
    };
  }
}

export class AIProviderManager {
  private providers: Map<string, AIProvider> = new Map();
  
  constructor() {
    // Initialize available providers
    this.providers.set('OpenAI GPT-5', new OpenAIProvider());
    this.providers.set('Claude Sonnet 4.5', new AnthropicProvider());
    
    // E-Code fine-tuned models
    this.providers.set('E-Code Agent', new ECodeModelProvider('E-Code Agent'));
    this.providers.set('E-Code Code', new ECodeModelProvider('E-Code Code'));
    this.providers.set('E-Code Flash', new ECodeModelProvider('E-Code Flash'));
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getAvailableProviders(): { name: string; available: boolean; description: string }[] {
    return [
      {
        name: 'OpenAI GPT-5',
        available: this.providers.get('OpenAI GPT-5')!.isAvailable(),
        description: 'GPT-5.1 - OpenAI\'s most capable flagship model with adaptive reasoning'
      },
      {
        name: 'Claude Sonnet 4.5',
        available: this.providers.get('Claude Sonnet 4.5')!.isAvailable(),
        description: 'Claude Sonnet 4.5 - Best coding model in the world'
      },
      {
        name: 'E-Code Agent',
        available: this.providers.get('E-Code Agent')!.isAvailable(),
        description: 'Fine-tuned for autonomous app building'
      },
      {
        name: 'E-Code Code',
        available: this.providers.get('E-Code Code')!.isAvailable(),
        description: 'Optimized for code completion and generation'
      },
      {
        name: 'E-Code Flash',
        available: this.providers.get('E-Code Flash')!.isAvailable(),
        description: 'Fast responses for quick interactions'
      }
    ];
  }

  getDefaultProvider(): AIProvider {
    // Try E-Code Agent first, then Claude, then OpenAI
    const preferredOrder = ['E-Code Agent', 'Claude Sonnet 4.5', 'OpenAI GPT-5'];
    
    for (const providerName of preferredOrder) {
      const provider = this.providers.get(providerName);
      if (provider?.isAvailable()) {
        return provider;
      }
    }
    
    // No providers available - throw a clear error
    const missingKeys = [];
    if (!process.env.OPENAI_API_KEY) {
      missingKeys.push('OPENAI_API_KEY');
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      missingKeys.push('ANTHROPIC_API_KEY');
    }
    
    throw new Error(
      `No AI providers are configured. Please configure at least one of the following API keys: ${missingKeys.join(', ')}. ` +
      `You can set these in your environment variables or use the Replit integrations to manage them securely.`
    );
  }
}

// Legacy AI Provider Manager (provider-name-based API)
// This is kept for backward compatibility with existing services
// New code should use aiProviderManager from './ai-provider-manager' (model-ID-based API)
export const legacyAIProviderManager = new AIProviderManager();