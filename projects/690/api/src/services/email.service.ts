import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import path from "path";
import fs from "fs";
import { promisify } from "util";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: string | number;
  name: string;
  sku?: string;
  quantity: number;
  price: number;
  currency?: string;
}

export interface CustomerInfo {
  name: string;
  email: string;
  phone?: string;
}

export interface OrderData {
  id: string | number;
  orderNumber: string;
  status: OrderStatus;
  createdAt: Date;
  updatedAt?: Date;
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
  notes?: string;
}

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName?: string;
  replyTo?: string;
  appBaseUrl?: string;
  templatesDir?: string;
  enabled?: boolean;
}

interface InternalTemplateParams {
  order: OrderData;
  subject: string;
  appBaseUrl?: string;
}

const readFileAsync = promisify(fs.readFile);

class EmailService {
  private transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;
  private readonly config: EmailServiceConfig;
  private readonly templatesDir: string;
  private readonly enabled: boolean;

  constructor(config?: Partial<EmailServiceConfig>) {
    const {
      EMAIL_HOST,
      EMAIL_PORT,
      EMAIL_SECURE,
      EMAIL_USER,
      EMAIL_PASS,
      EMAIL_FROM_ADDRESS,
      EMAIL_FROM_NAME,
      EMAIL_REPLY_TO,
      APP_BASE_URL,
      EMAIL_TEMPLATES_DIR,
      EMAIL_ENABLED,
      NODE_ENV,
    } = process.env as Record<string, string | undefined>;

    const port =
      config?.port ??
      (EMAIL_PORT ? Number.parseInt(EMAIL_PORT, 10) : 587);

    const secure =
      typeof config?.secure === "boolean"
        ? config.secure
        : EMAIL_SECURE
        ? EMAIL_SECURE === "true"
        : port === 465;

    const enabledFlag =
      typeof config?.enabled === "boolean"
        ? config.enabled
        : EMAIL_ENABLED
        ? EMAIL_ENABLED === "true"
        : NODE_ENV !== "test";

    this.enabled = enabledFlag;

    this.config = {
      host: config?.host || EMAIL_HOST || "localhost",
      port,
      secure,
      user: config?.user || EMAIL_USER || "",
      pass: config?.pass || EMAIL_PASS || "",
      fromAddress: config?.fromAddress || EMAIL_FROM_ADDRESS || "",
      fromName: config?.fromName || EMAIL_FROM_NAME || "Store",
      replyTo: config?.replyTo || EMAIL_REPLY_TO,
      appBaseUrl: config?.appBaseUrl || APP_BASE_URL || "http://localhost:3000",
      templatesDir:
        config?.templatesDir ||
        EMAIL_TEMPLATES_DIR ||
        path.resolve(process.cwd(), "templates", "email"),
      enabled: this.enabled,
    };

    this.templatesDir = this.config.templatesDir;
    if (this.enabled) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter(): void {
    if (!this.config.user || !this.config.pass) {
      this.enabled = false;
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    });
  }

  private async ensureTransporter(): Promise<void> {
    if (!this.enabled) return;
    if (!this.transporter) {
      this.initializeTransporter();
    }
  }

  private buildFromHeader(): string {
    const { fromName, fromAddress } = this.config;
    if (fromName) {
      return `undefined <undefined>`;
    }
    return fromAddress;
  }

  private formatCurrency(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(value);
    } catch {
      return `undefined undefined`;
    }
  }

  private safeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private buildOrderItemsHtml(
    items: OrderItem[],
    currency: string
  ): string {
    if (!items || items.length === 0) {
      return "<p>No items in this order.</p>";
    }

    const rows = items
      .map((item) => {
        const total = item.price * item.quantity;
        const priceFormatted = this.formatCurrency(item.price, currency);
        const totalFormatted = this.formatCurrency(total, currency);
        const skuPart = item.sku
          ? `<div style="font-size:12px;color:#666;">SKU: undefined</div>`
          : "";
        return `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">
              <div style="font-weight:500;">undefined</div>
              undefined
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">
              undefined
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">
              undefined
            </td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">
              undefined
            </td>
          </tr>
        `;
      })
      .join("");

    return `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr>
            <th align="left" style="padding:8px;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;color:#555;">Item</th>
            <th align="center" style="padding:8px;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;color:#555;">Qty</th>
            <th align="right" style="padding:8px;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;color:#555;">Price</th>
            <th align="right" style="padding:8px;border-bottom:2px solid #ddd;font-size:13px;text-transform:uppercase;color:#555;">Total</th>
          </tr>
        </thead>
        <tbody>
          undefined
        </tbody>
      </table>
    `;
  }

  private buildOrderSummaryHtml(order: OrderData): string {
    const currency = order.currency;
    const lines: string[] = [];

    lines.push(`
      <tr>
        <td style="padding:4px 0;color:#555;">Subtotal</td>
        <td style="padding:4px 0;text-align:right;color:#111;">
          undefined
        </td>
      </tr>
    `);

    if (typeof order.discount === "number" && order.discount !== 0) {
      lines.push(`
        <tr>
          <td style="padding:4px 0;color:#555;">Discount</td>
          <td style="padding:4px 0;text-align:right;color:#28a745;">
            -undefined
          </td>
        </tr>
      `);
    }

    if (typeof order.tax === "number" && order.tax !== 0) {
      lines.push(`
        <tr>
          <td style="padding:4px 0;color:#555;">Tax</td>
          <td style="padding:4px 0;text-align:right;color:#111;">
            undefined
          </td>
        </tr>
      `);
    }

    if (typeof order.shipping === "number") {
      lines.push(`
        <tr>
          <td style="padding:4px 0;color:#555;">Shipping</td>
          <td style="padding:4px 0;text-align:right;color:#111;">
            undefined
          </td>
        </tr>
      `);
    }

    lines.push(`
      <tr>
        <td style="padding:8px 0;border-top:1px solid #ccc;font-weight:600;font-size:15px;">Total</td