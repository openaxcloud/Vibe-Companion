import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: 'assistant';
    };
    finish_reason: string | null;
    index: number;
  }>;
  created: number;
  model: string;
  object: string;
}

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // Allow usage in browser for client-side examples
});

export const streamChatCompletion = async (
  messages: Message[],
  onContent: (content: string) => void,
  onFinish: (fullContent: string) => void,
  onError: (error: string) => void
) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Using gpt-4o for its enhanced capabilities
      messages: messages.map(({ role, content }) => ({ role, content })),
      stream: true,
    });

    let fullContent = '';
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullContent += content;
      onContent(content);
    }
    onFinish(fullContent);
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    onError(error.message || 'An unknown error occurred.');
  }
};

export const createNewConversation = () => ({
  id: uuidv4(),
  title: 'New Chat',
  messages: [],
  createdAt: new Date().toISOString(),
});

export const getConversations = (): { id: string; title: string; messages: Message[]; createdAt: string; }[] => {
  const conversations = localStorage.getItem('conversations');
  return conversations ? JSON.parse(conversations) : [];
};

export const saveConversations = (conversations: any[]) => {
  localStorage.setItem('conversations', JSON.stringify(conversations));
};
