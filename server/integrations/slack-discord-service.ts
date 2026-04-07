import { EventEmitter } from 'events';
import axios from 'axios';

interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  channelId?: string;
  teamId?: string;
}

interface DiscordConfig {
  botToken?: string;
  guildId?: string;
  channelId?: string;
  webhookUrl?: string;
}

interface NotificationMessage {
  title: string;
  message: string;
  color?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  url?: string;
  author?: { name: string; icon?: string };
}

export class SlackDiscordService extends EventEmitter {
  private slackConfigs: Map<string, SlackConfig> = new Map();
  private discordConfigs: Map<string, DiscordConfig> = new Map();

  constructor() {
    super();
    this.initializeDefaultConfigs();
  }

  private initializeDefaultConfigs() {
    // Initialize with sample configurations
    this.slackConfigs.set('default', {
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      botToken: process.env.SLACK_BOT_TOKEN,
      channelId: process.env.SLACK_CHANNEL_ID,
      teamId: process.env.SLACK_TEAM_ID
    });

    this.discordConfigs.set('default', {
      botToken: process.env.DISCORD_BOT_TOKEN,
      guildId: process.env.DISCORD_GUILD_ID,
      channelId: process.env.DISCORD_CHANNEL_ID,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL
    });
  }

  // Slack Methods
  async configureSlack(projectId: string, config: SlackConfig): Promise<void> {
    this.slackConfigs.set(projectId, config);
    
    // Test connection
    if (config.botToken) {
      await this.testSlackConnection(config);
    }
    
    this.emit('slack:configured', { projectId, config });
  }

  async sendSlackMessage(projectId: string, message: NotificationMessage): Promise<void> {
    const config = this.slackConfigs.get(projectId) || this.slackConfigs.get('default');
    if (!config) {
      throw new Error('Slack not configured for this project');
    }

    const slackMessage = {
      text: message.title,
      attachments: [{
        color: message.color || 'good',
        title: message.title,
        text: message.message,
        fields: message.fields?.map(f => ({
          title: f.name,
          value: f.value,
          short: f.inline || false
        })),
        author_name: message.author?.name,
        author_icon: message.author?.icon,
        title_link: message.url,
        footer: 'E-Code',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    if (config.webhookUrl) {
      await axios.post(config.webhookUrl, slackMessage);
    } else if (config.botToken && config.channelId) {
      await axios.post('https://slack.com/api/chat.postMessage', {
        channel: config.channelId,
        ...slackMessage
      }, {
        headers: {
          'Authorization': `Bearer ${config.botToken}`,
          'Content-Type': 'application/json'
        }
      });
    }

    this.emit('slack:message_sent', { projectId, message });
  }

  async getSlackChannels(projectId: string): Promise<any[]> {
    const config = this.slackConfigs.get(projectId);
    if (!config?.botToken) {
      throw new Error('Slack bot token not configured');
    }

    const response = await axios.get('https://slack.com/api/conversations.list', {
      headers: {
        'Authorization': `Bearer ${config.botToken}`
      }
    });

    return response.data.channels || [];
  }

  async testSlackConnection(config: SlackConfig): Promise<boolean> {
    try {
      if (config.botToken) {
        const response = await axios.get('https://slack.com/api/auth.test', {
          headers: {
            'Authorization': `Bearer ${config.botToken}`
          }
        });
        return response.data.ok;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Discord Methods
  async configureDiscord(projectId: string, config: DiscordConfig): Promise<void> {
    this.discordConfigs.set(projectId, config);
    
    // Test connection
    if (config.botToken) {
      await this.testDiscordConnection(config);
    }
    
    this.emit('discord:configured', { projectId, config });
  }

  async sendDiscordMessage(projectId: string, message: NotificationMessage): Promise<void> {
    const config = this.discordConfigs.get(projectId) || this.discordConfigs.get('default');
    if (!config) {
      throw new Error('Discord not configured for this project');
    }

    const discordEmbed = {
      title: message.title,
      description: message.message,
      color: this.hexToDecimal(message.color || '#00ff00'),
      fields: message.fields,
      url: message.url,
      author: message.author ? {
        name: message.author.name,
        icon_url: message.author.icon
      } : undefined,
      footer: {
        text: 'E-Code',
        icon_url: 'https://e-code.ai/favicon.ico'
      },
      timestamp: new Date().toISOString()
    };

    const payload = {
      embeds: [discordEmbed]
    };

    if (config.webhookUrl) {
      await axios.post(config.webhookUrl, payload);
    } else if (config.botToken && config.channelId) {
      await axios.post(`https://discord.com/api/v10/channels/${config.channelId}/messages`, payload, {
        headers: {
          'Authorization': `Bot ${config.botToken}`,
          'Content-Type': 'application/json'
        }
      });
    }

    this.emit('discord:message_sent', { projectId, message });
  }

  async getDiscordChannels(projectId: string): Promise<any[]> {
    const config = this.discordConfigs.get(projectId);
    if (!config?.botToken || !config?.guildId) {
      throw new Error('Discord bot token and guild ID not configured');
    }

    const response = await axios.get(`https://discord.com/api/v10/guilds/${config.guildId}/channels`, {
      headers: {
        'Authorization': `Bot ${config.botToken}`
      }
    });

    return response.data.filter((channel: any) => channel.type === 0); // Text channels only
  }

  async testDiscordConnection(config: DiscordConfig): Promise<boolean> {
    try {
      if (config.botToken) {
        const response = await axios.get('https://discord.com/api/v10/users/@me', {
          headers: {
            'Authorization': `Bot ${config.botToken}`
          }
        });
        return response.status === 200;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  // Webhook Management
  async createSlackWebhook(projectId: string, channelId: string): Promise<string> {
    const config = this.slackConfigs.get(projectId);
    if (!config?.botToken) {
      throw new Error('Slack bot token not configured');
    }

    const response = await axios.post('https://slack.com/api/incoming-webhooks', {
      channel: channelId
    }, {
      headers: {
        'Authorization': `Bearer ${config.botToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.webhook.url;
  }

  async createDiscordWebhook(projectId: string, channelId: string, name: string): Promise<string> {
    const config = this.discordConfigs.get(projectId);
    if (!config?.botToken) {
      throw new Error('Discord bot token not configured');
    }

    const response = await axios.post(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      name: name || 'E-Code Notifications'
    }, {
      headers: {
        'Authorization': `Bot ${config.botToken}`,
        'Content-Type': 'application/json'
      }
    });

    const webhook = response.data;
    return `https://discord.com/api/webhooks/${webhook.id}/${webhook.token}`;
  }

  // Utility Methods
  private hexToDecimal(hex: string): number {
    return parseInt(hex.replace('#', ''), 16);
  }

  // Project Event Handlers
  async handleDeploymentEvent(projectId: string, event: any): Promise<void> {
    const message: NotificationMessage = {
      title: `Deployment ${event.status}`,
      message: `Project deployment ${event.status}: ${event.url || 'No URL available'}`,
      color: event.status === 'success' ? '#00ff00' : '#ff0000',
      fields: [
        { name: 'Project', value: event.projectName, inline: true },
        { name: 'Environment', value: event.environment || 'production', inline: true },
        { name: 'Version', value: event.version || 'latest', inline: true }
      ],
      url: event.url
    };

    // Send to both Slack and Discord if configured
    try {
      if (this.slackConfigs.has(projectId)) {
        await this.sendSlackMessage(projectId, message);
      }
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
    }

    try {
      if (this.discordConfigs.has(projectId)) {
        await this.sendDiscordMessage(projectId, message);
      }
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }

  async handleBuildEvent(projectId: string, event: any): Promise<void> {
    const message: NotificationMessage = {
      title: `Build ${event.status}`,
      message: `Project build ${event.status}${event.duration ? ` in ${event.duration}ms` : ''}`,
      color: event.status === 'success' ? '#00ff00' : event.status === 'failed' ? '#ff0000' : '#ffaa00',
      fields: [
        { name: 'Project', value: event.projectName, inline: true },
        { name: 'Branch', value: event.branch || 'main', inline: true },
        { name: 'Commit', value: event.commit?.slice(0, 7) || 'latest', inline: true }
      ]
    };

    // Send notifications
    try {
      if (this.slackConfigs.has(projectId)) {
        await this.sendSlackMessage(projectId, message);
      }
      if (this.discordConfigs.has(projectId)) {
        await this.sendDiscordMessage(projectId, message);
      }
    } catch (error) {
      console.error('Failed to send build notifications:', error);
    }
  }

  // Configuration Management
  getSlackConfig(projectId: string): SlackConfig | undefined {
    return this.slackConfigs.get(projectId);
  }

  getDiscordConfig(projectId: string): DiscordConfig | undefined {
    return this.discordConfigs.get(projectId);
  }

  removeSlackConfig(projectId: string): void {
    this.slackConfigs.delete(projectId);
    this.emit('slack:removed', { projectId });
  }

  removeDiscordConfig(projectId: string): void {
    this.discordConfigs.delete(projectId);
    this.emit('discord:removed', { projectId });
  }
}