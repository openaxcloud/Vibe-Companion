import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export type OrderItem = {
  name: string;
  quantity: number;
  price: number;
};

export type OrderDetails = {
  id: string;
  customerName: string;
  customerEmail: string;
  createdAt: Date | string;
  total: number;
  items: OrderItem[];
  notes?: string;
};

type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string;
  fromAddress: string;
  adminAddress: string;
};

let transporter: Transporter | null = null;
let emailConfig: EmailConfig | null = null;

const loadEmailConfig = (): EmailConfig => {
  if (emailConfig) return emailConfig;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
    ADMIN_EMAIL,
    NODE_ENV,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    if (NODE_ENV === "production") {
      throw new Error("Missing required SMTP/Email environment variables");
    }
  }

  const config: EmailConfig = {
    host: SMTP_HOST || "localhost",
    port: Number(SMTP_PORT) || 1025,
    secure: SMTP_SECURE === "true",
    authUser: SMTP_USER || "",
    authPass: SMTP_PASS || "",
    fromAddress: EMAIL_FROM || "no-reply@example.com",
    adminAddress: ADMIN_EMAIL || EMAIL_FROM || "admin@example.com",
  };

  emailConfig = config;
  return config;
};

const createTransporter = (): Transporter => {
  if (transporter) return transporter;

  const config = loadEmailConfig();

  const options: SMTPTransport.Options = {
    host: config.host,
    port: config.port,
    secure: config.secure,
  };

  if (config.authUser && config.authPass) {
    options.auth = {
      user: config.authUser,
      pass: config.authPass,
    };
  }

  transporter = nodemailer.createTransport(options);
  return transporter;
};

const formatCurrency = (amount: number): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  } catch {
    return `$undefined`;
  }
};

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const buildOrderItemsTable = (items: OrderItem[]): string => {
  if (!items.length) {
    return "<p>No items found in this order.</p>";
  }

  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">undefined</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">undefined</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">undefined</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">undefined</td>
        </tr>
      `
    )
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 16px;">
      <thead>
        <tr>
          <th align="left" style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">Item</th>
          <th align="center" style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">Qty</th>
          <th align="right" style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">Price</th>
          <th align="right" style="padding: 8px; border: 1px solid #ddd; background-color: #f5f5f5;">Total</th>
        </tr>
      </thead>
      <tbody>
        undefined
      </tbody>
    </table>
  `;
};

const buildBaseHtml = (content: string, title: string): string => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <title>undefined</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color:#f4f4f4;">
      <table cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center" style="padding: 24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
              <tr>
                <td style="padding: 16px 24px; background-color:#111827; color:#ffffff; font-size: 18px; font-weight: 600;">
                  undefined
                </td>
              </tr>
              <tr>
                <td style="padding: 24px;">
                  undefined
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 24px; font-size: 12px; color:#6b7280; border-top: 1px solid #e5e7eb; text-align:center;">
                  This is an automated message, please do not reply directly to this email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

const buildOrderConfirmationHtml = (order: OrderDetails): string => {
  const created =
    typeof order.createdAt === "string"
      ? new Date(order.createdAt)
      : order.createdAt;

  const content = `
    <p style="margin: 0 0 16px 0;">Hi undefined,</p>
    <p style="margin: 0 0 16px 0;">
      Thank you for your order. Your order ID is <strong>undefined</strong>.
    </p>
    <p style="margin: 0 0 16px 0;">
      <strong>Order Date:</strong> undefined
    </p>
    undefined
    <p style="margin: 16px 0 0 0; font-size: 16px;">
      <strong>Order Total: undefined</strong>
    </p>
    undefined</p>`
        : ""
    }
    <p style="margin: 24px 0 0 0;">
      If you have any questions about your order, please contact our support team.
    </p>
  `;

  return buildBaseHtml(content, "Your Order Confirmation");
};

const buildAdminNotificationHtml = (order: OrderDetails): string => {
  const created =
    typeof order.createdAt === "string"
      ? new Date(order.createdAt)
      : order.createdAt;

  const content = `
    <p style="margin: 0 0 16px 0;">
      A new order has been placed.
    </p>
    <p style="margin: 0 0 8px 0;">
      <strong>Order ID:</strong> undefined<br />
      <strong>Customer:</strong> undefined (undefined)<br />
      <strong>Date:</strong> undefined<br />
      <strong>Total:</strong> undefined
    </p>
    ${
      order.notes
        ? `<p style="margin: 8px 0;"><strong>Customer Notes:</strong> ${escapeHtml