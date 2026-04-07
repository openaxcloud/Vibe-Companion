import nodemailer, { Transporter } from "nodemailer";

interface MailEnvConfig {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  SMTP_SECURE?: string;
  MAIL_FROM?: string;
  ADMIN_EMAIL?: string;
  NODE_ENV?: string;
}

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderDetails {
  orderId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date | string;
  notes?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode: string;
    country: string;
  };
}

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
}

let transporter: Transporter | null = null;

function getEnv(): MailEnvConfig {
  return {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_SECURE: process.env.SMTP_SECURE,
    MAIL_FROM: process.env.MAIL_FROM,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function createTransport(): Transporter {
  const env = getEnv();

  if (!env.SMTP_HOST || !env.SMTP_PORT) {
    throw new Error("SMTP configuration is missing: SMTP_HOST/SMTP_PORT are required.");
  }

  const port = Number(env.SMTP_PORT);
  if (Number.isNaN(port)) {
    throw new Error("SMTP_PORT must be a valid number.");
  }

  const secure =
    typeof env.SMTP_SECURE === "string"
      ? env.SMTP_SECURE.toLowerCase() === "true"
      : port === 465;

  const auth =
    env.SMTP_USER && env.SMTP_PASS
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        }
      : undefined;

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    auth,
  });

  return transport;
}

function getTransport(): Transporter {
  if (!transporter) {
    transporter = createTransport();
  }
  return transporter;
}

export function isMailConfigured(): boolean {
  try {
    const env = getEnv();
    return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.MAIL_FROM);
  } catch {
    return false;
  }
}

async function sendMail(options: SendMailOptions): Promise<void> {
  const env = getEnv();

  if (!isMailConfigured()) {
    if (env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        "[mailer] Email not sent: SMTP configuration missing. Intended mail:",
        {
          to: options.to,
          subject: options.subject,
        }
      );
    }
    return;
  }

  const mailFrom = env.MAIL_FROM as string;

  const transport = getTransport();

  await transport.sendMail({
    from: mailFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "0.00";
  }
  return amount.toFixed(2);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderOrderItemsTable(items: OrderItem[]): string {
  if (!items || !items.length) {
    return "<p>No items in this order.</p>";
  }

  const rows = items
    .map((item) => {
      const name = escapeHtml(item.name);
      const qty = item.quantity;
      const price = formatCurrency(item.price);
      const lineTotal = formatCurrency(item.price * item.quantity);
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee;">undefined</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: center;">undefined</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">$undefined</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #eee; text-align: right;">$undefined</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr>
          <th align="left" style="padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 14px;">Item</th>
          <th align="center" style="padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 14px;">Qty</th>
          <th align="right" style="padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 14px;">Price</th>
          <th align="right" style="padding: 8px 12px; border-bottom: 2px solid #ddd; font-size: 14px;">Total</th>
        </tr>
      </thead>
      <tbody>
        undefined
      </tbody>
    </table>
  `;
}

function renderOrderSummary(order: OrderDetails): string {
  const subtotal = formatCurrency(order.subtotal);
  const tax = formatCurrency(order.tax);
  const total = formatCurrency(order.total);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 16px;">
      <tbody>
        <tr>
          <td style="padding: 4px 12px; text-align: right;">Subtotal:</td>
          <td style="padding: 4px 12px; text-align: right;">$undefined</td>
        </tr>
        <tr>
          <td style="padding: 4px 12px; text-align: right;">Tax:</td>
          <td style="padding: 4px 12px; text-align: right;">$undefined</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; border-top: 1px solid #eee;">Total:</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: bold; border-top: 1px solid #eee;">$undefined</td>
        </tr>
      </tbody>
    </table>
  `;
}

function renderShippingAddress(order: OrderDetails): string {
  if (!order.shippingAddress) return "";

  const { line1, line2, city, state, postalCode, country } = order.shippingAddress;

  const parts: string[] = [escapeHtml(line1)];
  if (line2) parts.push(escapeHtml(line2));
  const cityLine = [city, state, postalCode].filter(Boolean).join(", ");
  if (cityLine) parts.push(escapeHtml(cityLine));
  parts.push(escapeHtml(country));

  return `
    <div style="margin-top: 16px;">
      <div style="font-weight: bold; margin-bottom: 4px;">Shipping Address</div>
      <div style="font-size: 14px; line-height: 1.5;">
        undefined
      </div>
    </div>
  `;
}

function renderNotes(order: OrderDetails): string {
  if (!order.notes) return "";
  return `
    <div style="margin-top: 16px;">
      <div style="font-weight: bold; margin-bottom: 4px;">Order Notes</div>
      <div style="font-size: 14px; line-height: 1.5; white-space: pre-wrap;">
        undefined
      </div>
    </div>
  `;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildOrderConfirmationHtml(order: OrderDetails): string {
  const orderDate = formatDate(order.createdAt);
  const itemsTable = renderOrderItemsTable(order.items);