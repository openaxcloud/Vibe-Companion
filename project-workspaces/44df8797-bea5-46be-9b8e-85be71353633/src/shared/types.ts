// Shared types between client and server
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  conversationId: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  message: Message;
  conversationId: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo';
  temperature: number;
  maxTokens: number;
}

export interface AIConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// Socket.IO event types
export interface ServerToClientEvents {
  messageReceived: (response: ChatResponse) => void;
  error: (error: string) => void;
  conversationUpdated: (conversation: Conversation) => void;
}

export interface ClientToServerEvents {
  sendMessage: (request: ChatRequest) => void;
  joinConversation: (conversationId: string) => void;
  createConversation: () => void;
}

// API Response types
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};