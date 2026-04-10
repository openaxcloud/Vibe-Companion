import fetch from 'node-fetch';
import { AIProvider } from './ai-providers';

// Model configurations with provider routing
export const OPENSOURCE_MODELS = {
  // Tier 1: Flagship Models
  'llama-3.1-405b': {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    provider: 'together',
    modelId: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
    description: "Meta's flagship model, excellent for code generation",
    inputPrice: 3.5, // per 1M tokens
    outputPrice: 3.5,
    contextWindow: 128000,
    capabilities: ['code', 'chat', 'reasoning', 'analysis'],
    tier: 'flagship'
  },
  'deepseek-coder-33b': {
    id: 'deepseek-coder-33b',
    name: 'DeepSeek Coder 33B',
    provider: 'together',
    modelId: 'deepseek-ai/deepseek-coder-33b-instruct',
    description: 'Specialized for coding tasks, rivals GPT-4 for code',
    inputPrice: 0.8,
    outputPrice: 0.8,
    contextWindow: 16384,
    capabilities: ['code', 'debugging', 'refactoring'],
    tier: 'flagship'
  },
  'mixtral-8x7b': {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    provider: 'together',
    modelId: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    description: 'Fast, efficient, great for real-time coding assistance',
    inputPrice: 0.6,
    outputPrice: 0.6,
    contextWindow: 32768,
    capabilities: ['code', 'chat', 'analysis'],
    tier: 'flagship'
  },

  // Tier 2: Specialized Models
  'codellama-70b': {
    id: 'codellama-70b',
    name: 'CodeLlama 70B',
    provider: 'together',
    modelId: 'codellama/CodeLlama-70b-Instruct-hf',
    description: "Meta's code-specific model",
    inputPrice: 0.9,
    outputPrice: 0.9,
    contextWindow: 16384,
    capabilities: ['code', 'completion', 'documentation'],
    tier: 'specialized'
  },
  'wizardcoder-34b': {
    id: 'wizardcoder-34b',
    name: 'WizardCoder 34B',
    provider: 'together',
    modelId: 'WizardLM/WizardCoder-Python-34B-V1.0',
    description: 'Fine-tuned for instruction following',
    inputPrice: 0.65,
    outputPrice: 0.65,
    contextWindow: 8192,
    capabilities: ['code', 'instruction-following'],
    tier: 'specialized'
  },
  'phind-codellama-34b': {
    id: 'phind-codellama-34b',
    name: 'Phind CodeLlama 34B',
    provider: 'together',
    modelId: 'Phind/Phind-CodeLlama-34B-v2',
    description: 'Optimized for technical Q&A and coding',
    inputPrice: 0.7,
    outputPrice: 0.7,
    contextWindow: 16384,
    capabilities: ['code', 'qa', 'debugging'],
    tier: 'specialized'
  },

  // Tier 3: Efficient Models
  'mistral-7b': {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'together',
    modelId: 'mistralai/Mistral-7B-Instruct-v0.2',
    description: 'Fast, efficient for quick tasks',
    inputPrice: 0.2,
    outputPrice: 0.2,
    contextWindow: 32768,
    capabilities: ['code', 'chat'],
    tier: 'efficient'
  },
  'starcoder2-15b': {
    id: 'starcoder2-15b',
    name: 'StarCoder2 15B',
    provider: 'huggingface',
    modelId: 'bigcode/starcoder2-15b',
    description: "GitHub/BigCode's latest model",
    inputPrice: 0.3,
    outputPrice: 0.3,
    contextWindow: 16384,
    capabilities: ['code', 'completion'],
    tier: 'efficient'
  },
  'qwen-2.5-coder': {
    id: 'qwen-2.5-coder',
    name: 'Qwen 2.5 Coder',
    provider: 'together',
    modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    description: "Alibaba's strong coding model",
    inputPrice: 0.6,
    outputPrice: 0.6,
    contextWindow: 32768,
    capabilities: ['code', 'multilingual', 'reasoning'],
    tier: 'efficient'
  }
};

interface ProviderConfig {
  apiKey?: string;
  baseUrl: string;
  headers: Record<string, string>;
}

export class OpenSourceModelsProvider implements AIProvider {
  name = 'opensource';
  private providers: Map<string, ProviderConfig> = new Map();
  
  constructor() {
    // Initialize provider configurations
    this.setupProviders();
  }
  
  private setupProviders() {
    // Together AI configuration
    this.providers.set('together', {
      apiKey: process.env.TOGETHER_API_KEY,
      baseUrl: 'https://api.together.xyz/v1',
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Hugging Face configuration
    this.providers.set('huggingface', {
      apiKey: process.env.HUGGINGFACE_API_KEY,
      baseUrl: 'https://api-inference.huggingface.co/models',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Replicate configuration
    this.providers.set('replicate', {
      apiKey: process.env.REPLICATE_API_KEY,
      baseUrl: 'https://api.replicate.com/v1',
      headers: {
        'Authorization': `Token ${process.env.REPLICATE_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Groq configuration
    this.providers.set('groq', {
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY || ''}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async generateChat(messages: any[], options?: any): Promise<string> {
    const modelId = options?.model || 'mixtral-8x7b';
    const modelConfig = OPENSOURCE_MODELS[modelId as keyof typeof OPENSOURCE_MODELS];
    
    if (!modelConfig) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    const provider = this.providers.get(modelConfig.provider);
    if (!provider) {
      throw new Error(`Provider ${modelConfig.provider} not configured`);
    }
    
    try {
      if (modelConfig.provider === 'together' || modelConfig.provider === 'groq') {
        return await this.callOpenAICompatibleAPI(provider, modelConfig, messages, options);
      } else if (modelConfig.provider === 'huggingface') {
        return await this.callHuggingFaceAPI(provider, modelConfig, messages, options);
      } else if (modelConfig.provider === 'replicate') {
        return await this.callReplicateAPI(provider, modelConfig, messages, options);
      }
      
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
    } catch (error: any) {
      console.error(`Error calling ${modelConfig.name}:`, error);
      throw new Error(`Failed to generate response with ${modelConfig.name}: ${error.message}`);
    }
  }
  
  private async callOpenAICompatibleAPI(
    provider: ProviderConfig,
    modelConfig: any,
    messages: any[],
    options?: any
  ): Promise<string> {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        model: modelConfig.modelId,
        messages: messages,
        max_tokens: options?.max_tokens || 2048,
        temperature: options?.temperature || 0.7,
        stream: false
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as any;
    return data.choices[0].message.content;
  }
  
  private async callHuggingFaceAPI(
    provider: ProviderConfig,
    modelConfig: any,
    messages: any[],
    options?: any
  ): Promise<string> {
    // Convert messages to prompt format
    const prompt = messages.map(m => {
      if (m.role === 'system') return `System: ${m.content}`;
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return m.content;
    }).join('\n\n');
    
    const response = await fetch(`${provider.baseUrl}/${modelConfig.modelId}`, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: options?.max_tokens || 2048,
          temperature: options?.temperature || 0.7,
          return_full_text: false
        }
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as any;
    return Array.isArray(data) ? data[0].generated_text : data.generated_text;
  }
  
  private async callReplicateAPI(
    provider: ProviderConfig,
    modelConfig: any,
    messages: any[],
    options?: any
  ): Promise<string> {
    // First create a prediction
    const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    
    const createResponse = await fetch(`${provider.baseUrl}/predictions`, {
      method: 'POST',
      headers: provider.headers,
      body: JSON.stringify({
        version: modelConfig.modelId,
        input: {
          prompt: prompt,
          max_tokens: options?.max_tokens || 2048,
          temperature: options?.temperature || 0.7
        }
      })
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`API error: ${createResponse.status} - ${error}`);
    }
    
    const prediction = await createResponse.json() as any;
    
    // Poll for completion
    let result = prediction;
    while (result.status !== 'succeeded' && result.status !== 'failed') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const statusResponse = await fetch(`${provider.baseUrl}/predictions/${prediction.id}`, {
        headers: provider.headers
      });
      
      result = await statusResponse.json();
    }
    
    if (result.status === 'failed') {
      throw new Error(`Prediction failed: ${result.error}`);
    }
    
    return result.output;
  }
  
  async generateCodeWithUnderstanding(messages: any[], codeAnalysis: any, options?: any): Promise<string> {
    const enhancedMessages = [...messages];
    
    if (codeAnalysis) {
      // Add code analysis as a system message
      const systemMessage = {
        role: 'system',
        content: `Code Context and Analysis:\n${JSON.stringify(codeAnalysis, null, 2)}\n\nUse this information to provide more accurate and context-aware code generation.`
      };
      
      // Insert after the first system message or at the beginning
      const firstSystemIndex = messages.findIndex(m => m.role === 'system');
      if (firstSystemIndex >= 0) {
        enhancedMessages.splice(firstSystemIndex + 1, 0, systemMessage);
      } else {
        enhancedMessages.unshift(systemMessage);
      }
    }
    
    return this.generateChat(enhancedMessages, options);
  }
  
  // Helper method to check if API keys are configured
  isConfigured(modelId: string): boolean {
    const modelConfig = OPENSOURCE_MODELS[modelId as keyof typeof OPENSOURCE_MODELS];
    if (!modelConfig) return false;
    
    const provider = this.providers.get(modelConfig.provider);
    if (!provider) return false;
    
    // Check if the provider has an API key configured
    switch (modelConfig.provider) {
      case 'together':
        return !!process.env.TOGETHER_API_KEY;
      case 'huggingface':
        return !!process.env.HUGGINGFACE_API_KEY;
      case 'replicate':
        return !!process.env.REPLICATE_API_KEY;
      case 'groq':
        return !!process.env.GROQ_API_KEY;
      default:
        return false;
    }
  }
  
  // Get all available models
  getAvailableModels() {
    return Object.entries(OPENSOURCE_MODELS).map(([key, config]) => ({
      ...config,
      available: this.isConfigured(key)
    }));
  }
}

// Export singleton instance
export const openSourceModelsProvider = new OpenSourceModelsProvider();