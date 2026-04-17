
import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isTyping: boolean;
  addMessage: (conversationId: string, message: Message) => void;
  newConversation: (initialMessage: Message) => void;
  setCurrentConversation: (id: string) => void;
  updateMessageContent: (conversationId: string, messageId: string, content: string) => void;
  setIsTyping: (typing: boolean) => void;
  clearConversations: () => void;
  searchConversations: (query: string) => Conversation[];
}

const generateId = () => Math.random().toString(36).substring(2, 9);

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: JSON.parse(localStorage.getItem('conversations') || '[]'),
  currentConversationId: localStorage.getItem('currentConversationId'),
  isTyping: false,

  addMessage: (conversationId, message) => {
    set(state => {
      const updatedConversations = state.conversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, messages: [...conv.messages, message], updatedAt: Date.now() }
          : conv
      );
      localStorage.setItem('conversations', JSON.stringify(updatedConversations));
      return { conversations: updatedConversations };
    });
  },

  newConversation: (initialMessage) => {
    const id = generateId();
    const newConv: Conversation = {
      id,
      title: initialMessage.content.substring(0, 50) + (initialMessage.content.length > 50 ? '...' : ''),
      messages: [initialMessage],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set(state => {
      const updatedConversations = [...state.conversations, newConv];
      localStorage.setItem('conversations', JSON.stringify(updatedConversations));
      localStorage.setItem('currentConversationId', id);
      return { conversations: updatedConversations, currentConversationId: id };
    });
  },

  setCurrentConversation: (id) => {
    set({ currentConversationId: id });
    localStorage.setItem('currentConversationId', id);
  },

  updateMessageContent: (conversationId, messageId, content) => {
    set(state => {
      const updatedConversations = state.conversations.map(conv =>
        conv.id === conversationId
          ? {
              ...conv,
              messages: conv.messages.map(msg =>
                msg.id === messageId ? { ...msg, content } : msg
              ),
              updatedAt: Date.now(),
            }
          : conv
      );
      localStorage.setItem('conversations', JSON.stringify(updatedConversations));
      return { conversations: updatedConversations };
    });
  },

  setIsTyping: (typing) => set({ isTyping: typing }),

  clearConversations: () => {
    set({ conversations: [], currentConversationId: null });
    localStorage.removeItem('conversations');
    localStorage.removeItem('currentConversationId');
  },

  searchConversations: (query) => {
    const lowerCaseQuery = query.toLowerCase();
    return get().conversations.filter(conv =>
      conv.title.toLowerCase().includes(lowerCaseQuery) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(lowerCaseQuery))
    );
  },
}));
