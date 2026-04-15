import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message } from '../../shared/types';

export class ConversationService {
  private conversations: Map<string, Conversation> = new Map();

  createConversation(title?: string): Conversation {
    const id = uuidv4();
    const conversation: Conversation = {
      id,
      title: title || `Conversation ${this.conversations.size + 1}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) || null;
  }

  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  addMessage(conversationId: string, content: string, role: 'user' | 'assistant'): Message {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const message: Message = {
      id: uuidv4(),
      content,
      role,
      timestamp: new Date(),
      conversationId,
    };

    conversation.messages.push(message);
    conversation.updatedAt = new Date();

    // Auto-generate title from first user message
    if (conversation.messages.length === 1 && role === 'user') {
      conversation.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    return message;
  }

  getConversationMessages(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    return conversation ? conversation.messages : [];
  }

  deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  updateConversationTitle(id: string, title: string): boolean {
    const conversation = this.conversations.get(id);
    if (conversation) {
      conversation.title = title;
      conversation.updatedAt = new Date();
      return true;
    }
    return false;
  }

  // Get messages in OpenAI format for API calls
  getMessagesForAI(conversationId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages = this.getConversationMessages(conversationId);
    return messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
  }
}