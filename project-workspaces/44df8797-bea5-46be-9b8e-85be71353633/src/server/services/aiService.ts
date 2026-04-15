import OpenAI from 'openai';
import { 
  Message, 
  AIResponse, 
  ChatbotConfig, 
  ConversationContext,
  MessageMetadata 
} from '@/types/chatbot';
import { createSystemPrompt, calculateTokensApprox, generateId } from '@/utils/helpers';

export class AIService {
  private openai: OpenAI;
  private config: ChatbotConfig;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.config = {
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '1000'),
      systemPrompt: 'You are a helpful AI assistant.',
      contextWindow: parseInt(process.env.CONTEXT_WINDOW || '10')
    };
  }

  async generateResponse(
    messages: Message[], 
    context?: ConversationContext
  ): Promise<AIResponse> {
    try {
      const startTime = Date.now();
      
      // Prepare messages for OpenAI API
      const systemPrompt = createSystemPrompt(context);
      const contextMessages = this.prepareContextMessages(messages, systemPrompt);
      
      const completion = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: contextMessages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      });

      const processingTime = Date.now() - startTime;
      const responseContent = completion.choices[0]?.message?.content || '';
      
      const metadata: MessageMetadata = {
        tokens: completion.usage?.total_tokens || calculateTokensApprox(responseContent),
        model: this.config.model,
        processingTime,
        confidence: this.calculateConfidence(completion)
      };

      // Generate contextual suggestions
      const suggestions = await this.generateSuggestions(responseContent, context);

      return {
        content: responseContent,
        metadata,
        suggestions
      };

    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  private prepareContextMessages(
    messages: Message[], 
    systemPrompt: string
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    // Add system message
    const contextMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    // Get recent messages within context window
    const recentMessages = messages
      .slice(-this.config.contextWindow)
      .filter(msg => msg.role !== 'system');

    // Convert to OpenAI format
    for (const message of recentMessages) {
      if (message.role === 'user' || message.role === 'assistant') {
        contextMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }

    return contextMessages;
  }

  private calculateConfidence(completion: OpenAI.Chat.Completions.ChatCompletion): number {
    // Simple heuristic for confidence based on response characteristics
    const choice = completion.choices[0];
    if (!choice) return 0;

    let confidence = 0.8; // Base confidence

    // Adjust based on finish_reason
    switch (choice.finish_reason) {
      case 'stop':
        confidence += 0.1;
        break;
      case 'length':
        confidence -= 0.1;
        break;
      case 'content_filter':
        confidence -= 0.3;
        break;
    }

    // Adjust based on response length (very short responses might be less confident)
    const responseLength = choice.message?.content?.length || 0;
    if (responseLength < 20) {
      confidence -= 0.2;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  private async generateSuggestions(
    responseContent: string, 
    context?: ConversationContext
  ): Promise<string[]> {
    // Generate contextual follow-up suggestions
    const suggestions: string[] = [];
    
    // Simple rule-based suggestions (can be enhanced with ML)
    if (responseContent.toLowerCase().includes('code') || responseContent.includes('```')) {
      suggestions.push('Can you explain this code step by step?');
      suggestions.push('Are there any alternative approaches?');
    }
    
    if (responseContent.toLowerCase().includes('error') || responseContent.toLowerCase().includes('problem')) {
      suggestions.push('How can I prevent this issue?');
      suggestions.push('What are the common causes?');
    }
    
    // Generic helpful suggestions
    suggestions.push('Tell me more about this topic');
    suggestions.push('Can you give me an example?');
    
    return suggestions.slice(0, 3); // Return max 3 suggestions
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.openai.models.list();
      return true;
    } catch (error) {
      console.error('OpenAI API key validation failed:', error);
      return false;
    }
  }

  getConfig(): ChatbotConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<ChatbotConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}