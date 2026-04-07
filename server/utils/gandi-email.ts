import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Gandi Email Service Configuration
const GANDI_SMTP_HOST = process.env.GANDI_SMTP_HOST || 'mail.gandi.net';
const GANDI_SMTP_PORT = parseInt(process.env.GANDI_SMTP_PORT || '587');
const GANDI_SMTP_USER = process.env.GANDI_SMTP_USER || process.env.GANDI_EMAIL;
const GANDI_SMTP_PASS = process.env.GANDI_SMTP_PASS || process.env.GANDI_PASSWORD;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@e-code.dev';
const FROM_NAME = process.env.FROM_NAME || 'E-Code';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

// Create reusable transporter
let transporter: Transporter | null = null;

// Initialize Gandi transporter
function getTransporter(): Transporter | null {
  if (!GANDI_SMTP_USER || !GANDI_SMTP_PASS) {
    console.log('⚠️  Gandi email not configured - missing GANDI_SMTP_USER or GANDI_SMTP_PASS');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: GANDI_SMTP_HOST,
      port: GANDI_SMTP_PORT,
      secure: GANDI_SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: GANDI_SMTP_USER,
        pass: GANDI_SMTP_PASS,
      },
      // Additional options for better deliverability
      tls: {
        rejectUnauthorized: false, // For development; use true in production
      },
    });
  }

  return transporter;
}

// Email template styling
const emailStyles = `
  <style>
    .email-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
    }
    .email-header {
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .email-logo {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .email-body {
      padding: 40px 30px;
      color: #333333;
      line-height: 1.6;
    }
    .email-button {
      display: inline-block;
      background: linear-gradient(135deg, #ff6b6b 0%, #ff8787 100%);
      color: white;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 30px;
      text-align: center;
      color: #666666;
      font-size: 14px;
    }
    .email-link {
      color: #ff6b6b;
      text-decoration: none;
    }
  </style>
`;

// Base email template
function getEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${emailStyles}
    </head>
    <body style="margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div class="email-container">
        ${content}
      </div>
    </body>
    </html>
  `;
}

// Send email via Gandi
export async function sendGandiEmail(options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('📧 Email (Gandi not configured):');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('---');
    return true; // Return true to not break the flow
  }

  try {
    const info = await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '', // Fallback to empty string
      html: options.html,
    });

    console.log(`✅ Email sent via Gandi: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Gandi email error:', error);
    return false;
  }
}

// Newsletter welcome email
export async function sendNewsletterWelcomeEmail(email: string, confirmationToken: string): Promise<boolean> {
  const confirmUrl = `${BASE_URL}/api/newsletter/confirm?email=${encodeURIComponent(email)}&token=${confirmationToken}`;
  
  const html = getEmailTemplate(`
    <div class="email-header">
      <div class="email-logo">E-Code</div>
      <p style="margin: 0; font-size: 18px;">Welcome to our newsletter!</p>
    </div>
    <div class="email-body">
      <h2 style="color: #333; margin-top: 0;">Thanks for subscribing! 🎉</h2>
      <p>We're excited to have you join our community of creators and innovators.</p>
      <p>Please confirm your email address to start receiving our newsletter with:</p>
      <ul>
        <li>Latest platform updates and features</li>
        <li>Tips and tutorials for better coding</li>
        <li>Community highlights and success stories</li>
        <li>Exclusive offers and early access</li>
      </ul>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmUrl}" class="email-button">Confirm Email Address</a>
      </div>
      <p style="color: #666; font-size: 14px;">Or copy this link: <br>
      <a href="${confirmUrl}" class="email-link" style="word-break: break-all;">${confirmUrl}</a></p>
    </div>
    <div class="email-footer">
      <p>You're receiving this because you subscribed to E-Code newsletter.</p>
      <p>© ${new Date().getFullYear()} E-Code. All rights reserved.</p>
    </div>
  `);

  const text = `Welcome to E-Code Newsletter!

Thanks for subscribing! Please confirm your email address by clicking the link below:

${confirmUrl}

You'll receive:
- Latest platform updates and features
- Tips and tutorials for better coding
- Community highlights and success stories
- Exclusive offers and early access

Best regards,
The E-Code Team`;

  return await sendGandiEmail({
    to: email,
    subject: 'Welcome to E-Code Newsletter - Please Confirm',
    html,
    text,
  });
}

// Newsletter confirmation success email
export async function sendNewsletterConfirmedEmail(email: string): Promise<boolean> {
  const html = getEmailTemplate(`
    <div class="email-header">
      <div class="email-logo">E-Code</div>
      <p style="margin: 0; font-size: 18px;">Email Confirmed!</p>
    </div>
    <div class="email-body">
      <h2 style="color: #333; margin-top: 0;">You're all set! ✅</h2>
      <p>Your email has been confirmed successfully. Welcome to the E-Code newsletter family!</p>
      <p>Here's what you can expect:</p>
      <ul>
        <li><strong>Weekly Updates:</strong> Every Tuesday with platform news</li>
        <li><strong>Monthly Digest:</strong> Best projects and creator spotlights</li>
        <li><strong>Special Announcements:</strong> New features and events</li>
      </ul>
      <p>In the meantime, why not:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${BASE_URL}/projects" class="email-button">Start Creating</a>
      </div>
    </div>
    <div class="email-footer">
      <p>Want to unsubscribe? You can do so at any time from any newsletter email.</p>
      <p>© ${new Date().getFullYear()} E-Code. All rights reserved.</p>
    </div>
  `);

  const text = `Email Confirmed!

Your email has been confirmed successfully. Welcome to the E-Code newsletter family!

Here's what you can expect:
- Weekly Updates: Every Tuesday with platform news
- Monthly Digest: Best projects and creator spotlights
- Special Announcements: New features and events

Start creating at: ${BASE_URL}/projects

Best regards,
The E-Code Team`;

  return await sendGandiEmail({
    to: email,
    subject: 'Welcome to E-Code Newsletter! 🎉',
    html,
    text,
  });
}

// Test Gandi connection
export async function testGandiConnection(): Promise<boolean> {
  const transport = getTransporter();
  
  if (!transport) {
    console.log('❌ Gandi email not configured');
    return false;
  }

  try {
    await transport.verify();
    console.log('✅ Gandi SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ Gandi SMTP connection failed:', error);
    return false;
  }
}