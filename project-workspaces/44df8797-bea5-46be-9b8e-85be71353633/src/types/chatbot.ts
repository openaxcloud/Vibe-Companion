export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: number;
  model?: string;
  processingTime?: number;
  confidence?: number;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
  context?: ConversationContext;
}

export interface ConversationContext {
  topic?: string;
  mood?: 'friendly' | 'professional' | 'casual' | 'technical';
  preferences?: UserPreferences;
}

export interface UserPreferences {
  language?: string;
  responseStyle?: 'concise' | 'detailed' | 'conversational';
  expertise?: 'beginner' | 'intermediate' | 'expert';
}

export interface ChatbotConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  contextWindow: number;
}

export interface AIResponse {
  content: string;
  metadata: MessageMetadata;
  suggestions?: string[];
}

export interface ChatSession {
  sessionId: string;
  conversationId: string;
  isActive: boolean;
  lastActivity: Date;
}

export type MessageStatus = 'pending' | 'delivered' | 'error' | 'processing';

export interface MessageWithStatus extends Message {
  status: MessageStatus;
  error?: string;
}

// Discriminated union for different types of chat events
export type ChatEvent = 
  | { type: 'message'; payload: Message }
  | { type: 'typing'; payload: { isTyping: boolean; userId: string } }
  | { type: 'error'; payload: { error: string; messageId?: string } }
  | { type: 'connected'; payload: { sessionId: string } }
  | { type: 'disconnected'; payload: { sessionId: string } };

// API Request/Response types
export interface SendMessageRequest {
  content: string;
  conversationId?: string;
  context?: ConversationContext;
}

export interface SendMessageResponse {
  message: Message;
  aiResponse: Message;
  conversationId: string;
}