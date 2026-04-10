/**
 * Slack MCP Server
 * Provides Slack integration capabilities
 */

import { WebClient } from '@slack/web-api';

export class SlackMCPServer {
  private client: WebClient | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      const token = process.env.SLACK_BOT_TOKEN;
      if (token) {
        this.client = new WebClient(token);
        this.initialized = true;
      }
    } catch (error) {
      console.error('[slack-mcp] Failed to initialize:', error);
    }
  }

  // Send a message to a Slack channel
  async sendMessage(params: {
    channel: string;
    text: string;
    blocks?: any[];
    threadTs?: string;
  }) {
    if (!this.client) {
      return { error: 'Slack client not initialized. Please set SLACK_BOT_TOKEN.' };
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: params.channel,
        text: params.text,
        blocks: params.blocks,
        thread_ts: params.threadTs,
      });

      return {
        success: true,
        messageId: result.ts,
        channel: result.channel,
      };
    } catch (error: any) {
      console.error('[slack-mcp] Send message error:', error);
      return { error: error.message };
    }
  }

  // List Slack channels
  async listChannels(params: { types?: string; limit?: number } = {}) {
    if (!this.client) {
      return { error: 'Slack client not initialized. Please set SLACK_BOT_TOKEN.' };
    }

    try {
      const result = await this.client.conversations.list({
        types: params.types || 'public_channel,private_channel',
        limit: params.limit || 100,
      });

      return {
        channels: result.channels?.map(channel => ({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          isMember: channel.is_member,
          numMembers: channel.num_members,
        })) || [],
      };
    } catch (error: any) {
      console.error('[slack-mcp] List channels error:', error);
      return { error: error.message };
    }
  }

  // List users in workspace
  async listUsers(params: { limit?: number } = {}) {
    if (!this.client) {
      return { error: 'Slack client not initialized. Please set SLACK_BOT_TOKEN.' };
    }

    try {
      const result = await this.client.users.list({
        limit: params.limit || 100,
      });

      return {
        users: result.members?.filter(user => !user.is_bot && !user.deleted).map(user => ({
          id: user.id,
          name: user.name,
          realName: user.real_name,
          email: user.profile?.email,
          isAdmin: user.is_admin,
          isOwner: user.is_owner,
        })) || [],
      };
    } catch (error: any) {
      console.error('[slack-mcp] List users error:', error);
      return { error: error.message };
    }
  }

  // Search messages
  async searchMessages(params: { query: string; count?: number }) {
    if (!this.client) {
      return { error: 'Slack client not initialized. Please set SLACK_BOT_TOKEN.' };
    }

    try {
      const result = await this.client.search.messages({
        query: params.query,
        count: params.count || 20,
      });

      return {
        messages: result.messages?.matches?.map(msg => ({
          text: msg.text,
          user: msg.user,
          channel: msg.channel?.name,
          timestamp: msg.ts,
        })) || [],
        total: result.messages?.total || 0,
      };
    } catch (error: any) {
      console.error('[slack-mcp] Search messages error:', error);
      return { error: error.message };
    }
  }

  // Upload file to Slack
  async uploadFile(params: {
    channels: string;
    content?: string;
    file?: Buffer;
    filename?: string;
    title?: string;
    initialComment?: string;
  }) {
    if (!this.client) {
      return { error: 'Slack client not initialized. Please set SLACK_BOT_TOKEN.' };
    }

    try {
      const uploadParams: any = {
        channels: params.channels,
        filename: params.filename,
        title: params.title,
        initial_comment: params.initialComment,
      };

      // Add either content or file
      if (params.content) {
        uploadParams.content = params.content;
      } else if (params.file) {
        uploadParams.file = params.file;
      }

      const result = await this.client.files.uploadV2(uploadParams);

      return {
        success: true,
        fileId: (result as any).file?.id,
        permalink: (result as any).file?.permalink,
      };
    } catch (error: any) {
      console.error('[slack-mcp] Upload file error:', error);
      return { error: error.message };
    }
  }

  // Get tool definitions
  getTools() {
    return [
      {
        name: 'slack_send_message',
        description: 'Send a message to a Slack channel',
        inputSchema: {
          type: 'object',
          properties: {
            channel: { type: 'string', description: 'Channel ID or name' },
            text: { type: 'string', description: 'Message text' },
            blocks: { type: 'array', description: 'Optional message blocks' },
            threadTs: { type: 'string', description: 'Optional thread timestamp' },
          },
          required: ['channel', 'text'],
        },
      },
      {
        name: 'slack_list_channels',
        description: 'List Slack channels',
        inputSchema: {
          type: 'object',
          properties: {
            types: { type: 'string', description: 'Channel types to include' },
            limit: { type: 'number', description: 'Maximum number of channels' },
          },
        },
      },
      {
        name: 'slack_list_users',
        description: 'List users in Slack workspace',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of users' },
          },
        },
      },
      {
        name: 'slack_search_messages',
        description: 'Search for messages in Slack',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'number', description: 'Number of results' },
          },
          required: ['query'],
        },
      },
      {
        name: 'slack_upload_file',
        description: 'Upload a file to Slack',
        inputSchema: {
          type: 'object',
          properties: {
            channels: { type: 'string', description: 'Comma-separated channel IDs' },
            content: { type: 'string', description: 'File content as string' },
            filename: { type: 'string', description: 'Name of the file' },
            title: { type: 'string', description: 'Title of the file' },
            initialComment: { type: 'string', description: 'Initial comment' },
          },
          required: ['channels'],
        },
      },
    ];
  }
}

export const slackMCP = new SlackMCPServer();