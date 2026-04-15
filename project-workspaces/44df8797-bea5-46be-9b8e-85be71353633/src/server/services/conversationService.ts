import { 
  Conversation, 
  Message, 
  ConversationContext,
  ChatSession 
} from '@/types/chatbot';
import { generateId, createMessage, extractConversationTitle } from '@/utils/helpers';
import { isValidMessage, validateContext } from '@/utils/validation';

export class ConversationService {
  private conversations: Map<string, Conversation> = new Map();
  private sessions: Map<string, ChatSession> = new Map();

  async createConversation(userId: string, context?: ConversationContext): Promise<Conversation> {
    if (context && !validateContext(context)) {
      throw new Error('Invalid conversation context');
    }

    const conversation: Conversation = {
      id: generateId(),
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      context
    };

    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    return this.conversations.get(conversationId) || null;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values())
      .filter(conv => conv.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (!isValidMessage(message.content)) {
      throw new Error('Invalid message content');
    }

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    
    // Update title if this is the first user message
    if (!conversation.title && message.role === 'user' && conversation.messages.length === 1) {
      conversation.title = extractConversationTitle([message]);
    }

    this.conversations.set(conversationId, conversation);
  }

  async updateConversationContext(
    conversationId: string, 
    context: ConversationContext
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    if (!validateContext(context)) {
      throw new Error('Invalid conversation context');
    }

    conversation.context = { ...conversation.context, ...context };
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
  }

  async deleteConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return false;
    }

    this.conversations.delete(conversationId);
    
    // Clean up any associated sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.conversationId === conversationId) {
        this.sessions.delete(sessionId);
      }
    }

    return true;
  }

  async createSession(conversationId: string): Promise<ChatSession> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const session: ChatSession = {
      sessionId: generateId(),
      conversationId,
      isActive: true,
      lastActivity: new Date()
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.sessions.set(sessionId, session);
    }
  }

  async deactivateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.set(sessionId, session);
    }
  }

  async cleanupInactiveSessions(inactiveThresholdMinutes: number = 30): Promise<void> {
    const now = new Date();
    const threshold = inactiveThresholdMinutes * 60 * 1000;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceLastActivity > threshold) {
        this.sessions.delete(sessionId);
      }
    }
  }

  async getConversationStats(conversationId: string): Promise<{
    messageCount: number;
    userMessages: number;
    assistantMessages: number;
    averageResponseTime: number;
    totalTokens: number;
  }> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const { messages } = conversation;
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const totalTokens = messages.reduce((sum, msg) => {
      return sum + (msg.metadata?.tokens || 0);
    }, 0);

    const responseTimes = assistantMessages
      .map(msg => msg.metadata?.processingTime)
      .filter((time): time is number => typeof time === 'number');
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      messageCount: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      averageResponseTime,
      totalTokens
    };
  }

  // Get all conversations (for admin/debug purposes)
  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values());
  }

  // Get all active sessions (for monitoring)
  getActiveSessions(): ChatSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }
}