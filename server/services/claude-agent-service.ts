import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { agentSessions, files as filesTable } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { syncFileToWorkspace } from '../terminal';
import { checkpointService } from './checkpoint-service';
import { createLogger } from '../utils/logger';

const client = new Anthropic();
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

const activeSessions = new Map<string, { controller: AbortController; streaming: boolean }>();

export class ClaudeAgentService {
  private agentId = process.env.CLAUDE_AGENT_ID || '';
  private environmentId = process.env.CLAUDE_ENVIRONMENT_ID || '';
  private vaultId = process.env.CLAUDE_VAULT_ID || '';

  isConfigured(): boolean {
    return !!(this.agentId && this.environmentId && process.env.ANTHROPIC_API_KEY);
  }

  async createSession(projectId: string, userId: string): Promise<{ sessionId: string; claudeSessionId: string }> {
    if (!this.isConfigured()) {
      throw new Error('Claude Agent SDK is not configured. Missing required environment variables.');
    }

    const session = await (client.beta as any).sessions.create({
      agent: this.agentId,
      environment_id: this.environmentId,
      vault_ids: this.vaultId ? [this.vaultId] : [],
      title: `project-${projectId}-user-${userId}`,
    });

    const [dbSession] = await db.insert(agentSessions).values({
      projectId,
      userId,
      claudeSessionId: session.id,
      mode: 'agent',
      status: 'active',
      metadata: { claudeSessionId: session.id, createdAt: new Date().toISOString() },
    }).returning();

    return { sessionId: dbSession.id, claudeSessionId: session.id };
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
      throw new Error('Claude Agent SDK is not configured.');
    }

    const response = await (client.beta as any).sessions.events.create(claudeSessionId, {
      events: [{
        type: 'user.message',
        content: [{ type: 'text', text: message }],
      }],
    });

    return response;
  }

  async streamEvents(claudeSessionId: string): Promise<AsyncIterable<any>> {
    if (!this.isConfigured()) {
      throw new Error('Claude Agent SDK is not configured.');
    }

    const stream = await (client.beta as any).sessions.events.stream(claudeSessionId);
    return stream;
  }

  async processAgentEvents(
    claudeSessionId: string,
    projectId: string,
    dbSessionId: string,
    onEvent?: (event: AgentEvent) => void,
    userId?: number,
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
    activeSessions.set(dbSessionId, { controller, streaming: true });

    broadcast('agent_status', { status: 'processing' });

    try {
      const stream = await this.streamEvents(claudeSessionId);

      for await (const event of stream) {
        if (controller.signal.aborted) break;

        switch (event.type) {
          case 'content_block_start':
          case 'content_block_delta': {
            if (event.delta?.type === 'text_delta' || event.content_block?.type === 'text') {
              broadcast('agent_message', {
                text: event.delta?.text || '',
                contentBlock: event.content_block,
              });
            }
            if (event.delta?.type === 'thinking_delta' || event.content_block?.type === 'thinking') {
              broadcast('agent_thinking', {
                text: event.delta?.thinking || '',
              });
            }
            break;
          }

          case 'tool_use': {
            const toolName = event.name || event.tool?.name;
            const toolInput = event.input || event.tool?.input || {};

            broadcast('agent_tool_use', {
              tool: toolName,
              input: toolInput,
              id: event.id,
            });

            const cmdStr = (toolInput.command || toolInput.cmd || '').toLowerCase();
            const isRiskyCommand = (toolName === 'execute_command' || toolName === 'bash' || toolName === 'shell') &&
              RISKY_COMMANDS.some(rc => cmdStr.includes(rc));
            const isRiskyFile = toolName === 'delete_file' || toolName === 'remove_file';

            if (isRiskyCommand || isRiskyFile) {
              try {
                const numericProjectId = parseInt(projectId, 10);
                if (!isNaN(numericProjectId)) {
                  await checkpointService.createCheckpoint({
                    projectId: numericProjectId,
                    userId: userId || 0,
                    name: `Auto-checkpoint before ${toolName}`,
                    description: `Automatic checkpoint before agent executed: ${isRiskyCommand ? cmdStr.slice(0, 100) : toolName}`,
                    type: 'before_action',
                  });
                  broadcast('checkpoint_created', {
                    reason: `Auto-checkpoint before risky operation: ${toolName}`,
                  });
                  logger.info(`Auto-checkpoint created before risky operation in project ${projectId}`);
                }
              } catch (err: any) {
                logger.warn(`Failed to create auto-checkpoint: ${err.message}`);
              }
            }

            if (toolName === 'create_file' || toolName === 'write_file' || toolName === 'edit_file') {
              await this.handleFileEvent(projectId, toolName, toolInput, broadcast);
            }

            if (toolName === 'execute_command' || toolName === 'bash' || toolName === 'shell') {
              const rawCmd = toolInput.command || toolInput.cmd || '';
              broadcast('terminal_command', {
                command: rawCmd,
                id: event.id,
              });

              const cmdLower = rawCmd.toLowerCase();
              const devServerPatterns = ['npm run dev', 'npm start', 'npx vite', 'yarn dev', 'pnpm dev', 'node server'];
              if (devServerPatterns.some(p => cmdLower.includes(p))) {
                broadcast('preview_refresh', {
                  reason: 'Agent started dev server',
                  url: `/api/preview/projects/${projectId}/preview/`,
                });
              }
            }
            break;
          }

          case 'tool_result': {
            broadcast('agent_tool_result', {
              toolUseId: event.tool_use_id,
              content: event.content,
              isError: event.is_error,
            });

            const contentText = this.extractTextFromContent(event.content);

            if (contentText) {
              broadcast('terminal_output', {
                output: contentText,
                toolUseId: event.tool_use_id,
              });
            }

            if (contentText && (contentText.includes('npm install') || contentText.includes('yarn add') || contentText.includes('pnpm add'))) {
              broadcast('packages_refresh', {});
            }

            if (contentText && (contentText.includes('migration') || contentText.includes('CREATE TABLE') || contentText.includes('ALTER TABLE'))) {
              broadcast('database_refresh', {});
            }

            break;
          }

          case 'message_start':
          case 'message_delta':
          case 'message_stop': {
            broadcast('agent_status', {
              status: event.type === 'message_stop' ? 'idle' : 'processing',
              messageId: event.message?.id,
              stopReason: event.delta?.stop_reason,
            });
            break;
          }

          default: {
            broadcast('agent_status', { rawType: event.type, event });
            break;
          }
        }
      }
    } catch (err: any) {
      broadcast('agent_error', { message: err.message || 'Stream error' });
    } finally {
      activeSessions.delete(dbSessionId);
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
          eq(filesTable.projectId, parseInt(projectId, 10)),
          eq(filesTable.name, filename),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(filesTable)
          .set({ content, updatedAt: new Date() })
          .where(eq(filesTable.id, existing[0].id));

        broadcast('file_updated', { name: filename, content, action: 'modified' });
      } else {
        const mimeTypes: Record<string, string> = {
          ts: 'text/typescript', tsx: 'text/tsx', js: 'text/javascript', jsx: 'text/jsx',
          html: 'text/html', css: 'text/css', json: 'application/json', md: 'text/markdown',
          py: 'text/x-python', go: 'text/x-go', rs: 'text/x-rust',
        };

        await db.insert(filesTable).values({
          projectId: parseInt(projectId, 10),
          name: filename,
          content,
          type: mimeTypes[ext] || 'text/plain',
          isDirectory: false,
        });

        broadcast('file_created', { name: filename, content, action: 'created' });
      }

      const previewExts = ['html', 'htm', 'tsx', 'jsx', 'vue', 'svelte', 'css'];
      if (previewExts.includes(ext)) {
        broadcast('preview_refresh', { filename, trigger: 'file_change' });
      }
    } catch (err: any) {
      console.error(`[claude-agent] File sync error for ${filename}:`, err.message);
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

    try {
      if (this.isConfigured()) {
        await (client.beta as any).sessions.archive(claudeSessionId);
      }
    } catch (err: any) {
      console.warn(`[claude-agent] Failed to archive Claude session: ${err.message}`);
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
