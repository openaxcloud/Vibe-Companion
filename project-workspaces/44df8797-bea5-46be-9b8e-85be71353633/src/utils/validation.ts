import { ConversationContext, UserPreferences } from '@/types/chatbot';

export function isValidMessage(content: string): boolean {
  return content.trim().length > 0 && content.length <= 4000;
}

export function isValidConversationId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export function validateContext(context: ConversationContext): boolean {
  if (!context) return true;
  
  const validMoods = ['friendly', 'professional', 'casual', 'technical'];
  if (context.mood && !validMoods.includes(context.mood)) {
    return false;
  }
  
  if (context.preferences) {
    return validateUserPreferences(context.preferences);
  }
  
  return true;
}

export function validateUserPreferences(preferences: UserPreferences): boolean {
  const validStyles = ['concise', 'detailed', 'conversational'];
  const validExpertise = ['beginner', 'intermediate', 'expert'];
  
  if (preferences.responseStyle && !validStyles.includes(preferences.responseStyle)) {
    return false;
  }
  
  if (preferences.expertise && !validExpertise.includes(preferences.expertise)) {
    return false;
  }
  
  return true;
}

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .slice(0, 4000);
}