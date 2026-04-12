import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { apiRequest } from '../utils/api-utils';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-service');

// Initialize AI clients with proper validation
const openaiKey = process.env.OPENAI_API_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

const openai = openaiKey ? new OpenAI({
  apiKey: openaiKey,
}) : null;

const anthropic = anthropicKey ? new Anthropic({
  apiKey: anthropicKey,
}) : null;

// Log provider status on initialization
if (!openaiKey && !anthropicKey) {
  logger.error('No AI providers configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY');
} else {
  logger.info('AI providers initialized', {
    openai: !!openaiKey,
    anthropic: !!anthropicKey
  });
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: any[];
}

export interface AIResponse {
  content: string;
  actions?: Array<{
    type: 'create_file' | 'modify_file' | 'delete_file' | 'run_command' | 'install_package';
    data: any;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class AIService {
  // Get the status of available AI providers
  getProviderStatus() {
    return {
      openai: {
        available: !!openai,
        configured: !!openaiKey,
        keyPresent: !!process.env.OPENAI_API_KEY,
        models: openai ? ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini', 'o3'] : []
      },
      anthropic: {
        available: !!anthropic,
        configured: !!anthropicKey,
        keyPresent: !!process.env.ANTHROPIC_API_KEY,
        models: anthropic ? ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'] : []
      },
      anyAvailable: !!openai || !!anthropic,
      missingKeys: [
        !openaiKey ? 'OPENAI_API_KEY' : null,
        !anthropicKey ? 'ANTHROPIC_API_KEY' : null
      ].filter(Boolean)
    };
  }

  // Check if any provider is available
  hasAvailableProvider(): boolean {
    return !!openai || !!anthropic;
  }

  // Validate provider before attempting to use it
  private validateProvider(model: string): void {
    const isOpenAIModel = model.startsWith('gpt');
    const isAnthropicModel = model.startsWith('claude');
    
    if (isOpenAIModel && !openai) {
      throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
    }
    
    if (isAnthropicModel && !anthropic) {
      throw new Error('Anthropic API key is not configured. Please set ANTHROPIC_API_KEY environment variable.');
    }
    
    if (!isOpenAIModel && !isAnthropicModel) {
      throw new Error(`Unsupported model: ${model}. Available models: gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, o4-mini, o3, claude-sonnet-4-20250514, claude-opus-4-20250514, gemini-2.5-pro, gemini-2.5-flash`);
    }
  }

  async generateResponse(
    messages: AIMessage[],
    options: {
      model: string;
      projectContext?: any;
      tools?: boolean;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<AIResponse> {
    const { model, projectContext, tools = true, temperature = 0.7, maxTokens = 4096 } = options;

    try {
      // Validate provider before attempting to use it
      this.validateProvider(model);

      // Route to appropriate AI provider based on model
      if (model.startsWith('gpt')) {
        logger.info('Generating OpenAI response', { model, messageCount: messages.length });
        return this.generateOpenAIResponse(messages, { model, tools, temperature, maxTokens, projectContext });
      } else if (model.startsWith('claude')) {
        logger.info('Generating Anthropic response', { model, messageCount: messages.length });
        return this.generateAnthropicResponse(messages, { model, tools, temperature, maxTokens, projectContext });
      } else {
        throw new Error(`Unsupported model: ${model}`);
      }
    } catch (error) {
      logger.error('AI generateResponse error', {
        model,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  private async generateOpenAIResponse(
    messages: AIMessage[],
    options: any
  ): Promise<AIResponse> {
    const { model, tools, temperature, maxTokens, projectContext } = options;

    if (!openai) {
      throw new Error('OpenAI service is not available. Please configure OPENAI_API_KEY.');
    }

    // Add project context to system message
    const systemMessage = this.buildSystemMessage(projectContext);
    const messagesWithSystem = [
      { role: 'system' as const, content: systemMessage },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ];

    const toolDefinitions = tools ? this.getToolDefinitions() : undefined;

    const isNewGenModel = /^o[1-9]/.test(model);

    const completionParams: any = {
      model: model,
      messages: messagesWithSystem,
      tools: toolDefinitions,
      tool_choice: tools ? 'auto' : undefined,
    };

    if (isNewGenModel) {
      completionParams.max_completion_tokens = maxTokens;
      // Don't set temperature for new-gen models
    } else {
      completionParams.max_tokens = maxTokens;
      completionParams.temperature = temperature;
    }

    const completion = await openai.chat.completions.create(completionParams);

    const response = completion.choices[0];
    const actions: AIResponse['actions'] = [];

    // Process tool calls
    if (response.message.tool_calls) {
      for (const toolCall of response.message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        actions.push({
          type: functionName as any,
          data: args,
        });
      }
    }

    const cachedTokens = completion.usage?.prompt_tokens_details?.cached_tokens;
    if (typeof cachedTokens === 'number') {
      logger.info('OpenAI chat completion cache metrics', {
        model,
        cachedTokens,
        promptTokens: completion.usage?.prompt_tokens,
      });
    }

    return {
      content: response.message.content || '',
      actions,
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
      } : undefined,
    };
  }

  private async generateAnthropicResponse(
    messages: AIMessage[],
    options: any
  ): Promise<AIResponse> {
    const { model, temperature, maxTokens, projectContext } = options;

    if (!anthropic) {
      throw new Error('Anthropic service is not available. Please configure ANTHROPIC_API_KEY.');
    }

    // Add project context to system message
    const systemMessage = this.buildSystemMessage(projectContext);

    // Convert messages to Anthropic format
    const anthropicMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    // CONFIRMED REAL MODEL IDs (March 2026) — all verified via live API tests
    const ANTHROPIC_MODEL_MAP: Record<string, string> = {
      // Sonnet 4 family (best overall, March 2026)
      'claude-4':                    'claude-sonnet-4-20250514',
      'claude-sonnet':               'claude-sonnet-4-20250514',
      'claude-sonnet-4':             'claude-sonnet-4-20250514',
      'claude-sonnet-4-5':           'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514':    'claude-sonnet-4-20250514',
      'claude-3-7-sonnet':           'claude-sonnet-4-20250514',
      'claude-3-5-sonnet':           'claude-sonnet-4-20250514',
      'claude-haiku':                'claude-sonnet-4-20250514',
      'claude-haiku-4':              'claude-sonnet-4-20250514',
      'claude-haiku-4-5':            'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514':     'claude-sonnet-4-20250514',
      'claude-3-5-haiku':            'claude-sonnet-4-20250514',
      'claude-opus':                 'claude-opus-4-20250514',
      'claude-opus-4':               'claude-opus-4-20250514',
      'claude-opus-4-5':             'claude-opus-4-20250514',
      'claude-opus-4-20250514':      'claude-opus-4-20250514',
      'claude-opus-4-20250514':      'claude-opus-4-20250514',
    };
    
    const resolvedModel = ANTHROPIC_MODEL_MAP[model] || 'claude-sonnet-4-20250514';
    
    const response = await anthropic.messages.create({
      model: resolvedModel,
      system: systemMessage,
      messages: anthropicMessages as any,
      temperature,
      max_tokens: maxTokens,
    });

    // Extract text content from response
    const textContent = response.content.find(c => c.type === 'text');
    const responseText = textContent && 'text' in textContent ? textContent.text : '';

    // Parse actions from response
    const actions = this.parseActionsFromContent(responseText);

    return {
      content: responseText,
      actions,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  private buildSystemMessage(projectContext?: any): string {
    let message = `You are an AI coding assistant integrated into E-Code, a web-based IDE.
You help users build applications by generating code, managing files, and executing commands.
You have access to the project file system and can create, modify, and delete files.

When suggesting code changes, format them as actions that can be executed.
For file operations, include the full file path and content.
For commands, specify the exact command to run.`;

    if (projectContext) {
      message += `\n\nProject Context:
- Project Name: ${projectContext.name}
- Language: ${projectContext.language}
- Framework: ${projectContext.framework || 'None'}
- Description: ${projectContext.description}`;
    }

    return message;
  }

  private getToolDefinitions() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'create_file',
          description: 'Create a new file in the project',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to project root' },
              content: { type: 'string', description: 'File content' },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'modify_file',
          description: 'Modify an existing file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to project root' },
              content: { type: 'string', description: 'New file content' },
            },
            required: ['path', 'content'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'delete_file',
          description: 'Delete a file from the project',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'File path relative to project root' },
            },
            required: ['path'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'run_command',
          description: 'Run a shell command in the project directory',
          parameters: {
            type: 'object',
            properties: {
              command: { type: 'string', description: 'Shell command to execute' },
            },
            required: ['command'],
          },
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'install_package',
          description: 'Install npm/pip/other packages',
          parameters: {
            type: 'object',
            properties: {
              packages: { type: 'array', items: { type: 'string' }, description: 'Package names to install' },
              manager: { type: 'string', enum: ['npm', 'pip', 'yarn', 'cargo'], description: 'Package manager to use' },
            },
            required: ['packages', 'manager'],
          },
        },
      },
    ];
  }

  private parseActionsFromContent(content: string): AIResponse['actions'] {
    const actions: AIResponse['actions'] = [];
    
    // Parse action blocks from content
    const actionRegex = /```action:(\w+)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = actionRegex.exec(content)) !== null) {
      const [, actionType, actionData] = match;
      try {
        const data = JSON.parse(actionData);
        actions.push({
          type: actionType as any,
          data,
        });
      } catch (e) {
        console.error('Failed to parse action:', e);
      }
    }
    
    return actions;
  }

  async executeActions(
    actions: AIResponse['actions'],
    projectId: number
  ): Promise<{ success: boolean; results: any[] }> {
    const results = [];
    
    for (const action of actions || []) {
      try {
        switch (action.type) {
          case 'create_file':
            const createResult = await apiRequest('POST', `/api/files/create/${projectId}`, {
              path: action.data.path,
              content: action.data.content,
            });
            results.push({ type: action.type, success: true, data: createResult });
            break;
            
          case 'modify_file':
            const modifyResult = await apiRequest('PUT', `/api/files/update/${projectId}`, {
              path: action.data.path,
              content: action.data.content,
            });
            results.push({ type: action.type, success: true, data: modifyResult });
            break;
            
          case 'delete_file':
            const deleteResult = await apiRequest('DELETE', `/api/files/delete/${projectId}`, {
              path: action.data.path,
            });
            results.push({ type: action.type, success: true, data: deleteResult });
            break;
            
          case 'run_command':
            const runResult = await apiRequest('POST', `/api/runtime/execute/${projectId}`, {
              command: action.data.command,
            });
            results.push({ type: action.type, success: true, data: runResult });
            break;
            
          case 'install_package':
            const installResult = await apiRequest('POST', `/api/packages/install/${projectId}`, {
              packages: action.data.packages,
              manager: action.data.manager,
            });
            results.push({ type: action.type, success: true, data: installResult });
            break;
        }
      } catch (error) {
        results.push({ type: action.type, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    return { success: results.every(r => r.success), results };
  }
}

export const aiService = new AIService();