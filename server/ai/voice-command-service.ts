// @ts-nocheck
/**
 * Voice Command Service
 * Provides voice-activated commands and AI debugging capabilities
 */

import { db } from '../db';
// import { voiceCommandSettings, projects, auditLogs } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AIProviderFactory } from './ai-provider-factory';
import * as WebSocket from 'ws';

interface VoiceCommand {
  command: string;
  aliases: string[];
  action: (params: any) => Promise<any>;
  description: string;
  category: 'navigation' | 'editing' | 'debugging' | 'ai' | 'system';
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  language: string;
  alternatives?: string[];
}

export class VoiceCommandService {
  private commands: Map<string, VoiceCommand> = new Map();
  private activeListeners: Map<number, WebSocket> = new Map();
  private aiProvider: any;
  private transcriptionService: any;

  constructor() {
    this.initializeCommands();
    this.initializeTranscriptionService();
  }

  private initializeCommands() {
    // Navigation commands
    this.registerCommand({
      command: 'go to file',
      aliases: ['open file', 'navigate to file', 'jump to file'],
      action: async ({ fileName }) => ({
        type: 'navigate',
        target: 'file',
        fileName,
      }),
      description: 'Navigate to a specific file',
      category: 'navigation',
    });

    this.registerCommand({
      command: 'go to line',
      aliases: ['jump to line', 'navigate to line'],
      action: async ({ lineNumber }) => ({
        type: 'navigate',
        target: 'line',
        lineNumber,
      }),
      description: 'Navigate to a specific line number',
      category: 'navigation',
    });

    // Editing commands
    this.registerCommand({
      command: 'create new file',
      aliases: ['new file', 'add file'],
      action: async ({ fileName, content }) => ({
        type: 'create',
        target: 'file',
        fileName,
        content,
      }),
      description: 'Create a new file',
      category: 'editing',
    });

    this.registerCommand({
      command: 'delete line',
      aliases: ['remove line', 'erase line'],
      action: async ({ lineNumber }) => ({
        type: 'delete',
        target: 'line',
        lineNumber,
      }),
      description: 'Delete a specific line',
      category: 'editing',
    });

    // AI commands
    this.registerCommand({
      command: 'explain this code',
      aliases: ['what does this do', 'explain function', 'describe code'],
      action: async ({ code, context }) => {
        const explanation = await this.explainCode(code, context);
        return {
          type: 'ai_response',
          action: 'explain',
          response: explanation,
        };
      },
      description: 'Get AI explanation of code',
      category: 'ai',
    });

    this.registerCommand({
      command: 'debug this',
      aliases: ['find bug', 'what is wrong', 'fix error'],
      action: async ({ code, error }) => {
        const debug = await this.debugCode(code, error);
        return {
          type: 'ai_response',
          action: 'debug',
          response: debug,
        };
      },
      description: 'Debug code with AI assistance',
      category: 'ai',
    });

    this.registerCommand({
      command: 'optimize code',
      aliases: ['improve performance', 'make faster', 'refactor'],
      action: async ({ code }) => {
        const optimized = await this.optimizeCode(code);
        return {
          type: 'ai_response',
          action: 'optimize',
          response: optimized,
        };
      },
      description: 'Get optimization suggestions',
      category: 'ai',
    });

    // System commands
    this.registerCommand({
      command: 'run project',
      aliases: ['start project', 'execute', 'run'],
      action: async ({ projectId }) => ({
        type: 'system',
        action: 'run',
        projectId,
      }),
      description: 'Run the current project',
      category: 'system',
    });

    this.registerCommand({
      command: 'deploy project',
      aliases: ['publish', 'go live', 'deploy'],
      action: async ({ projectId }) => ({
        type: 'system',
        action: 'deploy',
        projectId,
      }),
      description: 'Deploy the project',
      category: 'system',
    });

    this.registerCommand({
      command: 'open terminal',
      aliases: ['show terminal', 'terminal', 'console'],
      action: async () => ({
        type: 'ui',
        action: 'open_terminal',
      }),
      description: 'Open the terminal',
      category: 'system',
    });
  }

  private async initializeTranscriptionService() {
    // Initialize Whisper or other transcription service
    // For now, we'll simulate it
    this.transcriptionService = {
      transcribe: async (audioBuffer: Buffer): Promise<TranscriptionResult> => {
        // In production, use actual Whisper API
        return {
          text: 'debug this code',
          confidence: 0.95,
          language: 'en-US',
          alternatives: ['debug this', 'debug this code please'],
        };
      },
    };
  }

  private registerCommand(command: VoiceCommand) {
    this.commands.set(command.command.toLowerCase(), command);
    // Also register aliases
    for (const alias of command.aliases) {
      this.commands.set(alias.toLowerCase(), command);
    }
  }

  async enableVoiceCommands(userId: number, settings?: any): Promise<void> {
    // Check if settings exist
    const existing = await db.select()
      .from(voiceCommandSettings)
      .where(eq(voiceCommandSettings.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing settings
      await db.update(voiceCommandSettings)
        .set({
          enabled: true,
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(voiceCommandSettings.userId, userId));
    } else {
      // Create new settings
      await db.insert(voiceCommandSettings).values({
        userId,
        enabled: true,
        wakeWord: settings?.wakeWord || 'Hey E-Code',
        language: settings?.language || 'en-US',
        voiceModel: settings?.voiceModel || 'whisper-large',
        hotkeys: settings?.hotkeys || {},
        customCommands: settings?.customCommands || {},
      });
    }
  }

  async disableVoiceCommands(userId: number): Promise<void> {
    await db.update(voiceCommandSettings)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(voiceCommandSettings.userId, userId));

    // Clean up active listener
    const listener = this.activeListeners.get(userId);
    if (listener) {
      listener.close();
      this.activeListeners.delete(userId);
    }
  }

  async processVoiceInput(
    userId: number,
    audioBuffer: Buffer,
    projectId?: number
  ): Promise<any> {
    // Transcribe audio
    const transcription = await this.transcriptionService.transcribe(audioBuffer);
    
    // Log voice command
    await db.insert(auditLogs).values({
      userId,
      action: 'voice_command',
      resourceType: 'voice',
      resourceId: projectId?.toString(),
      details: {
        transcription: transcription.text,
        confidence: transcription.confidence,
      },
      status: 'success',
    });

    // Parse and execute command
    const result = await this.parseAndExecuteCommand(
      transcription.text,
      userId,
      projectId
    );

    return {
      transcription,
      result,
    };
  }

  private async parseAndExecuteCommand(
    text: string,
    userId: number,
    projectId?: number
  ): Promise<any> {
    const normalizedText = text.toLowerCase().trim();
    
    // Try exact match first
    let command = this.commands.get(normalizedText);
    
    // If no exact match, try to find the best match
    if (!command) {
      command = this.findBestMatchingCommand(normalizedText);
    }

    if (!command) {
      // Use AI to understand the intent
      return await this.handleNaturalLanguageCommand(normalizedText, projectId);
    }

    // Extract parameters from the text
    const params = this.extractParameters(normalizedText, command);
    
    // Execute the command
    return await command.action({ ...params, userId, projectId });
  }

  private findBestMatchingCommand(text: string): VoiceCommand | null {
    let bestMatch: VoiceCommand | null = null;
    let bestScore = 0;

    for (const [key, command] of this.commands) {
      const score = this.calculateSimilarity(text, key);
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = command;
      }
    }

    return bestMatch;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = text1.split(' ');
    const words2 = text2.split(' ');
    
    const commonWords = words1.filter(w => words2.includes(w));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private extractParameters(text: string, command: VoiceCommand): any {
    const params: any = {};
    
    // Extract numbers
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      params.lineNumber = parseInt(numbers[0]);
    }

    // Extract file names (words ending with common extensions)
    const fileMatch = text.match(/(\w+\.(js|ts|jsx|tsx|py|java|cpp|c|go|rb|rs))/i);
    if (fileMatch) {
      params.fileName = fileMatch[1];
    }

    // Extract quoted strings
    const quotedMatch = text.match(/"([^"]+)"|'([^']+)'/);
    if (quotedMatch) {
      params.content = quotedMatch[1] || quotedMatch[2];
    }

    return params;
  }

  private async handleNaturalLanguageCommand(
    text: string,
    projectId?: number
  ): Promise<any> {
    // Use AI to understand and execute natural language commands
    if (!this.aiProvider) {
      const factory = new AIProviderFactory();
      this.aiProvider = await factory.getProvider();
    }

    const prompt = `
User voice command: "${text}"
Project context: ${projectId ? `Working on project ${projectId}` : 'No specific project'}

Interpret this voice command and return a structured action:
- If it's about navigation, return: { type: 'navigate', target: '...', ... }
- If it's about editing, return: { type: 'edit', action: '...', ... }
- If it's about AI assistance, return: { type: 'ai', action: '...', ... }
- If it's about system actions, return: { type: 'system', action: '...', ... }

Return only valid JSON.
`;

    const response = await this.aiProvider.generateChat([
      { role: 'system', content: 'You are a voice command interpreter.' },
      { role: 'user', content: prompt },
    ]);

    try {
      return JSON.parse(response);
    } catch {
      return {
        type: 'natural_language',
        text,
        interpretation: response,
      };
    }
  }

  private async explainCode(code: string, context?: string): Promise<string> {
    if (!this.aiProvider) {
      const factory = new AIProviderFactory();
      this.aiProvider = await factory.getProvider();
    }

    const prompt = `Explain this code in simple terms:

\`\`\`
${code}
\`\`\`

${context ? `Context: ${context}` : ''}

Provide a clear, concise explanation.`;

    return await this.aiProvider.generateChat([
      { role: 'user', content: prompt },
    ]);
  }

  private async debugCode(code: string, error?: string): Promise<any> {
    if (!this.aiProvider) {
      const factory = new AIProviderFactory();
      this.aiProvider = await factory.getProvider();
    }

    const prompt = `Debug this code and identify issues:

\`\`\`
${code}
\`\`\`

${error ? `Error message: ${error}` : ''}

Provide:
1. The issue(s) found
2. Why it's happening
3. How to fix it
4. Corrected code`;

    const response = await this.aiProvider.generateChat([
      { role: 'user', content: prompt },
    ]);

    return {
      analysis: response,
      suggestions: this.extractCodeBlocks(response),
    };
  }

  private async optimizeCode(code: string): Promise<any> {
    if (!this.aiProvider) {
      const factory = new AIProviderFactory();
      this.aiProvider = await factory.getProvider();
    }

    const prompt = `Optimize this code for better performance and readability:

\`\`\`
${code}
\`\`\`

Provide:
1. Performance improvements
2. Code style improvements
3. Best practices
4. Optimized version`;

    const response = await this.aiProvider.generateChat([
      { role: 'user', content: prompt },
    ]);

    return {
      analysis: response,
      optimized: this.extractCodeBlocks(response),
    };
  }

  private extractCodeBlocks(text: string): string[] {
    const codeBlocks = [];
    const regex = /```[\w]*\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    return codeBlocks;
  }

  async createVoiceSession(userId: number, ws: WebSocket): Promise<void> {
    // Store active WebSocket connection
    this.activeListeners.set(userId, ws);

    // Get user settings
    const [settings] = await db.select()
      .from(voiceCommandSettings)
      .where(eq(voiceCommandSettings.userId, userId));

    if (!settings || !settings.enabled) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Voice commands not enabled',
      }));
      ws.close();
      return;
    }

    // Send initial configuration
    ws.send(JSON.stringify({
      type: 'config',
      settings: {
        wakeWord: settings.wakeWord,
        language: settings.language,
        voiceModel: settings.voiceModel,
      },
    }));

    // Handle incoming audio
    ws.on('message', async (data: Buffer) => {
      try {
        const result = await this.processVoiceInput(userId, data);
        ws.send(JSON.stringify({
          type: 'result',
          ...result,
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: error.message,
        }));
      }
    });

    ws.on('close', () => {
      this.activeListeners.delete(userId);
    });
  }

  async getAvailableCommands(category?: string): Promise<VoiceCommand[]> {
    const commands = Array.from(this.commands.values());
    
    // Remove duplicates (aliases)
    const uniqueCommands = commands.filter((cmd, index, self) =>
      index === self.findIndex(c => c.command === cmd.command)
    );

    if (category) {
      return uniqueCommands.filter(cmd => cmd.category === category);
    }

    return uniqueCommands;
  }

  async addCustomCommand(
    userId: number,
    command: string,
    action: string
  ): Promise<void> {
    const [settings] = await db.select()
      .from(voiceCommandSettings)
      .where(eq(voiceCommandSettings.userId, userId));

    if (!settings) {
      throw new Error('Voice commands not enabled');
    }

    const customCommands = (settings.customCommands as any) || {};
    customCommands[command] = action;

    await db.update(voiceCommandSettings)
      .set({
        customCommands,
        updatedAt: new Date(),
      })
      .where(eq(voiceCommandSettings.userId, userId));
  }
}