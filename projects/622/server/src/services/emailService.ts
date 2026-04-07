import nodemailer, { Transporter } from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import dotenv from "dotenv";

dotenv.config();

export interface OrderItem {
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface OrderCustomerInfo {
  firstName?: string;
  lastName?: string;
  email: string;
}

export interface OrderAddress {
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
}

export interface OrderConfirmationEmailDTO {
  to: string;
  orderId: string;
  orderDate: string | Date;
  customer: OrderCustomerInfo;
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  discount?: number;
  total: number;
  currency: string;
  shippingAddress?: OrderAddress;
  billingAddress?: OrderAddress;
  supportEmail?: string;
  supportUrl?: string;
}

export interface ShippingUpdateEmailDTO {
  to: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  estimatedDeliveryDate?: string | Date;
  trackingUrl?: string;
  customer: OrderCustomerInfo;
  items?: OrderItem[];
  supportEmail?: string;
  supportUrl?: string;
}

export interface GenericEmailDTO {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface EmailServiceConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromAddress: string;
  fromName?: string;
}

const DEFAULT_SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@example.com";
const DEFAULT_SUPPORT_URL = process.env.SUPPORT_URL || "https://example.com/support";

const emailConfig: EmailServiceConfig = {
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "",
  fromAddress: process.env.EMAIL_FROM || "no-reply@example.com",
  fromName: process.env.EMAIL_FROM_NAME || "Customer Service",
};

let transporter: Transporter<SMTPTransport.SentMessageInfo> | null = null;

function getTransporter(): Transporter<SMTPTransport.SentMessageInfo> {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.user,
        pass: emailConfig.pass,
      },
    });
  }
  return transporter;
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `undefined undefined`;
  }
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return String(date);
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function sanitizeText(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function buildAddressBlock(address?: OrderAddress): string {
  if (!address) return "";
  const parts: string[] = [];
  parts.push(sanitizeText(address.line1));
  if (address.line2) parts.push(sanitizeText(address.line2));
  const cityLine = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .map(sanitizeText)
    .join(", ");
  if (cityLine) parts.push(cityLine);
  parts.push(sanitizeText(address.country));
  return parts.filter(Boolean).join("<br />");
}

function buildPlainAddress(address?: OrderAddress): string {
  if (!address) return "";
  const parts: string[] = [];
  parts.push(sanitizeText(address.line1));
  if (address.line2) parts.push(sanitizeText(address.line2));
  const cityLine = [address.city, address.state, address.postalCode]
    .filter(Boolean)
    .map(sanitizeText)
    .join(", ");
  if (cityLine) parts.push(cityLine);
  parts.push(sanitizeText(address.country));
  return parts.filter(Boolean).join("\n");
}

function getFromHeader(): string {
  const name = sanitizeText(emailConfig.fromName || "");
  if (!name) return emailConfig.fromAddress;
  return `"undefined" <undefined>`;
}

function buildOrderConfirmationSubject(orderId: string): string {
  return `Order Confirmation - undefined`;
}

function buildShippingUpdateSubject(orderId: string): string {
  return `Shipping Update - Order undefined`;
}

function buildOrderConfirmationHtml(dto: OrderConfirmationEmailDTO): string {
  const {
    orderId,
    orderDate,
    customer,
    items,
    subtotal,
    tax,
    shipping,
    discount,
    total,
    currency,
    shippingAddress,
    billingAddress,
  } = dto;

  const supportEmail = dto.supportEmail || DEFAULT_SUPPORT_EMAIL;
  const supportUrl = dto.supportUrl || DEFAULT_SUPPORT_URL;

  const itemRows = items
    .map((item) => {
      const totalPrice = item.unitPrice * item.quantity;
      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            <div style="font-size:14px;font-weight:500;color:#333;">undefined</div>
            undefined</div>`
                : ""
            }
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;font-size:14px;color:#555;">undefined</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#555;">undefined</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#333;font-weight:500;">undefined</td>
        </tr>
      `;
    })
    .join("");

  const shippingBlock = buildAddressBlock(shippingAddress);
  const billingBlock = buildAddressBlock(billingAddress);

  const orderDateStr = formatDate(orderDate);

  const taxRow =
    typeof tax === "number"
      ? `<tr>
           <td colspan="3" style="padding:4px 0;text-align:right;font-size:13px;color:#555;">Tax</td>
           <td style="padding:4px 0;text-align:right;font-size:13px;color:#555;">undefined</td>
         </tr>`
      : "";

  const shippingRow =
    typeof shipping === "number"
      ? `<tr>
           <td colspan="3" style="padding:4px 0;text-align:right;font-size:13px;color:#555;">Shipping</td>
           <td style="padding:4px 0;text-align:right;font-size:13px;color:#555;">undefined</td>
         </tr>`
      : "";

  const discountRow =
    typeof discount === "number" && discount !== 0
      ? `<tr>
           <td colspan="3" style="padding:4px 0;text-align:right;font-size:13px;color:#555;">Discount</td>
           <td style="padding:4px 0;text-align:right;font-size:13px;color:#d32f2f;">-undefined</td>
         </tr>`
      : "";

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charSet="UTF-8" />
    <title>Order Confirmation</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table width="100%" border="0" cellPadding="0" cellSpacing="0" style="max-width:640px;background