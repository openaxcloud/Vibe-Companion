import sgMail, { MailDataRequired, MailService } from '@sendgrid/mail';
import { readFile } from 'fs/promises';
import path from 'path';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  userId: string;
  customerEmail: string;
  customerName?: string;
  status: OrderStatus;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  items: OrderItem[];
  shippingAddress?: {
    fullName?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  billingAddress?: {
    fullName?: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  metadata?: Record<string, unknown>;
}

export interface EmailServiceConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
  templates?: {
    orderConfirmation?: string;
    orderStatusUpdate?: string;
  };
  sandboxMode?: boolean;
}

export interface SendOrderConfirmationOptions {
  order: OrderSummary;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  customData?: Record<string, unknown>;
}

export interface SendOrderStatusChangeOptions {
  order: OrderSummary;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  customData?: Record<string, unknown>;
}

interface TemplateData {
  [key: string]: unknown;
}

type TemplateCache = Map<string, string>;

const DEFAULT_TEMPLATES_DIR = path.resolve(process.cwd(), 'server', 'templates', 'email');

export class EmailService {
  private readonly sg: MailService;
  private readonly config: EmailServiceConfig;
  private readonly templateCache: TemplateCache = new Map();
  private readonly templatesDir: string;

  constructor(config?: Partial<EmailServiceConfig> & { templatesDir?: string }) {
    const apiKey = config?.apiKey || process.env.SENDGRID_API_KEY;
    const fromEmail = config?.fromEmail || process.env.EMAIL_FROM_ADDRESS;
    const fromName = config?.fromName || process.env.EMAIL_FROM_NAME;

    if (!apiKey) {
      throw new Error('Missing SendGrid API key. Set SENDGRID_API_KEY or pass in config.apiKey');
    }
    if (!fromEmail) {
      throw new Error('Missing from email. Set EMAIL_FROM_ADDRESS or pass in config.fromEmail');
    }

    this.sg = sgMail;
    this.sg.setApiKey(apiKey);

    this.config = {
      apiKey,
      fromEmail,
      fromName,
      templates: {
        orderConfirmation: config?.templates?.orderConfirmation || process.env.SENDGRID_TEMPLATE_ORDER_CONFIRMATION,
        orderStatusUpdate: config?.templates?.orderStatusUpdate || process.env.SENDGRID_TEMPLATE_ORDER_STATUS_UPDATE,
      },
      sandboxMode: config?.sandboxMode ?? (process.env.EMAIL_SANDBOX_MODE === 'true'),
    };

    this.templatesDir = config?.templatesDir || DEFAULT_TEMPLATES_DIR;
  }

  async sendOrderConfirmationEmail(options: SendOrderConfirmationOptions): Promise<void> {
    const { order } = options;
    if (!order.customerEmail) return;

    const templateId = this.config.templates?.orderConfirmation;

    const dynamicTemplateData: TemplateData = {
      subject: `Order Confirmation - undefined`,
      orderNumber: order.orderNumber,
      orderId: order.id,
      orderStatus: order.status,
      orderDate: this.formatDate(order.createdAt),
      customerName: order.customerName || this.extractNameFromEmail(order.customerEmail),
      currency: order.currency,
      subtotal: this.formatCurrency(order.subtotal, order.currency),
      taxTotal: this.formatCurrency(order.taxTotal, order.currency),
      shippingTotal: this.formatCurrency(order.shippingTotal, order.currency),
      discountTotal: this.formatCurrency(order.discountTotal, order.currency),
      grandTotal: this.formatCurrency(order.grandTotal, order.currency),
      items: order.items.map((item) => ({
        ...item,
        lineTotal: this.formatCurrency(item.unitPrice * item.quantity, item.currency || order.currency),
        unitPriceFormatted: this.formatCurrency(item.unitPrice, item.currency || order.currency),
      })),
      shippingAddress: order.shippingAddress || null,
      billingAddress: order.billingAddress || null,
      metadata: order.metadata || null,
      ...options.customData,
    };

    const msg: MailDataRequired = {
      to: order.customerEmail,
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName || 'Support',
      },
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      mailSettings: this.buildMailSettings(),
    };

    if (templateId) {
      msg.templateId = templateId;
      msg.dynamicTemplateData = dynamicTemplateData;
    } else {
      const html = await this.renderLocalTemplate('order-confirmation.html', dynamicTemplateData);
      const text = await this.renderLocalTemplate('order-confirmation.txt', dynamicTemplateData).catch(() => undefined);

      msg.subject = String(dynamicTemplateData.subject);
      msg.html = html;
      if (text) msg.text = text;
    }

    await this.sg.send(msg);
  }

  async sendOrderStatusChangeEmail(options: SendOrderStatusChangeOptions): Promise<void> {
    const { order, previousStatus, newStatus } = options;
    if (!order.customerEmail) return;

    const templateId = this.config.templates?.orderStatusUpdate;

    const dynamicTemplateData: TemplateData = {
      subject: `Order undefined Status Update: undefined`,
      orderNumber: order.orderNumber,
      orderId: order.id,
      previousStatus,
      newStatus,
      previousStatusLabel: this.titleCase(previousStatus),
      newStatusLabel: this.titleCase(newStatus),
      updatedAt: this.formatDate(order.updatedAt || new Date()),
      customerName: order.customerName || this.extractNameFromEmail(order.customerEmail),
      currency: order.currency,
      grandTotal: this.formatCurrency(order.grandTotal, order.currency),
      items: order.items.map((item) => ({
        ...item,
        lineTotal: this.formatCurrency(item.unitPrice * item.quantity, item.currency || order.currency),
        unitPriceFormatted: this.formatCurrency(item.unitPrice, item.currency || order.currency),
      })),
      metadata: order.metadata || null,
      ...options.customData,
    };

    const msg: MailDataRequired = {
      to: order.customerEmail,
      from: {
        email: this.config.fromEmail,
        name: this.config.fromName || 'Support',
      },
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo,
      mailSettings: this.buildMailSettings(),
    };

    if (templateId) {
      msg.templateId = templateId;
      msg.dynamicTemplateData = dynamicTemplateData;
    } else {
      const html = await this.renderLocalTemplate('order-status-update.html', dynamicTemplateData);
      const text = await this.renderLocalTemplate('order-status-update.txt', dynamicTemplateData).catch(() => undefined);

      msg.subject = String(dynamicTemplateData.subject);
      msg.html = html;
      if (text) msg.text = text;
    }

    await this.sg.send(msg);
  }

  private buildMailSettings() {
    if (!this.config.sandboxMode) return undefined;
    return {
      sandboxMode: {
        enable: true,
      },
    };
  }

  private formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
      }).format(amount);
    } catch {
      return `undefined undefined`;
    }
  }

  private titleCase(value: string): string {
    return value
      .replace(/_/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private extractNameFromEmail(email: string): string {
    const [local] = email.split('@');
    if (!local) return 'Customer';
    const cleaned = local.replace(/[._]/g, ' ');
    return