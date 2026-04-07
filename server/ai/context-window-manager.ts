// @ts-nocheck
/**
 * Context Window Manager
 * Intelligent management of conversation history with AI memory retention,
 * long-term storage, session persistence, smart summarization, and priority-based retention
 */

import type { AIModel } from './ai-provider-manager';
import { createLogger } from '../utils/logger';
import { redisCache, CacheKeys, CacheTTL } from '../services/redis-cache.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

const logger = createLogger('context-window-manager');

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  tokens?: number;
  priority?: MessagePriority;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  id?: string;
  sessionId?: string;
  userId?: number;
  projectId?: number;
  toolCalls?: string[];
  isCodeBlock?: boolean;
  isError?: boolean;
  containsKeyFacts?: boolean;
  summarized?: boolean;
  originalTokens?: number;
}

export type MessagePriority = 'critical' | 'high' | 'normal' | 'low' | 'disposable';

export interface ContextOptimizationOptions {
  maxTokens?: number;
  preserveSystemMessages?: boolean;
  minRecentMessages?: number;
  summarizationThreshold?: number;
  enablePriorityRetention?: boolean;
  preserveToolCalls?: boolean;
  preserveCodeBlocks?: boolean;
}

export interface LongTermMemory {
  userId?: number;
  projectId?: number;
  keyFacts: KeyFact[];
  userPreferences: UserPreference[];
  learnedPatterns: LearnedPattern[];
  lastUpdated: number;
}

export interface KeyFact {
  id: string;
  category: 'tech_stack' | 'project_info' | 'user_context' | 'domain' | 'constraint';
  fact: string;
  confidence: number;
  extractedAt: number;
  lastUsed: number;
  usageCount: number;
}

export interface UserPreference {
  id: string;
  category: 'coding_style' | 'communication' | 'workflow' | 'tools';
  preference: string;
  value: string;
  learnedAt: number;
}

export interface LearnedPattern {
  id: string;
  pattern: string;
  response: string;
  successRate: number;
  occurrences: number;
}

export interface SessionMemory {
  sessionId: string;
  userId?: number;
  projectId?: number;
  messages: Message[];
  summary?: string;
  keyTopics: string[];
  startedAt: number;
  lastActivity: number;
  totalTokensUsed: number;
}

export interface MemoryStats {
  sessions: number;
  totalMessages: number;
  longTermFacts: number;
  preferences: number;
  patterns: number;
  storageSize: number;
}

export class ContextWindowManager {
  private maxTokens: number;
  private currentTokens: number = 0;
  private longTermMemory: Map<string, LongTermMemory> = new Map();
  private sessionMemory: Map<string, SessionMemory> = new Map();
  private memoryStoragePath: string;
  private priorityWeights: Record<MessagePriority, number> = {
    critical: 10,
    high: 5,
    normal: 2,
    low: 1,
    disposable: 0
  };
  
  // ✅ CONVERSATION LIMIT (Dec 16, 2025): Prevent unbounded memory growth
  private static readonly MAX_CONVERSATION_MESSAGES = 100;
  
  constructor(maxTokens: number = 100000) {
    this.maxTokens = maxTokens;
    this.memoryStoragePath = path.join(process.cwd(), '.ai-memory');
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      await fs.mkdir(this.memoryStoragePath, { recursive: true });
      await this.loadPersistedMemory();
      logger.info('AI memory storage initialized');
    } catch (error) {
      logger.error('Failed to initialize AI memory storage:', error);
    }
  }

  private estimateTokens(text: string): number {
    const chars = text.length;
    const hasCode = text.includes('{') || text.includes('function') || text.includes('const');
    const multiplier = hasCode ? 0.3 : 0.25;
    return Math.ceil(chars * multiplier);
  }

  calculateTotalTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => {
      if (msg.tokens) return sum + msg.tokens;
      const estimated = this.estimateTokens(msg.content);
      msg.tokens = estimated;
      return sum + estimated;
    }, 0);
  }

  private assignPriority(message: Message): MessagePriority {
    if (message.role === 'system') return 'critical';
    
    const content = message.content.toLowerCase();
    
    if (message.metadata?.isError) return 'high';
    if (message.metadata?.containsKeyFacts) return 'high';
    if (message.metadata?.toolCalls && message.metadata.toolCalls.length > 0) return 'high';
    
    if (content.includes('error') || content.includes('bug') || content.includes('fix')) return 'high';
    if (content.includes('important') || content.includes('remember') || content.includes('note')) return 'high';
    
    if (message.metadata?.isCodeBlock) return 'normal';
    
    if (content.length < 50) return 'low';
    if (content.match(/^(ok|thanks|yes|no|got it|sure)$/i)) return 'disposable';
    
    return 'normal';
  }

  optimizeConversationHistory(
    messages: Message[],
    options: ContextOptimizationOptions = {}
  ): Message[] {
    const {
      maxTokens = this.maxTokens,
      preserveSystemMessages = true,
      minRecentMessages = 10,
      summarizationThreshold = maxTokens * 0.8,
      enablePriorityRetention = true,
      preserveToolCalls = true,
      preserveCodeBlocks = true
    } = options;

    messages.forEach(msg => {
      if (!msg.tokens) msg.tokens = this.estimateTokens(msg.content);
      if (!msg.priority) msg.priority = this.assignPriority(msg);
      if (!msg.timestamp) msg.timestamp = Date.now();
    });

    const totalTokens = this.calculateTotalTokens(messages);

    if (totalTokens <= maxTokens) {
      this.currentTokens = totalTokens;
      return messages;
    }

    const systemMessages = preserveSystemMessages
      ? messages.filter(m => m.role === 'system')
      : [];
    
    const conversationMessages = messages.filter(m => m.role !== 'system');

    if (enablePriorityRetention) {
      conversationMessages.sort((a, b) => {
        const priorityDiff = this.priorityWeights[b.priority || 'normal'] - 
                            this.priorityWeights[a.priority || 'normal'];
        if (priorityDiff !== 0) return priorityDiff;
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
    }

    const systemTokens = this.calculateTotalTokens(systemMessages);
    const availableForConversation = maxTokens - systemTokens;

    const optimized = [...systemMessages];
    let conversationTokens = 0;
    const includedMessages: Message[] = [];

    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const msgTokens = msg.tokens || this.estimateTokens(msg.content);

      const shouldPreserve = 
        (preserveToolCalls && msg.metadata?.toolCalls && msg.metadata.toolCalls.length > 0) ||
        (preserveCodeBlocks && msg.metadata?.isCodeBlock) ||
        msg.priority === 'critical' ||
        msg.priority === 'high';

      if (shouldPreserve || conversationTokens + msgTokens <= availableForConversation) {
        includedMessages.unshift(msg);
        conversationTokens += msgTokens;
      } else if (includedMessages.length < minRecentMessages) {
        includedMessages.unshift(msg);
        conversationTokens += msgTokens;
      } else if (conversationTokens > summarizationThreshold) {
        const truncatedMessages = conversationMessages.slice(0, i + 1);
        const summary = this.generateSmartSummary(truncatedMessages);
        includedMessages.unshift({
          role: 'system',
          content: summary,
          tokens: this.estimateTokens(summary),
          priority: 'normal',
          metadata: { summarized: true, originalTokens: this.calculateTotalTokens(truncatedMessages) }
        });
        break;
      }
    }

    optimized.push(...includedMessages);

    const result = optimized.sort((a, b) => {
      if (a.role === 'system' && b.role !== 'system') return -1;
      if (a.role !== 'system' && b.role === 'system') return 1;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    this.currentTokens = this.calculateTotalTokens(result);
    return result;
  }

  private generateSmartSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const topics = new Set<string>();
    const actions = new Set<string>();
    const files = new Set<string>();
    const errors = new Set<string>();
    
    messages.forEach(msg => {
      const content = msg.content.toLowerCase();
      
      const fileMatches = msg.content.match(/[\w\-./]+\.(ts|tsx|js|jsx|py|json|css|html|md)/g);
      if (fileMatches) fileMatches.forEach(f => files.add(f));
      
      if (content.includes('error') || content.includes('failed') || content.includes('bug')) {
        const errorMatch = msg.content.match(/error[:\s]+([^\n.]+)/i);
        if (errorMatch) errors.add(errorMatch[1].trim());
      }
      
      if (content.includes('create') || content.includes('add')) actions.add('created');
      if (content.includes('update') || content.includes('modify')) actions.add('updated');
      if (content.includes('delete') || content.includes('remove')) actions.add('deleted');
      if (content.includes('fix') || content.includes('debug')) actions.add('fixed');
      if (content.includes('test')) actions.add('tested');
    });
    
    let summary = `[Conversation Summary - ${messages.length} messages compressed]\n`;
    summary += `User requests: ${userMessages.length}, Assistant responses: ${assistantMessages.length}\n`;
    
    if (actions.size > 0) {
      summary += `Actions taken: ${Array.from(actions).join(', ')}\n`;
    }
    
    if (files.size > 0) {
      summary += `Files mentioned: ${Array.from(files).slice(0, 10).join(', ')}${files.size > 10 ? '...' : ''}\n`;
    }
    
    if (errors.size > 0) {
      summary += `Issues encountered: ${Array.from(errors).slice(0, 5).join('; ')}\n`;
    }
    
    summary += `Original context: ~${this.calculateTotalTokens(messages)} tokens`;
    
    return summary;
  }

  shouldStartNewConversation(messages: Message[], threshold = 0.9): boolean {
    const totalTokens = this.calculateTotalTokens(messages);
    return totalTokens > this.maxTokens * threshold;
  }

  generateConversationSummary(messages: Message[]): string {
    return this.generateSmartSummary(messages);
  }

  async createSession(
    sessionId: string,
    userId?: number,
    projectId?: number
  ): Promise<SessionMemory> {
    const session: SessionMemory = {
      sessionId,
      userId,
      projectId,
      messages: [],
      keyTopics: [],
      startedAt: Date.now(),
      lastActivity: Date.now(),
      totalTokensUsed: 0
    };
    
    this.sessionMemory.set(sessionId, session);
    await redisCache.set(CacheKeys.aiSessionMemory(sessionId), session, CacheTTL.DAY);
    logger.info(`Created new session: ${sessionId}`);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionMemory | null> {
    let session = this.sessionMemory.get(sessionId);
    
    if (!session) {
      const redisSession = await redisCache.get<SessionMemory>(CacheKeys.aiSessionMemory(sessionId));
      if (redisSession) {
        this.sessionMemory.set(sessionId, redisSession);
        return redisSession;
      }
      session = await this.loadSession(sessionId);
    }
    
    return session || null;
  }

  async addMessageToSession(
    sessionId: string,
    message: Message
  ): Promise<void> {
    let session = this.sessionMemory.get(sessionId);
    
    if (!session) {
      session = await this.createSession(sessionId);
    }
    
    if (!message.tokens) message.tokens = this.estimateTokens(message.content);
    if (!message.priority) message.priority = this.assignPriority(message);
    if (!message.timestamp) message.timestamp = Date.now();
    if (!message.metadata) message.metadata = {};
    message.metadata.sessionId = sessionId;
    message.metadata.id = crypto.randomUUID();
    
    session.messages.push(message);
    session.lastActivity = Date.now();
    session.totalTokensUsed += message.tokens;
    
    // ✅ CONVERSATION LIMIT (Dec 16, 2025): Enforce max message count to prevent memory exhaustion
    if (session.messages.length > ContextWindowManager.MAX_CONVERSATION_MESSAGES) {
      // Remove oldest non-system messages to stay within limit
      const systemMessages = session.messages.filter(m => m.role === 'system');
      const nonSystemMessages = session.messages.filter(m => m.role !== 'system');
      
      // Keep newest messages, removing oldest non-system messages
      const excessCount = session.messages.length - ContextWindowManager.MAX_CONVERSATION_MESSAGES;
      const messagesToRemove = nonSystemMessages.slice(0, excessCount);
      const tokensRemoved = messagesToRemove.reduce((sum, m) => sum + (m.tokens || 0), 0);
      
      const keptNonSystem = nonSystemMessages.slice(excessCount);
      session.messages = [...systemMessages, ...keptNonSystem];
      session.totalTokensUsed -= tokensRemoved;
      
      logger.warn(`[Session ${sessionId}] Trimmed ${excessCount} oldest messages to enforce limit`, {
        limit: ContextWindowManager.MAX_CONVERSATION_MESSAGES,
        tokensRemoved,
        remainingMessages: session.messages.length
      });
    }
    
    this.extractKeyFacts(message, session.userId, session.projectId);
    
    this.sessionMemory.set(sessionId, session);
    await redisCache.set(CacheKeys.aiSessionMemory(sessionId), session, CacheTTL.DAY);
  }

  async getSessionMessages(
    sessionId: string,
    options: ContextOptimizationOptions = {}
  ): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    
    if (!session) return [];
    
    return this.optimizeConversationHistory(session.messages, options);
  }

  async saveSession(sessionId: string): Promise<void> {
    const session = this.sessionMemory.get(sessionId);
    if (!session) return;
    
    await redisCache.set(CacheKeys.aiSessionMemory(sessionId), session, CacheTTL.DAY);
    
    const sessionPath = path.join(this.memoryStoragePath, 'sessions', `${sessionId}.json`);
    await fs.mkdir(path.dirname(sessionPath), { recursive: true });
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
    
    logger.info(`Saved session: ${sessionId}`);
  }

  private async loadSession(sessionId: string): Promise<SessionMemory | null> {
    try {
      const sessionPath = path.join(this.memoryStoragePath, 'sessions', `${sessionId}.json`);
      const data = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(data) as SessionMemory;
      this.sessionMemory.set(sessionId, session);
      return session;
    } catch {
      return null;
    }
  }

  async summarizeAndArchiveSession(sessionId: string): Promise<void> {
    const session = this.sessionMemory.get(sessionId);
    if (!session) return;
    
    session.summary = this.generateSmartSummary(session.messages);
    
    const keyTopics = new Set<string>();
    session.messages.forEach(msg => {
      const fileMatches = msg.content.match(/[\w\-./]+\.(ts|tsx|js|jsx|py|json)/g);
      if (fileMatches) fileMatches.forEach(f => keyTopics.add(f.split('/').pop() || f));
    });
    session.keyTopics = Array.from(keyTopics);
    
    await this.saveSession(sessionId);
    logger.info(`Archived session: ${sessionId}`);
  }

  private getMemoryKey(userId?: number, projectId?: number): string {
    return `${userId || 'global'}_${projectId || 'global'}`;
  }

  async getLongTermMemory(userId?: number, projectId?: number): Promise<LongTermMemory> {
    const key = this.getMemoryKey(userId, projectId);
    
    let memory = this.longTermMemory.get(key);
    
    if (!memory) {
      const redisMemory = await redisCache.get<LongTermMemory>(CacheKeys.aiLongTermMemory(key));
      if (redisMemory) {
        this.longTermMemory.set(key, redisMemory);
        return redisMemory;
      }
      memory = await this.loadLongTermMemory(key);
    }
    
    if (!memory) {
      memory = {
        userId,
        projectId,
        keyFacts: [],
        userPreferences: [],
        learnedPatterns: [],
        lastUpdated: Date.now()
      };
      this.longTermMemory.set(key, memory);
    }
    
    return memory;
  }

  async addKeyFact(
    userId: number | undefined,
    projectId: number | undefined,
    category: KeyFact['category'],
    fact: string,
    confidence: number = 0.8
  ): Promise<void> {
    const memory = await this.getLongTermMemory(userId, projectId);
    
    const existingIndex = memory.keyFacts.findIndex(
      f => f.category === category && f.fact.toLowerCase() === fact.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      memory.keyFacts[existingIndex].lastUsed = Date.now();
      memory.keyFacts[existingIndex].usageCount++;
      memory.keyFacts[existingIndex].confidence = Math.min(
        1,
        memory.keyFacts[existingIndex].confidence + 0.05
      );
    } else {
      memory.keyFacts.push({
        id: crypto.randomUUID(),
        category,
        fact,
        confidence,
        extractedAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 1
      });
    }
    
    memory.lastUpdated = Date.now();
    await this.saveLongTermMemory(this.getMemoryKey(userId, projectId));
  }

  async addUserPreference(
    userId: number | undefined,
    category: UserPreference['category'],
    preference: string,
    value: string
  ): Promise<void> {
    const memory = await this.getLongTermMemory(userId, undefined);
    
    const existingIndex = memory.userPreferences.findIndex(
      p => p.category === category && p.preference === preference
    );
    
    if (existingIndex >= 0) {
      memory.userPreferences[existingIndex].value = value;
    } else {
      memory.userPreferences.push({
        id: crypto.randomUUID(),
        category,
        preference,
        value,
        learnedAt: Date.now()
      });
    }
    
    memory.lastUpdated = Date.now();
    await this.saveLongTermMemory(this.getMemoryKey(userId, undefined));
  }

  private extractKeyFacts(message: Message, userId?: number, projectId?: number): void {
    const content = message.content;
    
    const techStackPatterns = [
      /using\s+(react|vue|angular|express|fastapi|django|flask|nextjs|nuxtjs)/gi,
      /(?:tech|technology)\s+stack[:\s]+([^.]+)/gi,
      /built\s+with\s+(\w+(?:\s*,\s*\w+)*)/gi
    ];
    
    const projectInfoPatterns = [
      /project\s+(?:is|called|named)\s+["']?([^"'\n.]+)/gi,
      /(?:we're|I'm)\s+building\s+(?:a|an)\s+([^.]+)/gi,
      /this\s+is\s+(?:a|an)\s+([^.]+?)\s+(?:project|app|application)/gi
    ];
    
    techStackPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        this.addKeyFact(userId, projectId, 'tech_stack', match[1].trim(), 0.9);
      }
    });
    
    projectInfoPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        this.addKeyFact(userId, projectId, 'project_info', match[1].trim(), 0.85);
      }
    });
  }

  async getContextWithMemory(
    sessionId: string,
    options: ContextOptimizationOptions = {}
  ): Promise<Message[]> {
    const session = await this.getSession(sessionId);
    if (!session) return [];
    
    const memory = await this.getLongTermMemory(session.userId, session.projectId);
    
    const messages = [...session.messages];
    
    if (memory.keyFacts.length > 0 || memory.userPreferences.length > 0) {
      const relevantFacts = memory.keyFacts
        .filter(f => f.confidence > 0.7)
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 10);
      
      if (relevantFacts.length > 0 || memory.userPreferences.length > 0) {
        let memoryContext = '[Long-term Memory Context]\n';
        
        if (relevantFacts.length > 0) {
          memoryContext += 'Key Facts:\n';
          relevantFacts.forEach(f => {
            memoryContext += `- ${f.category}: ${f.fact}\n`;
          });
        }
        
        if (memory.userPreferences.length > 0) {
          memoryContext += '\nUser Preferences:\n';
          memory.userPreferences.forEach(p => {
            memoryContext += `- ${p.preference}: ${p.value}\n`;
          });
        }
        
        messages.unshift({
          role: 'system',
          content: memoryContext,
          priority: 'high',
          timestamp: Date.now(),
          metadata: { containsKeyFacts: true }
        });
      }
    }
    
    return this.optimizeConversationHistory(messages, options);
  }

  private async saveLongTermMemory(key: string): Promise<void> {
    const memory = this.longTermMemory.get(key);
    if (!memory) return;
    
    await redisCache.set(CacheKeys.aiLongTermMemory(key), memory, CacheTTL.WEEK);
    
    const memoryPath = path.join(this.memoryStoragePath, 'long-term', `${key}.json`);
    await fs.mkdir(path.dirname(memoryPath), { recursive: true });
    await fs.writeFile(memoryPath, JSON.stringify(memory, null, 2));
  }

  private async loadLongTermMemory(key: string): Promise<LongTermMemory | null> {
    try {
      const memoryPath = path.join(this.memoryStoragePath, 'long-term', `${key}.json`);
      const data = await fs.readFile(memoryPath, 'utf-8');
      const memory = JSON.parse(data) as LongTermMemory;
      this.longTermMemory.set(key, memory);
      return memory;
    } catch {
      return null;
    }
  }

  private async loadPersistedMemory(): Promise<void> {
    try {
      const longTermDir = path.join(this.memoryStoragePath, 'long-term');
      const files = await fs.readdir(longTermDir).catch(() => []);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          await this.loadLongTermMemory(key);
        }
      }
    } catch (error) {
      logger.debug('No persisted memory to load');
    }
  }

  async getMemoryStats(): Promise<MemoryStats> {
    let totalMessages = 0;
    let storageSize = 0;
    
    this.sessionMemory.forEach(session => {
      totalMessages += session.messages.length;
    });
    
    let longTermFacts = 0;
    let preferences = 0;
    let patterns = 0;
    
    this.longTermMemory.forEach(memory => {
      longTermFacts += memory.keyFacts.length;
      preferences += memory.userPreferences.length;
      patterns += memory.learnedPatterns.length;
    });
    
    try {
      const calcSize = async (dir: string): Promise<number> => {
        let size = 0;
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            size += await calcSize(fullPath);
          } else {
            const stats = await fs.stat(fullPath);
            size += stats.size;
          }
        }
        return size;
      };
      storageSize = await calcSize(this.memoryStoragePath);
    } catch {
      storageSize = 0;
    }
    
    return {
      sessions: this.sessionMemory.size,
      totalMessages,
      longTermFacts,
      preferences,
      patterns,
      storageSize
    };
  }

  static optimizeForModel(
    messages: Message[],
    model: AIModel
  ): Message[] {
    const manager = new ContextWindowManager(model.maxTokens);
    
    return manager.optimizeConversationHistory(messages, {
      maxTokens: model.maxTokens,
      preserveSystemMessages: true,
      minRecentMessages: 10,
      summarizationThreshold: model.maxTokens * 0.75,
      enablePriorityRetention: true
    });
  }

  getUsageStats(): {
    current: number;
    max: number;
    percentage: number;
    remaining: number;
  } {
    return {
      current: this.currentTokens,
      max: this.maxTokens,
      percentage: Math.round((this.currentTokens / this.maxTokens) * 100),
      remaining: this.maxTokens - this.currentTokens
    };
  }

  reset(): void {
    this.currentTokens = 0;
  }

  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
  }

  async clearSession(sessionId: string): Promise<void> {
    this.sessionMemory.delete(sessionId);
    await redisCache.del(CacheKeys.aiSessionMemory(sessionId));
    try {
      const sessionPath = path.join(this.memoryStoragePath, 'sessions', `${sessionId}.json`);
      await fs.unlink(sessionPath);
    } catch {
    }
    logger.info(`Cleared session: ${sessionId}`);
  }

  async clearLongTermMemory(userId?: number, projectId?: number): Promise<void> {
    const key = this.getMemoryKey(userId, projectId);
    this.longTermMemory.delete(key);
    await redisCache.del(CacheKeys.aiLongTermMemory(key));
    try {
      const memoryPath = path.join(this.memoryStoragePath, 'long-term', `${key}.json`);
      await fs.unlink(memoryPath);
    } catch {
    }
    logger.info(`Cleared long-term memory: ${key}`);
  }
}

export const contextWindowManager = new ContextWindowManager();
