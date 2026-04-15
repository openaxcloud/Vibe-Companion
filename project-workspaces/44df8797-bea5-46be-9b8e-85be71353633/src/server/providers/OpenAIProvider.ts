import OpenAI from 'openai';
import { AIProvider, AIResponse, Message, ConversationSettings, MessageMetadata } from '../../types/index.js';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey,
    });
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }

  async generateResponse(messages: Message[], settings: ConversationSettings): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const openAIMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add system prompt if provided
      if (settings.systemPrompt) {
        openAIMessages.unshift({
          role: 'system',
          content: settings.systemPrompt,
        });
      }

      const completion = await this.client.chat.completions.create({
        model: settings.model,
        messages: openAIMessages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      });

      const processingTime = Date.now() - startTime;
      const response = completion.choices[0]?.message;
      
      if (!response?.content) {
        throw new Error('No response content received from OpenAI');
      }

      const metadata: MessageMetadata = {
        tokens: completion.usage?.total_tokens,
        model: settings.model,
        processingTime,
        confidence: 0.95, // OpenAI doesn't provide confidence scores, using default
      };

      return {
        content: response.content,
        metadata,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('OpenAI API error:', error);
      
      let errorMessage = 'An unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        content: '',
        metadata: {
          processingTime,
          model: settings.model,
        },
        error: errorMessage,
      };
    }
  }
}