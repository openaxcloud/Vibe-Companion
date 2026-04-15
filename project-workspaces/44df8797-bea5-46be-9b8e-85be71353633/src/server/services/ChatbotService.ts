import { v4 as uuidv4 } from 'uuid';
import { 
  Conversation, 
  Message, 
  ConversationSettings, 
  AIProvider, 
  ChatbotConfig,
  AIModel 
} from '../../types/index.js';

export class ChatbotService {
  private conversations: Map<string, Conversation> = new Map();
  private aiProvider: AIProvider;
  private config: ChatbotConfig;

  constructor(aiProvider: AIProvider, config: ChatbotConfig) {
    this.aiProvider = aiProvider;
    this.config = config;
  }

  async validateSetup(): Promise<boolean> {
    return await this.aiProvider.validateApiKey();
  }

  createConversation(title?: string, settings?: Partial<ConversationSettings>): Conversation {
    const id = uuidv4();
    const now = new Date();
    
    const conversation: Conversation = {
      id,
      title: title || `Conversation ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
      settings: {
        model: settings?.model || this.config.defaultModel,
        temperature: settings?.temperature || this.config.defaultTemperature,
        maxTokens: settings?.maxTokens || this.config.defaultMaxTokens,
        systemPrompt: settings?.systemPrompt || this.config.systemPrompt,
      },
    };

    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) || null;
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  private createMessage(content: string, role: 'user' | 'assistant'): Message {
    return {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date(),
    };
  }

  async sendMessage(
    content: string, 
    conversationId?: string,
    settings?: Partial<ConversationSettings>
  ): Promise<{ conversation: Conversation; response: Message }> {
    // Get or create conversation
    let conversation: Conversation;
    if (conversationId) {
      const existing = this.getConversation(conversationId);
      if (!existing) {
        throw new Error(`Conversation with id ${conversationId} not found`);
      }
      conversation = existing;
      
      // Update settings if provided
      if (settings) {
        conversation.settings = { ...conversation.settings, ...settings };
      }
    } else {
      conversation = this.createConversation(undefined, settings);
    }

    // Add user message
    const userMessage = this.createMessage(content, 'user');
    conversation.messages.push(userMessage);

    // Generate AI response
    const aiResponse = await this.aiProvider.generateResponse(
      conversation.messages,
      conversation.settings
    );

    if (aiResponse.error) {
      throw new Error(`AI Provider Error: ${aiResponse.error}`);
    }

    // Create assistant message
    const assistantMessage = this.createMessage(aiResponse.content, 'assistant');
    assistantMessage.metadata = aiResponse.metadata;
    
    conversation.messages.push(assistantMessage);
    conversation.updatedAt = new Date();

    // Auto-generate title for new conversations
    if (conversation.messages.length === 2 && conversation.title.startsWith('Conversation ')) {
      conversation.title = this.generateConversationTitle(content);
    }

    // Update conversation in storage
    this.conversations.set(conversation.id, conversation);

    return {
      conversation,
      response: assistantMessage,
    };
  }

  private generateConversationTitle(firstMessage: string): string {
    // Simple title generation - take first few words
    const words = firstMessage.split(' ').slice(0, 6);
    let title = words.join(' ');
    
    if (firstMessage.split(' ').length > 6) {
      title += '...';
    }
    
    return title || 'New Conversation';
  }

  updateConversationSettings(
    conversationId: string, 
    settings: Partial<ConversationSettings>
  ): Conversation | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    conversation.settings = { ...conversation.settings, ...settings };
    conversation.updatedAt = new Date();
    
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  clearConversationHistory(conversationId: string): Conversation | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    conversation.messages = [];
    conversation.updatedAt = new Date();
    
    this.conversations.set(conversationId, conversation);
    return conversation;
  }

  exportConversation(conversationId: string): string | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    const exportData = {
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
    };

    return JSON.stringify(exportData, null, 2);
  }
}