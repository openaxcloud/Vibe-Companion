// @ts-nocheck
/**
 * Admin AI Chat Service
 * Supports OpenAI (GPT-4.1, GPT-4.1, o3, o4-mini) and Anthropic (Claude Opus 4, Sonnet 4)
 * with real streaming via SSE
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '../storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('chatgpt-service');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ===== Model Registry =====

export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic';
  description: string;
  maxTokens: number;
  badge?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Flagship OpenAI model — advanced reasoning & code generation',
    maxTokens: 32768,
    badge: 'Flagship',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Fast, capable, cost-efficient OpenAI model',
    maxTokens: 32768,
    badge: 'Recommended',
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'OpenAI deep-reasoning model for complex problems',
    maxTokens: 100000,
    badge: 'Deep Reasoning',
  },
  {
    id: 'o4-mini',
    name: 'o4-mini',
    provider: 'openai',
    description: 'Compact reasoning model — fast & efficient',
    maxTokens: 65536,
    badge: 'Fast',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    description: 'Most powerful Claude — best for architecture & complex reasoning',
    maxTokens: 32000,
    badge: 'Most Powerful',
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Balanced Claude — fast, smart, great for code',
    maxTokens: 32000,
    badge: 'Balanced',
  },
];

// ===== Types =====

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  projectContext?: {
    projectId: string;
    files?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  projectId?: string;
  model: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
}

// In-memory session store
const chatSessions = new Map<string, ChatSession>();

// ===== Helpers =====

function buildSystemPrompt(projectName?: string): string {
  const base = `You are an expert AI assistant integrated into the E-Code platform admin panel.
You help the admin manage projects, generate code, debug issues, and architect solutions.
Be concise, precise, and use code blocks where relevant.${projectName ? `\n\nCurrent project: ${projectName}` : ''}`;
  return base;
}

function getProvider(modelId: string): 'openai' | 'anthropic' {
  const model = AI_MODELS.find(m => m.id === modelId);
  return model?.provider || 'openai';
}

function isReasoningModel(modelId: string): boolean {
  return modelId.startsWith('o3') || modelId.startsWith('o4') || modelId.startsWith('o1');
}

// ===== ChatGPTService =====

export class ChatGPTService {
  private storage = getStorage();

  getModels(): AIModel[] {
    return AI_MODELS;
  }

  async createSession(userId: string, projectId?: string, model: string = 'gpt-4.1'): Promise<ChatSession> {
    const sessionId = crypto.randomUUID();
    const session: ChatSession = {
      id: sessionId,
      userId,
      projectId,
      model,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
          timestamp: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      title: 'New conversation',
    };
    chatSessions.set(sessionId, session);
    logger.info(`Session created: ${sessionId} (model: ${model}, user: ${userId})`);
    return session;
  }

  async getSession(sessionId: string, userId: string): Promise<ChatSession | null> {
    const session = chatSessions.get(sessionId);
    if (session && session.userId === userId) return session;
    return null;
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return Array.from(chatSessions.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async clearSession(sessionId: string, userId: string): Promise<void> {
    const session = chatSessions.get(sessionId);
    if (!session || session.userId !== userId) throw new Error('Session not found');
    session.messages = [session.messages[0]];
    session.updatedAt = new Date();
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const session = chatSessions.get(sessionId);
    if (!session || session.userId !== userId) throw new Error('Session not found');
    chatSessions.delete(sessionId);
  }

  async sendMessage(
    sessionId: string,
    userId: string,
    message: string,
    includeProjectContext: boolean = false
  ): Promise<ChatMessage> {
    const session = await this.getSession(sessionId, userId);
    if (!session) throw new Error('Session not found');

    if (includeProjectContext && session.projectId) {
      await this.injectProjectContext(session);
    }

    const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date() };
    session.messages.push(userMsg);

    const replyContent = await this.callAI(session.model, session.messages);
    const assistantMsg: ChatMessage = { role: 'assistant', content: replyContent, timestamp: new Date() };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date();

    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = message.slice(0, 60) + (message.length > 60 ? '…' : '');
    }

    return assistantMsg;
  }

  async *sendStreamingMessage(
    sessionId: string,
    userId: string,
    message: string,
    includeProjectContext: boolean = false
  ): AsyncGenerator<string, void, unknown> {
    const session = await this.getSession(sessionId, userId);
    if (!session) throw new Error('Session not found');

    if (includeProjectContext && session.projectId) {
      await this.injectProjectContext(session);
    }

    const userMsg: ChatMessage = { role: 'user', content: message, timestamp: new Date() };
    session.messages.push(userMsg);

    let fullResponse = '';

    if (getProvider(session.model) === 'anthropic') {
      for await (const chunk of this.streamAnthropic(session)) {
        fullResponse += chunk;
        yield chunk;
      }
    } else {
      for await (const chunk of this.streamOpenAI(session)) {
        fullResponse += chunk;
        yield chunk;
      }
    }

    const assistantMsg: ChatMessage = { role: 'assistant', content: fullResponse, timestamp: new Date() };
    session.messages.push(assistantMsg);
    session.updatedAt = new Date();

    if (session.messages.filter(m => m.role === 'user').length === 1) {
      session.title = message.slice(0, 60) + (message.length > 60 ? '…' : '');
    }
  }

  // ===== Direct streaming (stateless, no session) =====
  async *streamDirect(
    model: string,
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[]
  ): AsyncGenerator<string> {
    const fakeSession: ChatSession = {
      id: 'direct',
      userId: 'admin',
      model,
      messages: messages as ChatMessage[],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (getProvider(model) === 'anthropic') {
      yield* this.streamAnthropic(fakeSession);
    } else {
      yield* this.streamOpenAI(fakeSession);
    }
  }

  // ===== OpenAI streaming =====
  private async *streamOpenAI(session: ChatSession): AsyncGenerator<string> {
    const msgs = session.messages.map(m => ({ role: m.role, content: m.content }));
    const params: any = { model: session.model, messages: msgs, stream: true };

    if (isReasoningModel(session.model)) {
      params.max_completion_tokens = 32768;
    } else {
      params.max_tokens = 4096;
      params.temperature = 0.7;
    }

    const stream = await openai.chat.completions.create(params);
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) yield text;
    }
  }

  // ===== Anthropic streaming =====
  private async *streamAnthropic(session: ChatSession): AsyncGenerator<string> {
    const systemContent = session.messages.find(m => m.role === 'system')?.content || buildSystemPrompt();
    const msgs = session.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const stream = await anthropic.messages.create({
      model: session.model,
      max_tokens: 8192,
      system: systemContent,
      messages: msgs,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const text = event.delta.text;
        if (text) yield text;
      }
    }
  }

  // ===== Non-streaming AI call =====
  private async callAI(model: string, messages: ChatMessage[]): Promise<string> {
    if (getProvider(model) === 'anthropic') {
      const systemContent = messages.find(m => m.role === 'system')?.content || buildSystemPrompt();
      const msgs = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const response = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        system: systemContent,
        messages: msgs,
      });
      return response.content[0]?.type === 'text' ? response.content[0].text : '';
    } else {
      const msgs = messages.map(m => ({ role: m.role, content: m.content }));
      const params: any = { model, messages: msgs };

      if (isReasoningModel(model)) {
        params.max_completion_tokens = 32768;
      } else {
        params.max_tokens = 4096;
        params.temperature = 0.7;
      }

      const response = await openai.chat.completions.create(params);
      return response.choices[0]?.message?.content || '';
    }
  }

  // ===== Project context injection =====
  private async injectProjectContext(session: ChatSession): Promise<void> {
    if (!session.projectId) return;
    try {
      const files = await this.storage.getFilesByProjectId(session.projectId);
      if (!files?.length) return;

      const fileList = files
        .filter(f => !f.isDirectory && f.content)
        .slice(0, 10)
        .map(f => `=== ${f.path} ===\n${(f.content || '').slice(0, 2000)}`)
        .join('\n\n');

      const contextMsg: ChatMessage = {
        role: 'system',
        content: `Project files:\n\n${fileList}`,
        timestamp: new Date(),
      };

      const existingCtxIdx = session.messages.findIndex(
        m => m.role === 'system' && m.content.startsWith('Project files:')
      );
      if (existingCtxIdx > -1) {
        session.messages[existingCtxIdx] = contextMsg;
      } else {
        session.messages.splice(1, 0, contextMsg);
      }
    } catch (err) {
      logger.warn('Failed to inject project context', { err });
    }
  }

  // ===== Code generation =====
  async generateCode(
    sessionId: string,
    userId: string,
    request: string,
    language: string = 'typescript'
  ): Promise<{ code: string; explanation: string }> {
    const session = await this.getSession(sessionId, userId);
    if (!session) throw new Error('Session not found');

    const codePrompt = `Generate ${language} code for: ${request}
    
Use best practices, include comments, handle errors. Return the code and a brief explanation.`;

    const content = await this.callAI(session.model, [
      { role: 'system', content: 'You are an expert programmer. Generate clean, efficient, well-documented code.' },
      { role: 'user', content: codePrompt },
    ]);

    const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1] : content;
    const explanation = content.replace(/```[\w]*\n[\s\S]*?```/g, '').trim();

    return { code, explanation };
  }
}
