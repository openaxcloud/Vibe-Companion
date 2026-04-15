// Core message types
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

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  userId?: string;
  settings: ConversationSettings;
}

export interface ConversationSettings {
  model: AIModel;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

// AI Model types
export type AIModel = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';

export interface AIProvider {
  generateResponse(messages: Message[], settings: ConversationSettings): Promise<AIResponse>;
  validateApiKey(): Promise<boolean>;
}

export interface AIResponse {
  content: string;
  metadata: MessageMetadata;
  error?: string;
}

// WebSocket types
export interface WebSocketMessage {
  type: 'message' | 'typing' | 'error' | 'connected' | 'disconnected';
  data: unknown;
  conversationId?: string;
}

export interface ChatbotConfig {
  apiKey: string;
  defaultModel: AIModel;
  defaultTemperature: number;
  defaultMaxTokens: number;
  systemPrompt: string;
}

// API types
export interface SendMessageRequest {
  content: string;
  conversationId?: string;
  settings?: Partial<ConversationSettings>;
}

export interface SendMessageResponse {
  message: Message;
  conversation: Conversation;
}

export interface GetConversationsResponse {
  conversations: Conversation[];
  total: number;
}

// Error types
export type ChatbotError = 
  | { type: 'INVALID_API_KEY'; message: string }
  | { type: 'RATE_LIMIT_EXCEEDED'; message: string }
  | { type: 'NETWORK_ERROR'; message: string }
  | { type: 'INVALID_INPUT'; message: string }
  | { type: 'UNKNOWN_ERROR'; message: string };

// UI State types
export interface ChatState {
  currentConversation: Conversation | null;
  conversations: Conversation[];
  isLoading: boolean;
  error: ChatbotError | null;
  isTyping: boolean;
}

export interface UISettings {
  theme: 'light' | 'dark';
  fontSize: 'small' | 'medium' | 'large';
  soundEnabled: boolean;
  showTimestamps: boolean;
}