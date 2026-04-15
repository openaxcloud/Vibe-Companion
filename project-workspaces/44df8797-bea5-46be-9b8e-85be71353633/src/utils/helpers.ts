import { v4 as uuidv4 } from 'uuid';
import { Message, ConversationContext } from '@/types/chatbot';

export function generateId(): string {
  return uuidv4();
}

export function createMessage(
  content: string, 
  role: 'user' | 'assistant' | 'system',
  metadata?: Message['metadata']
): Message {
  return {
    id: generateId(),
    content,
    role,
    timestamp: new Date(),
    metadata
  };
}

export function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export function calculateTokensApprox(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

export function createSystemPrompt(context?: ConversationContext): string {
  let prompt = "You are a helpful AI assistant. ";
  
  if (context?.mood) {
    switch (context.mood) {
      case 'professional':
        prompt += "Maintain a professional and formal tone. ";
        break;
      case 'friendly':
        prompt += "Be warm, friendly, and approachable. ";
        break;
      case 'casual':
        prompt += "Keep the conversation casual and relaxed. ";
        break;
      case 'technical':
        prompt += "Focus on technical accuracy and detailed explanations. ";
        break;
    }
  }
  
  if (context?.preferences?.responseStyle) {
    switch (context.preferences.responseStyle) {
      case 'concise':
        prompt += "Keep responses brief and to the point. ";
        break;
      case 'detailed':
        prompt += "Provide comprehensive and detailed responses. ";
        break;
      case 'conversational':
        prompt += "Use a natural, conversational style. ";
        break;
    }
  }
  
  if (context?.preferences?.expertise) {
    switch (context.preferences.expertise) {
      case 'beginner':
        prompt += "Explain concepts in simple terms suitable for beginners. ";
        break;
      case 'intermediate':
        prompt += "Assume moderate knowledge and provide balanced explanations. ";
        break;
      case 'expert':
        prompt += "Use technical language and assume advanced knowledge. ";
        break;
    }
  }
  
  return prompt;
}

export function extractConversationTitle(messages: Message[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user')?.content;
  if (!firstUserMessage) return 'New Conversation';
  
  return truncateText(firstUserMessage, 50);
}

export function isRecentMessage(message: Message, minutesThreshold: number = 5): boolean {
  const now = new Date();
  const messageTime = new Date(message.timestamp);
  const diffInMinutes = (now.getTime() - messageTime.getTime()) / (1000 * 60);
  return diffInMinutes <= minutesThreshold;
}