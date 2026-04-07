import nodemailer, { Transporter } from "nodemailer";

export type EmailRecipient = {
  name?: string;
  email: string;
};

export type OrderItem = {
  name: string;
  quantity: number;
  price: number;
};

export type OrderDetails = {
  id: string | number;
  customerName?: string;
  customerEmail: string;
  items: OrderItem[];
  totalAmount: number;
  currency?: string;
  createdAt?: Date | string;
};

export type OrderStatusUpdateDetails = {
  id: string | number;
  customerName?: string;
  customerEmail: string;
  status: string;
  updatedAt?: Date | string;
  notes?: string;
  trackingNumber?: string;
  trackingUrl?: string;
};

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string;
  fromEmail: string;
  fromName?: string;
}

export class EmailService {
  private transporter: Transporter;
  private fromEmail: string;
  private fromName?: string;

  constructor(config?: Partial<EmailServiceConfig>) {
    const resolvedConfig = this.resolveConfig(config);

    this.transporter = nodemailer.createTransport({
      host: resolvedConfig.host,
      port: resolvedConfig.port,
      secure: resolvedConfig.secure,
      auth: {
        user: resolvedConfig.authUser,
        pass: resolvedConfig.authPass,
      },
    });

    this.fromEmail = resolvedConfig.fromEmail;
    this.fromName = resolvedConfig.fromName;
  }

  private resolveConfig(config?: Partial<EmailServiceConfig>): EmailServiceConfig {
    const host = config?.host ?? process.env.EMAIL_HOST;
    const portStr = config?.port ?? (process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : undefined);
    const port = typeof portStr === "number" ? portStr : Number(portStr);
    const secure =
      typeof config?.secure === "boolean"
        ? config.secure
        : process.env.EMAIL_SECURE
        ? process.env.EMAIL_SECURE === "true"
        : port === 465;
    const authUser = config?.authUser ?? process.env.EMAIL_USER;
    const authPass = config?.authPass ?? process.env.EMAIL_PASS;
    const fromEmail = config?.fromEmail ?? process.env.EMAIL_FROM;
    const fromName = config?.fromName ?? process.env.EMAIL_FROM_NAME;

    if (!host) {
      throw new Error("EMAIL_HOST is not configured");
    }
    if (!port || Number.isNaN(port)) {
      throw new Error("EMAIL_PORT is not configured or invalid");
    }
    if (!authUser) {
      throw new Error("EMAIL_USER is not configured");
    }
    if (!authPass) {
      throw new Error("EMAIL_PASS is not configured");
    }
    if (!fromEmail) {
      throw new Error("EMAIL_FROM is not configured");
    }

    return {
      host,
      port,
      secure,
      authUser,
      authPass,
      fromEmail,
      fromName,
    };
  }

  private buildFromHeader(): string {
    if (this.fromName) {
      return `"undefined" <undefined>`;
    }
    return this.fromEmail;
  }

  private formatCurrency(amount: number, currency: string = "USD"): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount);
    } catch {
      return `undefined undefined`;
    }
  }

  private safeDateString(date?: Date | string): string {
    if (!date) {
      return "";
    }
    if (date instanceof Date) {
      return date.toLocaleString();
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return String(date);
    }
    return parsed.toLocaleString();
  }

  private async sendEmail(params: {
    to: EmailRecipient | string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const toHeader =
      typeof params.to === "string"
        ? params.to
        : params.to.name
        ? `"undefined" <undefined>`
        : params.to.email;

    await this.transporter.sendMail({
      from: this.buildFromHeader(),
      to: toHeader,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }

  private buildOrderConfirmationTemplates(order: OrderDetails): { subject: string; text: string; html: string } {
    const currency = order.currency || "USD";
    const totalFormatted = this.formatCurrency(order.totalAmount, currency);
    const orderDate = this.safeDateString(order.createdAt);
    const customerName = order.customerName || "Customer";

    const itemsLines = order.items
      .map(
        (item) =>
          `- undefined xundefined @ undefined = undefined`
      )
      .join("\n");

    const itemsHtmlRows = order.items
      .map((item) => {
        const lineTotal = item.price * item.quantity;
        return `
          <tr>
            <td style="padding: 4px 8px; border: 1px solid #ddd;">undefined</td>
            <td style="padding: 4px 8px; border: 1px solid #ddd; text-align: center;">undefined</td>
            <td style="padding: 4px 8px; border: 1px solid #ddd; text-align: right;">undefined</td>
            <td style="padding: 4px 8px; border: 1px solid #ddd; text-align: right;">undefined</td>
          </tr>`;
      })
      .join("");

    const subject = `Order Confirmation - #undefined`;

    const text = [
      `Hello undefined,`,
      "",
      "Thank you for your order!",
      "",
      `Order ID: undefined`,
      orderDate ? `Order Date: undefined` : "",
      "",
      "Order Details:",
      itemsLines,
      "",
      `Total: undefined`,
      "",
      "We will notify you as soon as your order status is updated.",
      "",
      "Best regards,",
      this.fromName || "Our Team",
    ]
      .filter(Boolean)
      .join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
        <p>Hello undefined,</p>
        <p>Thank you for your order!</p>
        <p>
          <strong>Order ID:</strong> undefined<br/>
          undefined<br/>` : ""}
        </p>
        <h3 style="margin-top: 20px;">Order Details</h3>
        <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <thead>
            <tr>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Item</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: center;">Qty</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Price</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            undefined
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>Order Total</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;"><strong>undefined</strong></td>
            </tr>
          </tfoot>
        </table>
        <p style="margin-top: 20px;">
          We will notify you as soon as your order status is updated.
        </p>
        <p>Best regards,<br/>undefined</p>
      </div>
    `;

    return { subject, text, html };
  }

  private buildOrderStatusUpdateTemplates(
    details: OrderStatusUpdateDetails
  ): { subject: string; text: string; html: string } {
    const customerName = details.customerName || "Customer";
    const updatedAt = this.safeDateString(details.updatedAt);
    const normalizedStatus = this.normalizeStatus(details.status);

    const subject = `Order #undefined Status Update: undefined`;

    const lines: string[] = [