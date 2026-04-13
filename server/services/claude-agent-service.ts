import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { agentSessions, files as filesTable } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { syncFileToWorkspace } from '../terminal';
import { checkpointService } from './checkpoint-service';
import { createLogger } from '../utils/logger';
import { getProjectWorkspacePath } from '../utils/project-fs-sync';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('claude-agent-service');

const RISKY_COMMANDS = [
  'rm -rf', 'rm -r', 'drop table', 'drop database', 'truncate',
  'npm uninstall', 'yarn remove', 'pnpm remove',
  'git reset --hard', 'git clean -fd',
  'npx drizzle-kit push', 'db:push',
];

export type AgentEventType =
  | 'agent_message'
  | 'agent_thinking'
  | 'agent_tool_use'
  | 'agent_tool_result'
  | 'file_created'
  | 'file_updated'
  | 'terminal_command'
  | 'terminal_output'
  | 'preview_refresh'
  | 'packages_refresh'
  | 'database_refresh'
  | 'checkpoint_created'
  | 'agent_status'
  | 'agent_error';

export interface AgentEvent {
  type: AgentEventType;
  sessionId: string;
  projectId: string;
  timestamp: number;
  data: any;
}

type BroadcastFn = (projectId: string, data: any) => void;

let broadcastFn: BroadcastFn | null = null;

export function setClaudeAgentBroadcastFn(fn: BroadcastFn) {
  broadcastFn = fn;
}

const activeSessions = new Map<string, { controller: AbortController; streaming: boolean; messages: any[] }>();

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_file',
    description: 'Create a new file or overwrite an existing file with the given content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Edit an existing file by replacing old_string with new_string. The old_string must match exactly.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
        old_string: { type: 'string', description: 'Exact string to find and replace' },
        new_string: { type: 'string', description: 'Replacement string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_files',
    description: 'List files and directories in a given path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Directory path relative to project root. Use "." for root.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'execute_command',
    description: 'Execute a shell command in the project workspace. Returns stdout and stderr.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'delete_file',
    description: 'Delete a file from the project.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
      },
      required: ['path'],
    },
  },
];

const AGENT_SYSTEM = `You are E-Code AI Agent (Claude), an expert full-stack software engineer.
You are working inside a project workspace. Use the provided tools to read, create, edit, and delete files, and to execute shell commands.
Always read relevant files before editing. Prefer precise edits over full rewrites.
When creating web apps, use modern best practices (React, TypeScript, Tailwind CSS).
Execute "npm install" or equivalent when adding new dependencies.
Keep your text responses concise and action-oriented.`;

export class ClaudeAgentService {
  private model = 'claude-sonnet-4-20250514';

  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  private getClient(): Anthropic {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async createSession(projectId: string, userId: string): Promise<{ sessionId: string; claudeSessionId: string }> {
    if (!this.isConfigured()) {
      throw new Error('Claude Agent is not configured. Set ANTHROPIC_API_KEY.');
    }

    const claudeSessionId = `claude-${projectId}-${Date.now()}`;

    const [dbSession] = await db.insert(agentSessions).values({
      projectId,
      userId,
      claudeSessionId,
      mode: 'agent',
      status: 'active',
      metadata: { claudeSessionId, createdAt: new Date().toISOString() },
    }).returning();

    return { sessionId: dbSession.id, claudeSessionId };
  }

  async getOrCreateSession(projectId: string, userId: string): Promise<{ sessionId: string; claudeSessionId: string }> {
    const existing = await db.select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.projectId, projectId),
        eq(agentSessions.userId, userId),
        eq(agentSessions.status, 'active'),
      ))
      .limit(1);

    if (existing.length > 0 && existing[0].claudeSessionId) {
      return { sessionId: existing[0].id, claudeSessionId: existing[0].claudeSessionId };
    }

    return this.createSession(projectId, userId);
  }

  async sendMessage(claudeSessionId: string, message: string): Promise<any> {
    if (!this.isConfigured()) {
      throw new Error('Claude Agent is not configured.');
    }

    const session = [...activeSessions.values()].find((_, _i, arr) => true) ||
      { messages: [] };

    for (const [key, val] of activeSessions.entries()) {
      if (key.includes(claudeSessionId) || val.messages) {
        val.messages.push({ role: 'user' as const, content: message });
        return { queued: true };
      }
    }

    return { queued: true, note: 'Message will be processed in stream' };
  }

  private async executeTool(
    projectId: string,
    toolName: string,
    toolInput: any,
    broadcast: (type: AgentEventType, data: any) => void,
    userId?: number,
  ): Promise<string> {
    const workspacePath = getProjectWorkspacePath(projectId);

    switch (toolName) {
      case 'create_file': {
        const filePath = toolInput.path || '';
        const content = toolInput.content || '';
        const fullPath = path.join(workspacePath, filePath);
        try {
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content, 'utf-8');
          await this.handleFileEvent(projectId, 'create_file', { filename: filePath, content }, broadcast);
          return `File created: ${filePath}`;
        } catch (err: any) {
          return `Error creating file: ${err.message}`;
        }
      }

      case 'edit_file': {
        const filePath = toolInput.path || '';
        const fullPath = path.join(workspacePath, filePath);
        try {
          const existing = fs.readFileSync(fullPath, 'utf-8');
          if (!existing.includes(toolInput.old_string)) {
            return `Error: old_string not found in ${filePath}`;
          }
          const updated = existing.replace(toolInput.old_string, toolInput.new_string);
          fs.writeFileSync(fullPath, updated, 'utf-8');
          await this.handleFileEvent(projectId, 'edit_file', { filename: filePath, content: updated }, broadcast);
          return `File edited: ${filePath}`;
        } catch (err: any) {
          return `Error editing file: ${err.message}`;
        }
      }

      case 'read_file': {
        const filePath = toolInput.path || '';
        const fullPath = path.join(workspacePath, filePath);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          return content.length > 50000 ? content.substring(0, 50000) + '\n... (truncated)' : content;
        } catch (err: any) {
          return `Error reading file: ${err.message}`;
        }
      }

      case 'list_files': {
        const dirPath = toolInput.path || '.';
        const fullPath = path.join(workspacePath, dirPath);
        try {
          const entries = fs.readdirSync(fullPath, { withFileTypes: true });
          const listing = entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`).join('\n');
          return listing || '(empty directory)';
        } catch (err: any) {
          return `Error listing files: ${err.message}`;
        }
      }

      case 'execute_command': {
        const command = toolInput.command || '';
        const cmdStr = command.toLowerCase();

        broadcast('terminal_command', { command, id: `tool-${Date.now()}` });

        const isRisky = RISKY_COMMANDS.some(rc => cmdStr.includes(rc));
        if (isRisky) {
          try {
            const numericProjectId = parseInt(projectId, 10);
            if (!isNaN(numericProjectId)) {
              await checkpointService.createCheckpoint({
                projectId: numericProjectId,
                userId: userId || 0,
                name: `Auto-checkpoint before ${command.slice(0, 50)}`,
                description: `Automatic checkpoint before agent executed: ${command.slice(0, 100)}`,
                type: 'before_action',
              });
              broadcast('checkpoint_created', { reason: `Auto-checkpoint before: ${command.slice(0, 50)}` });
            }
          } catch (err: any) {
            logger.warn(`Failed to create auto-checkpoint: ${err.message}`);
          }
        }

        try {
          const result = execSync(command, {
            cwd: workspacePath,
            timeout: 30000,
            maxBuffer: 1024 * 1024,
            encoding: 'utf-8',
            env: { ...process.env, HOME: workspacePath },
          });

          const output = (result || '').trim();
          broadcast('terminal_output', { output, toolUseId: `tool-${Date.now()}` });

          if (cmdStr.includes('npm install') || cmdStr.includes('yarn add') || cmdStr.includes('pnpm add')) {
            broadcast('packages_refresh', {});
          }

          const devServerPatterns = ['npm run dev', 'npm start', 'npx vite', 'yarn dev', 'pnpm dev'];
          if (devServerPatterns.some(p => cmdStr.includes(p))) {
            broadcast('preview_refresh', { reason: 'Agent started dev server' });
          }

          return output || '(command completed successfully)';
        } catch (err: any) {
          const stderr = err.stderr || err.message || 'Command failed';
          broadcast('terminal_output', { output: stderr, toolUseId: `tool-${Date.now()}` });
          return `Command error:\n${stderr}`;
        }
      }

      case 'delete_file': {
        const filePath = toolInput.path || '';
        const fullPath = path.join(workspacePath, filePath);
        try {
          const numericProjectId = parseInt(projectId, 10);
          if (!isNaN(numericProjectId)) {
            try {
              await checkpointService.createCheckpoint({
                projectId: numericProjectId,
                userId: userId || 0,
                name: `Auto-checkpoint before delete ${filePath}`,
                description: `Automatic checkpoint before deleting: ${filePath}`,
                type: 'before_action',
              });
              broadcast('checkpoint_created', { reason: `Auto-checkpoint before delete: ${filePath}` });
            } catch {}
          }

          fs.unlinkSync(fullPath);
          return `File deleted: ${filePath}`;
        } catch (err: any) {
          return `Error deleting file: ${err.message}`;
        }
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  async processAgentEvents(
    claudeSessionId: string,
    projectId: string,
    dbSessionId: string,
    onEvent?: (event: AgentEvent) => void,
    userId?: number,
    userMessage?: string,
  ) {
    const broadcast = (type: AgentEventType, data: any) => {
      const event: AgentEvent = {
        type,
        sessionId: dbSessionId,
        projectId,
        timestamp: Date.now(),
        data,
      };

      if (broadcastFn) {
        broadcastFn(projectId, { type: `claude_agent:${type}`, ...event });
      }
      if (onEvent) {
        onEvent(event);
      }
    };

    const controller = new AbortController();
    const sessionData = activeSessions.get(dbSessionId);
    const conversationMessages: any[] = sessionData?.messages || [];

    if (userMessage) {
      conversationMessages.push({ role: 'user' as const, content: userMessage });
    }

    activeSessions.set(dbSessionId, { controller, streaming: true, messages: conversationMessages });

    broadcast('agent_status', { status: 'processing' });

    try {
      const client = this.getClient();
      let messages = [...conversationMessages];
      let maxTurns = 20;

      while (maxTurns-- > 0) {
        if (controller.signal.aborted) break;

        broadcast('agent_status', { status: 'processing' });

        const stream = client.messages.stream({
          model: this.model,
          max_tokens: 8192,
          system: AGENT_SYSTEM,
          tools: AGENT_TOOLS,
          messages,
        });

        let fullText = '';
        const toolUseBlocks: any[] = [];
        let currentToolUse: any = null;
        let inputJsonBuffer = '';

        stream.on('text', (text) => {
          fullText += text;
          broadcast('agent_message', { text });
        });

        const finalMessage = await stream.finalMessage();

        for (const block of finalMessage.content) {
          if (block.type === 'tool_use') {
            toolUseBlocks.push(block);
          }
        }

        messages.push({ role: 'assistant' as const, content: finalMessage.content });

        if (finalMessage.stop_reason === 'end_turn' || toolUseBlocks.length === 0) {
          break;
        }

        const toolResults: any[] = [];
        for (const toolBlock of toolUseBlocks) {
          broadcast('agent_tool_use', {
            tool: toolBlock.name,
            input: toolBlock.input,
            id: toolBlock.id,
          });

          const result = await this.executeTool(projectId, toolBlock.name, toolBlock.input, broadcast, userId);

          broadcast('agent_tool_result', {
            toolUseId: toolBlock.id,
            content: result,
            isError: result.startsWith('Error'),
          });

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: toolBlock.id,
            content: result,
          });
        }

        messages.push({ role: 'user' as const, content: toolResults });
      }

      const session = activeSessions.get(dbSessionId);
      if (session) {
        session.messages = messages;
      }

    } catch (err: any) {
      logger.error(`Claude agent error: ${err.message}`);
      broadcast('agent_error', { message: err.message || 'Agent error' });
    } finally {
      const session = activeSessions.get(dbSessionId);
      if (session) {
        session.streaming = false;
      }
      broadcast('agent_status', { status: 'idle' });
    }
  }

  private async handleFileEvent(
    projectId: string,
    toolName: string,
    toolInput: any,
    broadcast: (type: AgentEventType, data: any) => void,
  ) {
    const filename = toolInput.filename || toolInput.path || toolInput.file_path || '';
    const content = toolInput.content || toolInput.text || '';

    if (!filename) return;

    const ext = filename.split('.').pop() || '';

    try {
      syncFileToWorkspace(projectId, filename, content);

      const existing = await db.select()
        .from(filesTable)
        .where(and(
          eq(filesTable.projectId, projectId),
          eq(filesTable.filename, filename),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(filesTable)
          .set({ content, updatedAt: new Date() })
          .where(eq(filesTable.id, existing[0].id));

        broadcast('file_updated', { name: filename, content, action: 'modified' });
      } else {
        await db.insert(filesTable).values({
          projectId,
          filename,
          content,
        });

        broadcast('file_created', { name: filename, content, action: 'created' });
      }

      const previewExts = ['html', 'htm', 'tsx', 'jsx', 'vue', 'svelte', 'css'];
      if (previewExts.includes(ext)) {
        broadcast('preview_refresh', { filename, trigger: 'file_change' });
      }
    } catch (err: any) {
      logger.warn(`File sync error for ${filename}: ${err.message}`);
    }
  }

  private extractTextFromContent(content: any): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }
    return '';
  }

  async archiveSession(claudeSessionId: string, dbSessionId: string) {
    const session = activeSessions.get(dbSessionId);
    if (session) {
      session.controller.abort();
      activeSessions.delete(dbSessionId);
    }

    await db.update(agentSessions)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(agentSessions.id, dbSessionId));
  }

  async getSessionStatus(dbSessionId: string) {
    const session = activeSessions.get(dbSessionId);
    return {
      streaming: session?.streaming || false,
      active: !!session,
    };
  }
}

export const claudeAgentService = new ClaudeAgentService();
