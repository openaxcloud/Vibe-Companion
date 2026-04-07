import nodemailer, { Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  authUser: string;
  authPass: string;
  fromAddress: string;
  fromName?: string;
  adminNotificationAddress: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderDetails {
  orderId: string;
  userEmail: string;
  userName?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  createdAt: Date;
  notes?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: Error;
}

const DEFAULT_FROM_NAME = 'Shop';

const config: EmailServiceConfig = {
  host: process.env.EMAIL_HOST || '',
  port: Number(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  authUser: process.env.EMAIL_USER || '',
  authPass: process.env.EMAIL_PASS || '',
  fromAddress: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  fromName: process.env.EMAIL_FROM_NAME || DEFAULT_FROM_NAME,
  adminNotificationAddress:
    process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_USER || '',
};

let transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

const createTransporter = (): Transporter<SMTPTransport.SentMessageInfo> => {
  if (transporter) return transporter;

  if (!config.host || !config.authUser || !config.authPass || !config.fromAddress) {
    throw new Error('Email configuration is incomplete. Please check environment variables.');
  }

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.authUser,
      pass: config.authPass,
    },
  });

  return transporter;
};

const formatCurrency = (amount: number): string => {
  if (Number.isNaN(amount)) return '0.00';
  return amount.toFixed(2);
};

const formatDate = (date: Date): string => {
  return date.toISOString().replace('T', ' ').slice(0, 19);
};

const buildOrderItemsText = (items: OrderItem[]): string => {
  if (!items || items.length === 0) return 'No items.';

  return items
    .map(
      (item, index) =>
        `undefined. undefined (xundefined) - $undefined`
    )
    .join('\n');
};

const buildShippingAddressText = (
  address: OrderDetails['shippingAddress']
): string => {
  if (!address) return 'N/A';

  const parts: string[] = [address.line1];

  if (address.line2) parts.push(address.line2);
  const cityLine = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .join(', ');
  if (cityLine) parts.push(cityLine);
  parts.push(address.country);

  return parts.join('\n');
};

const buildOrderSummaryText = (order: OrderDetails): string => {
  return [
    `Order ID: undefined`,
    `Order Date: undefined`,
    '',
    'Items:',
    buildOrderItemsText(order.items),
    '',
    `Subtotal: $undefined`,
    `Tax: $undefined`,
    `Total: $undefined`,
    '',
    'Shipping Address:',
    buildShippingAddressText(order.shippingAddress),
    '',
    `Notes: undefined`,
  ].join('\n');
};

const buildOrderConfirmationSubject = (order: OrderDetails): string => {
  return `Order Confirmation - undefined`;
};

const buildOrderConfirmationText = (order: OrderDetails): string => {
  const greetingName = order.userName || 'Customer';

  return [
    `Hello undefined,`,
    '',
    'Thank you for your order! Your order has been received and is being processed.',
    '',
    buildOrderSummaryText(order),
    '',
    'If you have any questions, simply reply to this email.',
    '',
    'Best regards,',
    config.fromName || DEFAULT_FROM_NAME,
  ].join('\n');
};

const buildAdminNotificationSubject = (order: OrderDetails): string => {
  return `New Order Received - undefined`;
};

const buildAdminNotificationText = (order: OrderDetails): string => {
  return [
    'A new order has been placed.',
    '',
    `Customer: undefined (undefined)`,
    '',
    buildOrderSummaryText(order),
  ].join('\n');
};

export const sendOrderConfirmationEmail = async (
  order: OrderDetails
): Promise<EmailSendResult> => {
  try {
    const mailTransporter = createTransporter();

    const subject = buildOrderConfirmationSubject(order);
    const text = buildOrderConfirmationText(order);

    const fromName = config.fromName || DEFAULT_FROM_NAME;
    const from = `"undefined" <undefined>`;

    const info = await mailTransporter.sendMail({
      from,
      to: order.userEmail,
      subject,
      text,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to send order confirmation email');
    return {
      success: false,
      error: err,
    };
  }
};

export const sendAdminOrderNotificationEmail = async (
  order: OrderDetails
): Promise<EmailSendResult> => {
  try {
    const mailTransporter = createTransporter();

    const subject = buildAdminNotificationSubject(order);
    const text = buildAdminNotificationText(order);

    const fromName = config.fromName || DEFAULT_FROM_NAME;
    const from = `"undefined" <undefined>`;

    const info = await mailTransporter.sendMail({
      from,
      to: config.adminNotificationAddress,
      subject,
      text,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to send admin order notification email');
    return {
      success: false,
      error: err,
    };
  }
};

export const sendTestEmail = async (to: string): Promise<EmailSendResult> => {
  try {
    const mailTransporter = createTransporter();

    const fromName = config.fromName || DEFAULT_FROM_NAME;
    const from = `"undefined" <undefined>`;

    const info = await mailTransporter.sendMail({
      from,
      to,
      subject: 'Test Email',
      text: 'This is a test email to verify the email service configuration.',
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Failed to send test email');
    return {
      success: false,
      error: err,
    };
  }
};

export const getEmailServiceConfig = (): EmailServiceConfig => ({ ...config });