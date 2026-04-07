// @ts-nocheck
/**
 * Enhanced OpenAI Provider with all latest models and capabilities
 * Includes support for GPT-4o, o1 models, vision, and function calling
 */

import OpenAI from 'openai';

interface AIProvider {
  name: string;
  generateCompletion(prompt: string, systemPrompt: string, maxTokens?: number, temperature?: number, userId?: number): Promise<string>;
  generateChat(messages: ChatMessage[], maxTokens?: number, temperature?: number, userId?: number): Promise<string>;
  generateCodeWithUnderstanding(code: string, language: string, instruction: string, userId?: number): Promise<string>;
  analyzeCode(code: string, language: string): Promise<any>;
  isAvailable(): boolean;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | any[];
}
import { createLogger } from '../utils/logger';
import { aiBillingService } from '../services/ai-billing-service';

const logger = createLogger('openai-enhanced-provider');

export interface OpenAIModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxOutput: number;
  capabilities: string[];
  pricing: {
    input: number;
    output: number;
  };
}

const MODEL_ALIAS_MAP: Record<string, string> = {
  'gpt-5.1':       'gpt-4.1',
  'gpt-5':         'gpt-4.1',
  'gpt-5-mini':    'gpt-4.1-mini',
  'gpt-5-nano':    'gpt-4.1-nano',
  'gpt-5.2':       'gpt-4.1',
  'gpt-5.2-codex': 'gpt-4.1',
};

export const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  'gpt-4.1': {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    contextWindow: 1000000,
    maxOutput: 32768,
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'structured_outputs'],
    pricing: { input: 0.002, output: 0.008 }
  },
  'gpt-4.1-mini': {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    contextWindow: 1000000,
    maxOutput: 16384,
    capabilities: ['chat', 'function_calling', 'json_mode', 'structured_outputs'],
    pricing: { input: 0.0004, output: 0.0016 }
  },
  'gpt-4.1-nano': {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    contextWindow: 1000000,
    maxOutput: 8192,
    capabilities: ['chat', 'function_calling'],
    pricing: { input: 0.0001, output: 0.0004 }
  },
  'gpt-4o': {
    id: 'gpt-4o',
    name: 'GPT-4o',
    contextWindow: 128000,
    maxOutput: 16384,
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'structured_outputs'],
    pricing: { input: 0.005, output: 0.015 }
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    contextWindow: 128000,
    maxOutput: 16384,
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'structured_outputs'],
    pricing: { input: 0.00015, output: 0.0006 }
  },
  'gpt-4-turbo': {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxOutput: 4096,
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'structured_outputs'],
    pricing: { input: 0.01, output: 0.03 }
  },
  // GPT-4.x models
  'gpt-4-turbo-preview': {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo Preview (Latest)',
    contextWindow: 128000,
    maxOutput: 4096,
    capabilities: ['chat', 'vision', 'function_calling', 'json_mode', 'structured_outputs'],
    pricing: { input: 0.01, output: 0.03 }
  },
  'gpt-4': {
    id: 'gpt-4',
    name: 'GPT-4',
    contextWindow: 8192,
    maxOutput: 4096,
    capabilities: ['chat', 'function_calling', 'json_mode'],
    pricing: { input: 0.03, output: 0.06 }
  },
  'gpt-3.5-turbo': {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    contextWindow: 16384,
    maxOutput: 4096,
    capabilities: ['chat', 'function_calling', 'json_mode'],
    pricing: { input: 0.0005, output: 0.0015 }
  }
};

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: any;
}

export interface OpenAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  responseFormat?: 'text' | 'json_object';
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  stream?: boolean;
  seed?: number;
  logprobs?: boolean;
  topLogprobs?: number;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

export class EnhancedOpenAIProvider implements AIProvider {
  name = 'OpenAI Enhanced';
  private client: OpenAI;
  private defaultModel = 'gpt-4.1';
  
  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
      maxRetries: 3,
      timeout: 60000,
    });
    
    logger.info('Enhanced OpenAI Provider initialized with all latest models');
  }
  
  /**
   * Generate completion with full model support
   */
  async generateCompletion(
    prompt: string,
    systemPrompt: string,
    maxTokens = 1024,
    temperature = 0.2,
    userId?: number,
    options?: OpenAIOptions
  ): Promise<string> {
    const model = options?.model || this.defaultModel;
    const resolvedModel = MODEL_ALIAS_MAP[model] || model;
    const modelConfig = OPENAI_MODELS[resolvedModel];
    
    if (!modelConfig) {
      throw new Error(`Unsupported model: ${resolvedModel}`);
    }
    
    try {
      // GPT-4 and earlier use legacy Chat Completions API
      // Check if this is an o-series model that requires different parameters
      const isOSeriesModel = /^o[1-9]/.test(resolvedModel);

      const completionParams: any = {
        model: resolvedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        response_format: options?.responseFormat ? { type: options.responseFormat } : undefined,
        seed: options?.seed,
        logprobs: options?.logprobs,
        top_logprobs: options?.topLogprobs,
      };

      if (isOSeriesModel) {
        completionParams.max_completion_tokens = Math.min(maxTokens, modelConfig.maxOutput);
        // Don't set temperature for o-series models
      } else {
        completionParams.max_tokens = Math.min(maxTokens, modelConfig.maxOutput);
        completionParams.temperature = temperature;
      }

      const completion = await this.client.chat.completions.create(completionParams);
      
      const result = completion.choices[0].message.content?.trim() || '';
      
      // Track usage for billing
      if (userId && completion.usage) {
        await aiBillingService.trackAIUsage(userId, {
          model: resolvedModel,
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
    } catch (error) {
      logger.error(`Error generating completion with ${resolvedModel}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Generate chat with function calling support
   */
  async generateChatWithFunctions(
    messages: ChatMessage[],
    functions: FunctionDefinition[],
    userId?: number,
    options?: OpenAIOptions
  ): Promise<{
    content: string;
    functionCall?: {
      name: string;
      arguments: any;
    };
  }> {
    const model = options?.model || this.defaultModel;
    const resolvedModel = MODEL_ALIAS_MAP[model] || model;
    const modelConfig = OPENAI_MODELS[resolvedModel];
    
    if (!modelConfig || !modelConfig.capabilities.includes('function_calling')) {
      throw new Error(`Model ${resolvedModel} does not support function calling`);
    }
    
    try {
      // GPT-4 and earlier use Chat Completions API
      // Check if this is an o-series model that requires different parameters
      const isOSeriesModel = /^o[1-9]/.test(resolvedModel);

      const chatParams: any = {
        model: resolvedModel,
        messages: messages as any,
        tools: functions.map(fn => ({
          type: 'function' as const,
          function: fn
        })),
        tool_choice: options?.functionCall || 'auto',
      };

      if (isOSeriesModel) {
        chatParams.max_completion_tokens = options?.maxTokens || 1024;
        // Don't set temperature for o-series models
      } else {
        chatParams.max_tokens = options?.maxTokens || 1024;
        chatParams.temperature = options?.temperature || 0.5;
      }

      const completion = await this.client.chat.completions.create(chatParams);
      
      const message = completion.choices[0].message;
      const result = {
        content: message.content || '',
        functionCall: message.tool_calls?.[0] ? {
          name: message.tool_calls[0].function.name,
          arguments: JSON.parse(message.tool_calls[0].function.arguments)
        } : undefined
      };
      
      // Track usage
      if (userId && completion.usage) {
        await aiBillingService.trackAIUsage(userId, {
          model: resolvedModel,
          provider: 'OpenAI',
          inputTokens: completion.usage.prompt_tokens || 0,
          outputTokens: completion.usage.completion_tokens || 0,
          totalTokens: completion.usage.total_tokens || 0,
          purpose: 'completion',
          timestamp: new Date()
        });
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in function calling with ${resolvedModel}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Generate vision analysis with GPT-4o models
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string,
    userId?: number,
    options?: OpenAIOptions
  ): Promise<string> {
    const model = options?.model || 'gpt-4.1';
    const resolvedModel = MODEL_ALIAS_MAP[model] || model;
    const modelConfig = OPENAI_MODELS[resolvedModel];
    
    if (!modelConfig || !modelConfig.capabilities.includes('vision')) {
      throw new Error(`Model ${resolvedModel} does not support vision`);
    }
    
    try {
      // Check if this is a new-gen model (o-series) that requires different parameters
      const isNewGenModel = /^o[1-9]/.test(resolvedModel);

      const visionParams: any = {
        model: resolvedModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }
        ],
      };

      if (isNewGenModel) {
        visionParams.max_completion_tokens = options?.maxTokens || 1024;
        // Don't set temperature for new-gen models
      } else {
        visionParams.max_tokens = options?.maxTokens || 1024;
        visionParams.temperature = options?.temperature || 0.5;
      }

      const completion = await this.client.chat.completions.create(visionParams);
      
      const result = completion.choices[0].message.content || '';
      
      // Track usage
      if (userId && completion.usage) {
        await aiBillingService.trackAIUsage(userId, {
          model: resolvedModel,
          provider: 'OpenAI',
          inputTokens: completion.usage.prompt_tokens || 0,
          outputTokens: completion.usage.completion_tokens || 0,
          totalTokens: completion.usage.total_tokens || 0,
          purpose: 'vision',
          timestamp: new Date()
        });
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in vision analysis with ${resolvedModel}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Stream chat responses for real-time interaction
   */
  async *streamChat(
    messages: ChatMessage[],
    userId?: number,
    options?: OpenAIOptions
  ): AsyncGenerator<string> {
    const model = options?.model || this.defaultModel;
    const resolvedModel = MODEL_ALIAS_MAP[model] || model;
    
    try {
      // Check if this is an o-series model that requires different parameters
      const isOSeriesModel = /^o[1-9]/.test(resolvedModel);

      const streamParams: any = {
        model: resolvedModel,
        messages: messages as any,
        stream: true,
      };

      if (isOSeriesModel) {
        streamParams.max_completion_tokens = options?.maxTokens || 1024;
        // Don't set temperature for o-series models
      } else {
        streamParams.max_tokens = options?.maxTokens || 1024;
        streamParams.temperature = options?.temperature || 0.5;
      }

      const stream = await this.client.chat.completions.create(streamParams);
      
      let totalTokens = 0;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          totalTokens += Math.ceil(content.length / 4); // Rough token estimate
          yield content;
        }
      }
      
      // Track usage (estimated for streaming)
      if (userId) {
        const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
        await aiBillingService.trackAIUsage(userId, {
          model: resolvedModel,
          provider: 'OpenAI',
          inputTokens,
          outputTokens: totalTokens,
          totalTokens: inputTokens + totalTokens,
          purpose: 'streaming',
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error(`Error in streaming with ${resolvedModel}: ${error}`);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for vector search
   */
  async generateEmbeddings(
    texts: string[],
    userId?: number,
    model = 'text-embedding-3-small'
  ): Promise<number[][]> {
    try {
      const response = await this.client.embeddings.create({
        model,
        input: texts,
      });
      
      const embeddings = response.data.map(item => item.embedding);
      
      // Track usage
      if (userId && response.usage) {
        await aiBillingService.trackAIUsage(userId, {
          model,
          provider: 'OpenAI',
          inputTokens: response.usage.prompt_tokens || 0,
          outputTokens: 0,
          totalTokens: response.usage.total_tokens || 0,
          purpose: 'embedding',
          timestamp: new Date()
        });
      }
      
      return embeddings;
    } catch (error) {
      logger.error(`Error generating embeddings: ${error}`);
      throw error;
    }
  }
  
  /**
   * Generate chat response (standard interface)
   */
  async generateChat(
    messages: ChatMessage[],
    maxTokens = 1024,
    temperature = 0.5,
    userId?: number
  ): Promise<string> {
    return this.generateCompletion(
      messages[messages.length - 1].content,
      messages[0]?.role === 'system' ? messages[0].content : '',
      maxTokens,
      temperature,
      userId
    );
  }
  
  /**
   * Check if provider is available
   */
  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }
  
  /**
   * Get list of available models
   */
  getAvailableModels(): OpenAIModelConfig[] {
    return Object.values(OPENAI_MODELS);
  }
  
  /**
   * Generate code with understanding
   */
  async generateCodeWithUnderstanding(
    messages: ChatMessage[],
    codeAnalysis: any,
    options?: any
  ): Promise<string> {
    const enhancedMessages = [...messages];
    if (codeAnalysis) {
      enhancedMessages.push({
        role: 'system',
        content: `Code Analysis: ${JSON.stringify(codeAnalysis, null, 2)}`
      });
    }
    
    return this.generateChat(enhancedMessages, options?.maxTokens, options?.temperature, options?.userId);
  }
  
  /**
   * Analyze code
   */
  async analyzeCode(code: string, analysis: string): Promise<any> {
    const prompt = `Analyze the following code and provide ${analysis}:\n\n${code}`;
    const result = await this.generateCompletion(
      prompt,
      'You are an expert code analyst. Provide detailed, actionable insights.',
      2048,
      0.3
    );
    
    try {
      return JSON.parse(result);
    } catch {
      return { analysis: result };
    }
  }
}

// Export singleton instance
export const enhancedOpenAIProvider = new EnhancedOpenAIProvider();