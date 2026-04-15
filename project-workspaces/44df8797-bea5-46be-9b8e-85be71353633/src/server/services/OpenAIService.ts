import OpenAI from 'openai';
import { AIConfig } from '../../shared/types';

export class OpenAIService {
  private client: OpenAI;
  private defaultConfig: AIConfig;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });

    this.defaultConfig = {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      systemPrompt: 'You are a helpful AI assistant. Provide clear, concise, and accurate responses.',
    };
  }

  async generateResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    config: Partial<AIConfig> = {}
  ): Promise<string> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };
      
      const completion = await this.client.chat.completions.create({
        model: finalConfig.model,
        messages: [
          { role: 'system', content: finalConfig.systemPrompt || this.defaultConfig.systemPrompt! },
          ...messages,
        ],
        temperature: finalConfig.temperature,
        max_tokens: finalConfig.maxTokens,
      });

      return completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async streamResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    config: Partial<AIConfig> = {},
    onChunk: (chunk: string) => void
  ): Promise<void> {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };
      
      const stream = await this.client.chat.completions.create({
        model: finalConfig.model,
        messages: [
          { role: 'system', content: finalConfig.systemPrompt || this.defaultConfig.systemPrompt! },
          ...messages,
        ],
        temperature: finalConfig.temperature,
        max_tokens: finalConfig.maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          onChunk(content);
        }
      }
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      throw new Error('Failed to stream AI response');
    }
  }
}