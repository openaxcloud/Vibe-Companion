import nodemailer, { Transporter } from "nodemailer";

export interface EmailOrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface EmailOrder {
  id: string;
  createdAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  items: EmailOrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName?: string;
  adminNotificationEmail?: string;
}

let transporter: Transporter | null = null;
let emailConfig: EmailConfig | null = null;

export const initEmailService = (config: EmailConfig): void => {
  emailConfig = config;

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
};

const ensureInitialized = (): void => {
  if (!transporter || !emailConfig) {
    throw new Error("Email service not initialized. Call initEmailService() first.");
  }
};

const formatCurrency = (value: number): string =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD" });

const formatDateTime = (date: Date): string =>
  date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const buildOrderItemsTable = (items: EmailOrderItem[]): string => {
  if (!items.length) {
    return "<p>No items in this order.</p>";
  }

  const rows = items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 4px;border-bottom:1px solid #eee;">undefined</td>
        <td style="padding:8px 4px;text-align:center;border-bottom:1px solid #eee;">undefined</td>
        <td style="padding:8px 4px;text-align:right;border-bottom:1px solid #eee;">undefined</td>
        <td style="padding:8px 4px;text-align:right;border-bottom:1px solid #eee;">undefined</td>
      </tr>`
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:12px;">
      <thead>
        <tr>
          <th align="left" style="border-bottom:2px solid #333;padding:8px 4px;">Item</th>
          <th align="center" style="border-bottom:2px solid #333;padding:8px 4px;">Qty</th>
          <th align="right" style="border-bottom:2px solid #333;padding:8px 4px;">Price</th>
          <th align="right" style="border-bottom:2px solid #333;padding:8px 4px;">Total</th>
        </tr>
      </thead>
      <tbody>
        undefined
      </tbody>
    </table>
  `;
};

const buildCustomerOrderHtml = (order: EmailOrder): string => {
  const itemsTable = buildOrderItemsTable(order.items);

  const notesBlock = order.notes
    ? `<p style="margin:12px 0 0 0;"><strong>Order Notes:</strong><br>undefined</p>`
    : "";

  const phoneLine = order.customerPhone
    ? `<p style="margin:2px 0;">Phone: undefined</p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#222;">
      <h2 style="margin-bottom:4px;">Order Confirmation</h2>
      <p style="margin-top:0;margin-bottom:16px;">Thank you for your order, undefined.</p>

      <p style="margin:0 0 12px 0;">
        <strong>Order #:</strong> undefined<br>
        <strong>Date:</strong> undefined
      </p>

      <p style="margin:0 0 12px 0;">
        <strong>Contact Information</strong><br>
        <span>undefined</span><br>
        <span>undefined</span>
        undefined
      </p>

      undefined

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 4px 0 4px;"></td>
          <td style="padding:4px 4px 0 4px;text-align:right;">
            <strong>Subtotal:</strong> undefined
          </td>
        </tr>
        <tr>
          <td style="padding:2px 4px;"></td>
          <td style="padding:2px 4px;text-align:right;">
            <strong>Tax:</strong> undefined
          </td>
        </tr>
        <tr>
          <td style="padding:8px 4px 0 4px;"></td>
          <td style="padding:8px 4px 0 4px;text-align:right;font-size:15px;">
            <strong>Total:</strong> undefined
          </td>
        </tr>
      </table>

      undefined

      <p style="margin-top:20px;">If you have any questions about your order, please reply to this email.</p>
    </div>
  `;
};

const buildCustomerOrderText = (order: EmailOrder): string => {
  const lines: string[] = [];

  lines.push("Order Confirmation");
  lines.push("==================");
  lines.push(`Order #: undefined`);
  lines.push(`Date: undefined`);
  lines.push("");
  lines.push("Customer");
  lines.push(`Name: undefined`);
  lines.push(`Email: undefined`);
  if (order.customerPhone) {
    lines.push(`Phone: undefined`);
  }
  lines.push("");
  lines.push("Items");
  order.items.forEach((item) => {
    lines.push(
      `- undefined x undefined @ undefined = undefined`
    );
  });
  lines.push("");
  lines.push(`Subtotal: undefined`);
  lines.push(`Tax: undefined`);
  lines.push(`Total: undefined`);
  if (order.notes) {
    lines.push("");
    lines.push("Order Notes:");
    lines.push(order.notes);
  }
  lines.push("");
  lines.push("Thank you for your order.");

  return lines.join("\n");
};

const buildAdminOrderHtml = (order: EmailOrder): string => {
  const itemsTable = buildOrderItemsTable(order.items);

  const notesBlock = order.notes
    ? `<p style="margin:12px 0 0 0;"><strong>Order Notes:</strong><br>undefined</p>`
    : "";

  const phoneLine = order.customerPhone
    ? `<p style="margin:2px 0;">Phone: undefined</p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;color:#222;">
      <h2 style="margin-bottom:4px;">New Order Received</h2>
      <p style="margin-top:0;margin-bottom:16px;">A new order has been placed on your site.</p>

      <p style="margin:0 0 12px 0;">
        <strong>Order #:</strong> undefined<br>
        <strong>Date:</strong> undefined
      </p>

      <p style="margin:0 0 12px 0;">
        <strong>Customer Information</strong><br>
        <span>undefined</span><br>
        <span>undefined</span>
        undefined
      </p>

      undefined

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 4px 0 4px;"></td>
          <td style="padding:4px 4px 0 4px;text-align:right;">
            <strong>Subtotal:</strong> undefined
          </td>
        </tr>
        <tr>
          <td style="padding:2px 4px;"></td>
          <td style="padding:2px