export type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  isStreaming?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
};

export type ChatContextType = {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  loading: boolean;
  error: string | null;
  sendMessage: (text: string, conversationId?: string) => Promise<void>;
  startNewConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  updateMessage: (conversationId: string, messageId: string, newText: string) => void;
  addDocument: (filename: string, content: string) => void;
  executeCode: (code: string) => Promise<string>;
  clearError: () => void;
};

export type Document = {
  filename: string;
  content: string;
};

export type CodeExecutionResult = {
  output: string;
  error: string | null;
};