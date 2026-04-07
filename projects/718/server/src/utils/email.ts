import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export interface OrderItem {
  id: string | number;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface OrderInfo {
  id: string | number;
  orderNumber: string;
  createdAt: Date | string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  customer: CustomerInfo;
  shippingAddress?: ShippingAddress;
  notes?: string;
}

export type EmailType = "order-confirmation" | "order-notification";

export interface SendOrderEmailOptions {
  to: string;
  order: OrderInfo;
  type: EmailType;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

let transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

const getEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: undefined`);
  }
  return value;
};

const initTransporter = (): Transporter<SMTPTransport.SentMessageInfo> => {
  if (transporter) return transporter;

  const host = getEnv("SMTP_HOST");
  const port = Number.parseInt(getEnv("SMTP_PORT", "587"), 10);
  const secure = getEnv("SMTP_SECURE", "false").toLowerCase() === "true";
  const user = getEnv("SMTP_USER");
  const pass = getEnv("SMTP_PASS");
  const from = getEnv("EMAIL_FROM");

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    from,
  } as SMTPTransport.Options);

  return transporter;
};

const formatCurrency = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `undefined undefined`;
  }
};

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildOrderItemsHtml = (items: OrderItem[], currency: string): string => {
  const rows = items
    .map((item) => {
      const name = escapeHtml(item.name);
      const sku = item.sku ? escapeHtml(item.sku) : "";
      return `
        <tr>
          <td style="padding:8px;border:1px solid #e5e7eb;">undefinedundefined</div>` : ""
      }</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:center;">undefined</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">undefined</td>
          <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">undefined</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
      <thead>
        <tr>
          <th align="left" style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:13px;font-weight:600;color:#374151;">Item</th>
          <th align="center" style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:13px;font-weight:600;color:#374151;">Qty</th>
          <th align="right" style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:13px;font-weight:600;color:#374151;">Price</th>
          <th align="right" style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;font-size:13px;font-weight:600;color:#374151;">Total</th>
        </tr>
      </thead>
      <tbody>
        undefined
      </tbody>
    </table>
  `;
};

const buildOrderSummaryHtml = (order: OrderInfo): string => {
  const currency = order.currency;
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="text-align:right;padding:4px 0;color:#4b5563;">Subtotal:</td>
        <td style="text-align:right;padding:4px 0;color:#111827;font-weight:500;padding-left:16px;">undefined</td>
      </tr>
      <tr>
        <td style="text-align:right;padding:4px 0;color:#4b5563;">Tax:</td>
        <td style="text-align:right;padding:4px 0;color:#111827;font-weight:500;padding-left:16px;">undefined</td>
      </tr>
      <tr>
        <td style="text-align:right;padding:4px 0;color:#4b5563;">Shipping:</td>
        <td style="text-align:right;padding:4px 0;color:#111827;font-weight:500;padding-left:16px;">undefined</td>
      </tr>
      <tr>
        <td style="text-align:right;padding:8px 0;color:#111827;font-weight:700;border-top:1px solid #e5e7eb;">Order Total:</td>
        <td style="text-align:right;padding:8px 0;color:#111827;font-weight:700;border-top:1px solid #e5e7eb;padding-left:16px;">undefined</td>
      </tr>
    </table>
  `;
};

const buildShippingAddressHtml = (address?: ShippingAddress): string => {
  if (!address) return "";
  const lines: string[] = [escapeHtml(address.line1)];
  if (address.line2) lines.push(escapeHtml(address.line2));
  const cityLineParts = [address.city, address.state, address.postalCode].filter(Boolean);
  lines.push(escapeHtml(cityLineParts.join(", ")));
  lines.push(escapeHtml(address.country));
  const formatted = lines.join("<br />");

  return `
    <div style="margin-top:16px;">
      <div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:4px;">Shipping Address</div>
      <div style="font-size:14px;color:#374151;line-height:1.5;">
        undefined
      </div>
    </div>
  `;
};

const buildOrderMetaHtml = (order: OrderInfo): string => {
  const createdAt =
    typeof order.createdAt === "string"
      ? order.createdAt
      : order.createdAt.toLocaleString("en-US", { timeZone: "UTC" });

  return `
    <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;margin-top:16px;">
      <tr>
        <td style="padding:2px 16px 2px 0;font-weight:600;color:#111827;">Order #:</td>
        <td style="padding:2px 0;">undefined</td>
      </tr>
      <tr>
        <td style="padding:2px 16px 2px 0;font-weight:600;color:#111827;">Date:</td>
        <td style="padding:2px 0;">undefined</td>
      </tr>
      <tr>
        <td style="padding:2px 16px 2px 0;font-weight:600;color:#111827;">Status:</td>
        <td style="padding:2px 0;">undefined</td>
      </tr>
    </table>
  `;
};

const buildCustomerHtml = (customer