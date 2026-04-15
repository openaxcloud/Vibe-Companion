export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  model?: string;
  error?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  model: string;
  tokens: number;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: Date;
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface CodeExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
  language: string;
}

export interface ChatSettings {
  model: 'gpt-4' | 'gpt-4-turbo-preview' | 'gpt-3.5-turbo';
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  streamResponse: boolean;
}

export interface AppState {
  conversations: Conversation[];
  currentConversationId: string | null;
  documents: Document[];
  settings: ChatSettings;
  language: string;
  sidebarOpen: boolean;
}

export type Language = 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ja' | 'ko' | 'zh';

export interface TranslationKeys {
  common: {
    send: string;
    cancel: string;
    delete: string;
    edit: string;
    save: string;
    close: string;
    search: string;
    settings: string;
    export: string;
    import: string;
    clear: string;
    confirm: string;
  };
  chat: {
    newChat: string;
    placeholder: string;
    thinking: string;
    error: string;
    regenerate: string;
    copy: string;
    copied: string;
    stopGenerating: string;
  };
  sidebar: {
    conversations: string;
    documents: string;
    settings: string;
    newConversation: string;
    searchConversations: string;
    noConversations: string;
    uploadDocument: string;
    noDocuments: string;
  };
  settings: {
    title: string;
    model: string;
    temperature: string;
    maxTokens: string;
    language: string;
    streamingResponses: string;
    darkMode: string;
    exportData: string;
    importData: string;
    clearAllData: string;
  };
}