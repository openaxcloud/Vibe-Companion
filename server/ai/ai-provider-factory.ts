import { OpenAI } from 'openai';

export interface AIProvider {
  generateCode(prompt: string, context?: any): Promise<string>;
  analyzeCode(code: string): Promise<any>;
  generateTests(code: string): Promise<string>;
  explainCode(code: string): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateCode(prompt: string, context?: any): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are an expert software developer. Generate clean, production-ready code based on the requirements.'
        },
        {
          role: 'user',
          content: context ? `Context: ${JSON.stringify(context)}\n\nRequirement: ${prompt}` : prompt
        }
      ],
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content || '';
  }

  async analyzeCode(code: string): Promise<any> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'You are a code analysis expert. Analyze the provided code for quality, security, and performance issues.'
        },
        {
          role: 'user',
          content: code
        }
      ],
      temperature: 0.1,
    });

    return {
      analysis: response.choices[0]?.message?.content || '',
      timestamp: new Date().toISOString(),
    };
  }

  async generateTests(code: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'Generate comprehensive unit tests for the provided code. Use appropriate testing frameworks.'
        },
        {
          role: 'user',
          content: code
        }
      ],
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content || '';
  }

  async explainCode(code: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        {
          role: 'system',
          content: 'Explain the provided code in clear, technical terms. Include what it does, how it works, and any notable patterns.'
        },
        {
          role: 'user',
          content: code
        }
      ],
      temperature: 0.1,
    });

    return response.choices[0]?.message?.content || '';
  }
}

export class AIProviderFactory {
  static createProvider(providerType: string, apiKey: string): AIProvider {
    switch (providerType.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(apiKey);
      default:
        throw new Error(`Unsupported AI provider: ${providerType}`);
    }
  }

  static async getDefaultProvider(): Promise<AIProvider> {
    // Try to get API keys from environment variables
    const openaiKey = process.env.OPENAI_API_KEY;

    if (openaiKey) {
      return this.createProvider('openai', openaiKey);
    } else {
      throw new Error('No AI provider API keys found in environment variables');
    }
  }
}

export { OpenAIProvider };