// @ts-nocheck
/**
 * Real Email Service
 * Provides actual email sending capabilities
 */

import * as nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import { createLogger } from '../utils/logger';
import { storage } from '../storage';

const logger = createLogger('real-email-service');

export interface EmailConfig {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
  template?: string;
  templateData?: Record<string, any>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider: string;
}

export class RealEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private sendgridEnabled: boolean = false;
  private templates: Map<string, string> = new Map();

  constructor() {
    this.initialize();
    this.loadTemplates();
  }

  private initialize() {
    // Initialize SendGrid if API key is available
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      this.sendgridEnabled = true;
      logger.info('SendGrid email service initialized');
    }

    // Initialize SMTP transporter as fallback or primary
    if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify transporter connection
      this.transporter.verify((error) => {
        if (error) {
          logger.error(`SMTP connection failed: ${error}`);
        } else {
          logger.info('SMTP email service ready');
        }
      });
    }

    // Use Gmail if credentials provided
    if (!this.transporter && process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS
        }
      });
      logger.info('Gmail email service initialized');
    }
  }

  private loadTemplates() {
    // Welcome email template
    this.templates.set('welcome', `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4ECDC4; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f4f4f4; }
    .button { display: inline-block; padding: 10px 20px; background: #4ECDC4; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to E-Code!</h1>
    </div>
    <div class="content">
      <h2>Hello {{username}}!</h2>
      <p>Thank you for joining E-Code. We're excited to have you on board!</p>
      <p>Get started by creating your first project:</p>
      <p><a href="{{projectUrl}}" class="button">Create Project</a></p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
      <p>Happy coding!</p>
    </div>
  </div>
</body>
</html>
    `);

    // Password reset template
    this.templates.set('password-reset', `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #FF6B6B; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f4f4f4; }
    .button { display: inline-block; padding: 10px 20px; background: #FF6B6B; color: white; text-decoration: none; border-radius: 5px; }
    .code { background: #fff; padding: 15px; font-size: 24px; text-align: center; margin: 20px 0; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>
    <div class="content">
      <h2>Hello {{username}},</h2>
      <p>We received a request to reset your password. Use the following code to reset your password:</p>
      <div class="code">{{resetCode}}</div>
      <p>Or click the button below:</p>
      <p><a href="{{resetUrl}}" class="button">Reset Password</a></p>
      <p>This code will expire in 1 hour. If you didn't request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>
    `);

    // 2FA code template
    this.templates.set('2fa-code', `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #45B7D1; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f4f4f4; }
    .code { background: #fff; padding: 20px; font-size: 32px; text-align: center; margin: 20px 0; font-family: monospace; letter-spacing: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Verification Code</h1>
    </div>
    <div class="content">
      <p>Your E-Code verification code is:</p>
      <div class="code">{{code}}</div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this code, please secure your account immediately.</p>
    </div>
  </div>
</body>
</html>
    `);

    // Deployment notification template
    this.templates.set('deployment-success', `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2ECC71; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f4f4f4; }
    .details { background: #fff; padding: 15px; margin: 15px 0; border-left: 4px solid #2ECC71; }
    .button { display: inline-block; padding: 10px 20px; background: #2ECC71; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Deployment Successful! 🚀</h1>
    </div>
    <div class="content">
      <h2>{{projectName}} is now live!</h2>
      <div class="details">
        <p><strong>Deployment ID:</strong> {{deploymentId}}</p>
        <p><strong>URL:</strong> <a href="{{url}}">{{url}}</a></p>
        <p><strong>Region:</strong> {{region}}</p>
        <p><strong>Time:</strong> {{deploymentTime}}</p>
      </div>
      <p><a href="{{url}}" class="button">View Your App</a></p>
    </div>
  </div>
</body>
</html>
    `);
  }

  private async sendWithRetry(
    sendFn: () => Promise<EmailResult>,
    maxAttempts: number = 3,
    baseDelayMs: number = 1000
  ): Promise<EmailResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await sendFn();
        if (result.success) {
          return result;
        }
        lastError = new Error(result.error || 'Send failed');
      } catch (error: any) {
        lastError = error;
        logger.warn(`Email send attempt ${attempt}/${maxAttempts} failed: ${error.message}`);
      }
      
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        logger.info(`Retrying email send in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError || new Error('Email send failed after all retries');
  }

  async sendEmail(config: EmailConfig): Promise<EmailResult> {
    try {
      // Apply template if specified
      if (config.template && this.templates.has(config.template)) {
        const template = this.templates.get(config.template)!;
        config.html = this.applyTemplate(template, config.templateData || {});
      }

      // Set default from address
      if (!config.from) {
        config.from = process.env.EMAIL_FROM || 'noreply@e-code.ai';
      }

      // Try SendGrid first with exponential backoff retry
      if (this.sendgridEnabled) {
        return await this.sendWithRetry(() => this.sendWithSendGrid(config));
      }

      // Fallback to SMTP with exponential backoff retry
      if (this.transporter) {
        return await this.sendWithRetry(() => this.sendWithSMTP(config));
      }

      throw new Error('No email service configured');

    } catch (error: any) {
      logger.error(`Failed to send email after retries: ${error}`);
      return {
        success: false,
        error: error.message,
        provider: 'none'
      };
    }
  }

  private async sendWithSendGrid(config: EmailConfig): Promise<EmailResult> {
    try {
      const msg = {
        to: config.to,
        from: config.from!,
        subject: config.subject,
        text: config.text,
        html: config.html,
        replyTo: config.replyTo,
        attachments: config.attachments?.map(a => ({
          content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
          filename: a.filename,
          type: a.contentType,
          disposition: 'attachment'
        }))
      };

      const response = await sgMail.send(msg);
      
      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        provider: 'sendgrid'
      };

    } catch (error) {
      logger.error(`SendGrid error: ${error}`);
      throw error;
    }
  }

  private async sendWithSMTP(config: EmailConfig): Promise<EmailResult> {
    if (!this.transporter) {
      throw new Error('SMTP transporter not configured');
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.from,
        to: Array.isArray(config.to) ? config.to.join(', ') : config.to,
        subject: config.subject,
        text: config.text,
        html: config.html,
        replyTo: config.replyTo,
        attachments: config.attachments?.map(a => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType
        }))
      });

      return {
        success: true,
        messageId: info.messageId,
        provider: 'smtp'
      };

    } catch (error) {
      logger.error(`SMTP error: ${error}`);
      throw error;
    }
  }

  private applyTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    
    // Replace template variables
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, String(value));
    }
    
    return result;
  }

  // Specialized email methods

  async sendWelcomeEmail(userId: number): Promise<EmailResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to E-Code!',
      template: 'welcome',
      templateData: {
        username: user.username,
        projectUrl: `${process.env.FRONTEND_URL || 'https://e-code.ai'}/projects/new`
      }
    });
  }

  async sendPasswordResetEmail(userId: number, resetToken: string): Promise<EmailResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      template: 'password-reset',
      templateData: {
        username: user.username,
        resetCode: resetToken.substring(0, 6).toUpperCase(),
        resetUrl: `${process.env.FRONTEND_URL || 'https://e-code.ai'}/reset-password?token=${resetToken}`
      }
    });
  }

  async send2FACode(userId: number, code: string): Promise<EmailResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.sendEmail({
      to: user.email,
      subject: 'Your E-Code Verification Code',
      template: '2fa-code',
      templateData: {
        code
      }
    });
  }

  async sendDeploymentNotification(
    userId: number,
    projectName: string,
    deploymentId: string,
    url: string,
    region: string
  ): Promise<EmailResult> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    return this.sendEmail({
      to: user.email,
      subject: `🚀 ${projectName} deployed successfully!`,
      template: 'deployment-success',
      templateData: {
        projectName,
        deploymentId,
        url,
        region,
        deploymentTime: new Date().toLocaleString()
      }
    });
  }

  async sendBulkEmail(
    userIds: number[],
    subject: string,
    content: string
  ): Promise<Array<{ userId: number; result: EmailResult }>> {
    const results: Array<{ userId: number; result: EmailResult }> = [];

    for (const userId of userIds) {
      try {
        const user = await storage.getUser(userId);
        if (!user) continue;

        const result = await this.sendEmail({
          to: user.email,
          subject,
          html: content
        });

        results.push({ userId, result });
      } catch (error) {
        results.push({
          userId,
          result: {
            success: false,
            error: error.message,
            provider: 'none'
          }
        });
      }
    }

    return results;
  }

  // Email verification
  async verifyEmailAddress(email: string): Promise<boolean> {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }

    // In production, you might want to use an email verification service
    // For now, just check format
    return true;
  }
}

export const realEmailService = new RealEmailService();