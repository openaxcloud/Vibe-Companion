// @ts-nocheck
import { EventEmitter } from 'events';
import axios from 'axios';
import crypto from 'crypto';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  headers?: Record<string, string>;
  enabled: boolean;
  retryAttempts: number;
  timeout: number;
  createdAt: Date;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
}

interface WebhookPayload {
  event: string;
  timestamp: number;
  projectId: string;
  data: any;
  signature?: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  url: string;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  response?: {
    status: number;
    headers: Record<string, string>;
    body: string;
  };
  error?: string;
  timestamp: Date;
  duration?: number;
}

export class WebhookService extends EventEmitter {
  private webhooks: Map<string, WebhookConfig[]> = new Map(); // projectId -> webhooks
  private deliveries: Map<string, WebhookDelivery> = new Map(); // deliveryId -> delivery
  private deliveryQueue: WebhookDelivery[] = [];
  private processing = false;

  constructor() {
    super();
    this.startDeliveryProcessor();
  }

  // Webhook Management
  async createWebhook(projectId: string, config: Omit<WebhookConfig, 'id' | 'createdAt' | 'successCount' | 'failureCount'>): Promise<WebhookConfig> {
    const webhook: WebhookConfig = {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      successCount: 0,
      failureCount: 0
    };

    // Validate webhook URL
    await this.validateWebhookUrl(webhook.url);

    const projectWebhooks = this.webhooks.get(projectId) || [];
    projectWebhooks.push(webhook);
    this.webhooks.set(projectId, projectWebhooks);

    this.emit('webhook:created', { projectId, webhook });
    return webhook;
  }

  async updateWebhook(projectId: string, webhookId: string, updates: Partial<WebhookConfig>): Promise<void> {
    const projectWebhooks = this.webhooks.get(projectId) || [];
    const webhookIndex = projectWebhooks.findIndex(w => w.id === webhookId);
    
    if (webhookIndex === -1) {
      throw new Error('Webhook not found');
    }

    // Validate URL if being updated
    if (updates.url) {
      await this.validateWebhookUrl(updates.url);
    }

    projectWebhooks[webhookIndex] = { ...projectWebhooks[webhookIndex], ...updates };
    this.webhooks.set(projectId, projectWebhooks);

    this.emit('webhook:updated', { projectId, webhookId, updates });
  }

  async deleteWebhook(projectId: string, webhookId: string): Promise<void> {
    const projectWebhooks = this.webhooks.get(projectId) || [];
    const filteredWebhooks = projectWebhooks.filter(w => w.id !== webhookId);
    
    if (filteredWebhooks.length === projectWebhooks.length) {
      throw new Error('Webhook not found');
    }

    this.webhooks.set(projectId, filteredWebhooks);
    this.emit('webhook:deleted', { projectId, webhookId });
  }

  getWebhooks(projectId: string): WebhookConfig[] {
    return this.webhooks.get(projectId) || [];
  }

  getWebhook(projectId: string, webhookId: string): WebhookConfig | undefined {
    const projectWebhooks = this.webhooks.get(projectId) || [];
    return projectWebhooks.find(w => w.id === webhookId);
  }

  // Event Triggering
  async triggerWebhooks(projectId: string, event: string, data: any): Promise<void> {
    const projectWebhooks = this.webhooks.get(projectId) || [];
    const relevantWebhooks = projectWebhooks.filter(w => 
      w.enabled && w.events.includes(event)
    );

    if (relevantWebhooks.length === 0) {
      return;
    }

    const timestamp = Date.now();
    const payload: WebhookPayload = {
      event,
      timestamp,
      projectId,
      data
    };

    for (const webhook of relevantWebhooks) {
      const delivery: WebhookDelivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        event,
        url: webhook.url,
        status: 'pending',
        attempts: 0,
        timestamp: new Date()
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        payload.signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
      }

      this.deliveries.set(delivery.id, delivery);
      this.deliveryQueue.push(delivery);

      // Update webhook stats
      webhook.lastTriggered = new Date();
    }

    this.emit('webhooks:triggered', { projectId, event, count: relevantWebhooks.length });
  }

  // Delivery Processing
  private async startDeliveryProcessor(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.processing) {
      if (this.deliveryQueue.length > 0) {
        const delivery = this.deliveryQueue.shift()!;
        await this.processDelivery(delivery);
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook = this.findWebhookById(delivery.webhookId);
    if (!webhook) {
      delivery.status = 'failed';
      delivery.error = 'Webhook configuration not found';
      return;
    }

    const startTime = Date.now();
    delivery.attempts++;
    delivery.status = 'retrying';

    try {
      const payload: WebhookPayload = {
        event: delivery.event,
        timestamp: delivery.timestamp.getTime(),
        projectId: this.findProjectIdForWebhook(delivery.webhookId)!,
        data: {} // This would be populated from the original trigger
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        payload.signature = this.generateSignature(JSON.stringify(payload), webhook.secret);
      }

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'E-Code-Webhooks/1.0',
        'X-E-Code-Event': delivery.event,
        'X-E-Code-Delivery': delivery.id,
        ...webhook.headers
      };

      if (payload.signature) {
        headers['X-E-Code-Signature'] = payload.signature;
      }

      const response = await axios.post(delivery.url, payload, {
        headers,
        timeout: webhook.timeout || 10000,
        validateStatus: (status) => status < 500 // Only retry on 5xx errors
      });

      delivery.duration = Date.now() - startTime;
      delivery.response = {
        status: response.status,
        headers: response.headers as Record<string, string>,
        body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      };

      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'success';
        webhook.successCount++;
        this.emit('webhook:delivery_success', { delivery, webhook });
      } else {
        delivery.status = 'failed';
        delivery.error = `HTTP ${response.status}: ${response.statusText}`;
        webhook.failureCount++;
        this.emit('webhook:delivery_failed', { delivery, webhook });
      }

    } catch (error: any) {
      delivery.duration = Date.now() - startTime;
      delivery.status = 'failed';
      delivery.error = error.message;
      webhook.failureCount++;

      // Retry logic
      if (delivery.attempts < webhook.retryAttempts) {
        const retryDelay = Math.pow(2, delivery.attempts) * 1000; // Exponential backoff
        setTimeout(() => {
          delivery.status = 'pending';
          this.deliveryQueue.push(delivery);
        }, retryDelay);
      } else {
        this.emit('webhook:delivery_failed', { delivery, webhook });
      }
    }

    this.deliveries.set(delivery.id, delivery);
  }

  // Webhook Validation
  private async validateWebhookUrl(url: string): Promise<void> {
    try {
      const parsedUrl = new URL(url);
      
      // Ensure HTTPS for security
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Webhook URL must use HTTPS');
      }

      // Prevent localhost/internal URLs
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname) ||
          parsedUrl.hostname.includes('192.168.') ||
          parsedUrl.hostname.includes('10.') ||
          parsedUrl.hostname.includes('172.')) {
        throw new Error('Webhook URL cannot point to internal/localhost addresses');
      }

      // Test the endpoint
      await axios.head(url, { timeout: 5000 });
    } catch (error: any) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new Error('Webhook URL is not accessible');
      }
      throw error;
    }
  }

  // Signature Generation
  private generateSignature(payload: string, secret: string): string {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  // Signature Verification (for incoming webhook validation)
  verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Delivery Management
  getDeliveries(projectId: string, webhookId?: string, limit: number = 50): WebhookDelivery[] {
    const allDeliveries = Array.from(this.deliveries.values());
    
    let filtered = allDeliveries.filter(d => {
      const webhook = this.findWebhookById(d.webhookId);
      return webhook && this.findProjectIdForWebhook(d.webhookId) === projectId;
    });

    if (webhookId) {
      filtered = filtered.filter(d => d.webhookId === webhookId);
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getDelivery(deliveryId: string): WebhookDelivery | undefined {
    return this.deliveries.get(deliveryId);
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = this.deliveries.get(deliveryId);
    if (!delivery) {
      throw new Error('Delivery not found');
    }

    if (delivery.status === 'success') {
      throw new Error('Cannot retry successful delivery');
    }

    delivery.status = 'pending';
    delivery.attempts = 0;
    delivery.error = undefined;
    delivery.response = undefined;
    
    this.deliveryQueue.push(delivery);
    this.emit('webhook:delivery_retried', { deliveryId });
  }

  // Statistics
  getWebhookStats(projectId: string, webhookId?: string): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    averageResponseTime: number;
  } {
    const deliveries = this.getDeliveries(projectId, webhookId, 1000);
    
    const totalDeliveries = deliveries.length;
    const successfulDeliveries = deliveries.filter(d => d.status === 'success').length;
    const failedDeliveries = deliveries.filter(d => d.status === 'failed').length;
    const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;
    
    const responseTimes = deliveries
      .filter(d => d.duration !== undefined)
      .map(d => d.duration!);
    
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      successRate,
      averageResponseTime
    };
  }

  // Event Types
  getSupportedEvents(): string[] {
    return [
      'project.created',
      'project.updated',
      'project.deleted',
      'deployment.started',
      'deployment.completed',
      'deployment.failed',
      'build.started',
      'build.completed',
      'build.failed',
      'collaboration.user_joined',
      'collaboration.user_left',
      'ai.chat_message',
      'ai.code_generated',
      'file.created',
      'file.updated',
      'file.deleted',
      'secret.created',
      'secret.updated',
      'secret.deleted'
    ];
  }

  // Helper Methods
  private findWebhookById(webhookId: string): WebhookConfig | undefined {
    for (const projectWebhooks of this.webhooks.values()) {
      const webhook = projectWebhooks.find(w => w.id === webhookId);
      if (webhook) return webhook;
    }
    return undefined;
  }

  private findProjectIdForWebhook(webhookId: string): string | undefined {
    for (const [projectId, projectWebhooks] of this.webhooks.entries()) {
      if (projectWebhooks.some(w => w.id === webhookId)) {
        return projectId;
      }
    }
    return undefined;
  }

  // Bulk Operations
  async bulkTriggerWebhooks(events: Array<{ projectId: string; event: string; data: any }>): Promise<void> {
    const promises = events.map(({ projectId, event, data }) => 
      this.triggerWebhooks(projectId, event, data)
    );
    
    await Promise.all(promises);
    this.emit('webhooks:bulk_triggered', { count: events.length });
  }

  // Cleanup
  cleanupOldDeliveries(olderThanDays: number = 30): number {
    const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
    let cleanedCount = 0;

    for (const [deliveryId, delivery] of this.deliveries.entries()) {
      if (delivery.timestamp < cutoffDate) {
        this.deliveries.delete(deliveryId);
        cleanedCount++;
      }
    }

    this.emit('webhooks:cleanup_completed', { cleanedCount });
    return cleanedCount;
  }

  // Graceful Shutdown
  async shutdown(): Promise<void> {
    this.processing = false;
    // Wait for current deliveries to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    this.emit('webhook:service_shutdown');
  }
}