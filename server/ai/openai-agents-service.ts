// @ts-nocheck
/**
 * OpenAI Agents Service
 * Implements OpenAI's Assistants API for advanced agentic capabilities
 * Includes function calling, code interpreter, and file search
 */

import OpenAI from 'openai';
import { createLogger } from '../utils/logger';
import { AIBillingService } from '../services/ai-billing-service';
import { storage } from '../storage';

const logger = createLogger('openai-agents-service');
const aiBillingService = new AIBillingService();

export interface AgentTool {
  type: 'code_interpreter' | 'file_search' | 'function';
  function?: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface AgentConfig {
  name: string;
  instructions: string;
  model: string;
  tools: AgentTool[];
  temperature?: number;
  topP?: number;
  responseFormat?: 'text' | 'json_object';
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  fileIds?: string[];
  metadata?: Record<string, string>;
}

export interface AgentRunResult {
  messages: AgentMessage[];
  status: 'completed' | 'failed' | 'cancelled' | 'expired' | 'requires_action';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  actions?: Array<{
    toolCallId: string;
    functionName: string;
    arguments: any;
  }>;
  error?: string;
}

export class MissingOpenAIKeyError extends Error {
  constructor(message = 'OpenAI API key is not configured. Please add OPENAI_API_KEY to enable OpenAI agents.') {
    super(message);
    this.name = 'MissingOpenAIKeyError';
  }
}

export class OpenAIAgentsService {
  private client: OpenAI | null;
  private assistants: Map<string, string> = new Map(); // name -> assistant ID
  private threads: Map<string, string> = new Map(); // session ID -> thread ID
  private configured: boolean;

  constructor(apiKey?: string) {
    const resolvedApiKey = apiKey || process.env.OPENAI_API_KEY;
    this.configured = false;

    if (!resolvedApiKey) {
      this.client = null;
      logger.warn('OpenAI API key not configured. OpenAI Agents functionality is disabled.');
      return;
    }

    this.client = new OpenAI({
      apiKey: resolvedApiKey,
      maxRetries: 3,
      timeout: 120000, // 2 minute timeout for long-running operations
    });

    this.configured = true;
    logger.info('OpenAI Agents Service initialized');
  }

  private ensureClient(): OpenAI {
    if (!this.client) {
      throw new MissingOpenAIKeyError();
    }

    return this.client;
  }

  isConfigured(): boolean {
    return this.configured;
  }
  
  /**
   * Create or get an assistant with specific capabilities
   */
  async createOrGetAssistant(config: AgentConfig): Promise<string> {
    // Check if assistant already exists
    if (this.assistants.has(config.name)) {
      return this.assistants.get(config.name)!;
    }
    
    try {
      const client = this.ensureClient();

      // Create new assistant
      const assistant = await client.beta.assistants.create({
        name: config.name,
        instructions: config.instructions,
        model: config.model,
        tools: config.tools.map(tool => {
          if (tool.type === 'function' && tool.function) {
            return {
              type: 'function',
              function: tool.function
            };
          }
          return { type: tool.type };
        }),
        temperature: config.temperature,
        top_p: config.topP,
        response_format: config.responseFormat ? { type: config.responseFormat } : undefined,
      });
      
      this.assistants.set(config.name, assistant.id);
      logger.info(`Created assistant: ${config.name} with ID: ${assistant.id}`);
      
      return assistant.id;
    } catch (error) {
      logger.error(`Failed to create assistant: ${error}`);
      throw error;
    }
  }
  
  /**
   * Create a coding assistant with code interpreter
   */
  async createCodingAssistant(): Promise<string> {
    return this.createOrGetAssistant({
      name: 'E-Code Coding Assistant',
      instructions: `You are an expert software developer assistant. You can:
        - Write, analyze, and debug code in any programming language
        - Execute Python code using the code interpreter
        - Generate complete applications with proper architecture
        - Refactor and optimize existing code
        - Create unit tests and documentation
        - Analyze code for security vulnerabilities
        Always provide clean, production-ready code with best practices.`,
      model: 'gpt-4.1',
      tools: [
        { type: 'code_interpreter' },
        { type: 'file_search' }
      ],
      temperature: 0.2,
    });
  }
  
  /**
   * Create a research assistant with file search
   */
  async createResearchAssistant(): Promise<string> {
    return this.createOrGetAssistant({
      name: 'E-Code Research Assistant',
      instructions: `You are an expert research assistant. You can:
        - Search through uploaded documents and files
        - Extract and summarize information
        - Answer questions based on document content
        - Compare and analyze multiple sources
        - Generate reports and insights
        Provide accurate, well-sourced information with citations when possible.`,
      model: 'gpt-4.1',
      tools: [
        { type: 'file_search' }
      ],
      temperature: 0.3,
    });
  }
  
  /**
   * Create an agentic assistant with function calling
   */
  async createAgenticAssistant(functions: AgentTool['function'][]): Promise<string> {
    return this.createOrGetAssistant({
      name: 'E-Code Agentic Assistant',
      instructions: `You are an autonomous AI agent capable of executing complex tasks. You can:
        - Call functions to interact with external systems
        - Chain multiple operations to complete tasks
        - Make decisions based on context and results
        - Handle errors and retry operations
        - Optimize workflows for efficiency
        Execute tasks step by step, verify results, and provide clear status updates.`,
      model: 'gpt-4.1',
      tools: [
        ...functions.map(fn => ({ type: 'function' as const, function: fn })),
        { type: 'code_interpreter' }
      ],
      temperature: 0.1,
    });
  }
  
  /**
   * Create or get a thread for a session
   */
  async createOrGetThread(sessionId: string, metadata?: Record<string, string>): Promise<string> {
    if (this.threads.has(sessionId)) {
      return this.threads.get(sessionId)!;
    }
    
    const client = this.ensureClient();

    const thread = await client.beta.threads.create({
      metadata: {
        sessionId,
        ...metadata
      }
    });
    
    this.threads.set(sessionId, thread.id);
    logger.info(`Created thread for session: ${sessionId}`);
    
    return thread.id;
  }
  
  /**
   * Add a message to a thread
   */
  async addMessage(
    threadId: string,
    message: AgentMessage
  ): Promise<void> {
    const client = this.ensureClient();

    await client.beta.threads.messages.create(threadId, {
      role: message.role,
      content: message.content,
      file_ids: message.fileIds,
      metadata: message.metadata,
    });
  }
  
  /**
   * Run an assistant on a thread and wait for completion
   */
  async runAssistant(
    assistantId: string,
    threadId: string,
    userId: number,
    instructions?: string
  ): Promise<AgentRunResult> {
    try {
      // Create a run
      const client = this.ensureClient();

      const run = await client.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
        instructions,
      });
      
      // Poll for completion
      let runStatus = await client.beta.threads.runs.retrieve(threadId, run.id);
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes with 1 second intervals
      
      while (
        ['queued', 'in_progress', 'requires_action'].includes(runStatus.status) &&
        attempts < maxAttempts
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        runStatus = await client.beta.threads.runs.retrieve(threadId, run.id);
        attempts++;
      }
      
      // Handle requires_action status (function calling)
      if (runStatus.status === 'requires_action') {
        const actions = runStatus.required_action?.submit_tool_outputs?.tool_calls.map(call => ({
          toolCallId: call.id,
          functionName: call.function.name,
          arguments: JSON.parse(call.function.arguments),
        }));
        
        return {
          messages: [],
          status: 'requires_action',
          actions,
        };
      }
      
      // Get messages after run completion
      const messages = await client.beta.threads.messages.list(threadId);
      const agentMessages: AgentMessage[] = messages.data.map(msg => ({
        role: msg.role,
        content: msg.content
          .filter(c => c.type === 'text')
          .map(c => (c as any).text.value)
          .join('\n'),
        metadata: msg.metadata as Record<string, string>,
      }));
      
      // Track usage for billing
      if (runStatus.usage) {
        await aiBillingService.trackAIUsage(userId, {
          model: runStatus.model || 'gpt-4.1',
          provider: 'OpenAI',
          inputTokens: runStatus.usage.prompt_tokens || 0,
          outputTokens: runStatus.usage.completion_tokens || 0,
          totalTokens: runStatus.usage.total_tokens || 0,
          purpose: 'agent-task',
          timestamp: new Date(),
        });
      }
      
      return {
        messages: agentMessages,
        status: runStatus.status === 'completed' ? 'completed' : 'failed',
        usage: runStatus.usage ? {
          promptTokens: runStatus.usage.prompt_tokens,
          completionTokens: runStatus.usage.completion_tokens,
          totalTokens: runStatus.usage.total_tokens,
        } : undefined,
        error: runStatus.last_error?.message,
      };
    } catch (error) {
      logger.error(`Failed to run assistant: ${error}`);
      throw error;
    }
  }
  
  /**
   * Submit tool outputs for function calling
   */
  async submitToolOutputs(
    threadId: string,
    runId: string,
    outputs: Array<{ toolCallId: string; output: string }>
  ): Promise<void> {
    const client = this.ensureClient();

    await client.beta.threads.runs.submitToolOutputs(threadId, runId, {
      tool_outputs: outputs.map(o => ({
        tool_call_id: o.toolCallId,
        output: o.output,
      })),
    });
  }
  
  /**
   * Upload a file for use with assistants
   */
  async uploadFile(
    file: Buffer,
    filename: string,
    purpose: 'assistants' | 'vision' | 'batch' | 'fine-tune' = 'assistants'
  ): Promise<string> {
    const client = this.ensureClient();

    const uploadedFile = await client.files.create({
      file: new File([file], filename),
      purpose,
    });
    
    logger.info(`Uploaded file: ${filename} with ID: ${uploadedFile.id}`);
    return uploadedFile.id;
  }
  
  /**
   * Create a vector store for file search
   */
  async createVectorStore(
    name: string,
    fileIds: string[],
    metadata?: Record<string, string>
  ): Promise<string> {
    const client = this.ensureClient();

    const vectorStore = await client.beta.vectorStores.create({
      name,
      file_ids: fileIds,
      metadata,
    });
    
    logger.info(`Created vector store: ${name} with ID: ${vectorStore.id}`);
    return vectorStore.id;
  }
  
  /**
   * Update assistant with vector store for file search
   */
  async attachVectorStore(assistantId: string, vectorStoreId: string): Promise<void> {
    const client = this.ensureClient();

    await client.beta.assistants.update(assistantId, {
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      }
    });
    
    logger.info(`Attached vector store ${vectorStoreId} to assistant ${assistantId}`);
  }
  
  /**
   * List available models with their capabilities
   */
  async listAvailableModels(): Promise<Array<{
    id: string;
    name: string;
    capabilities: string[];
    contextWindow: number;
    maxOutput: number;
  }>> {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-5.2 (Latest)',
        capabilities: ['chat', 'vision', 'function_calling', 'code_interpreter', 'file_search', 'reasoning', 'complex_analysis'],
        contextWindow: 256000,
        maxOutput: 32768,
      },
    ];
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): void {
    this.assistants.clear();
    this.threads.clear();
    logger.info('OpenAI Agents Service cleaned up');
  }
}

// Export singleton instance
export const openAIAgentsService = new OpenAIAgentsService();