import sgMail from '@sendgrid/mail';
import { z } from 'zod';
import { hashToken } from './auth-utils';
import { securityLogs } from '@shared/schema';
import { db } from '../db';

// Check if running in test/development environment
const isTestEnv = process.env.NODE_ENV === 'test';
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// Warn if missing in production - email features will be disabled but server won't crash
if (isProduction && !SENDGRID_API_KEY) {
  console.warn('[SendGrid] SENDGRID_API_KEY not configured — email verification and password reset emails will be disabled in production.');
}

// Initialize SendGrid if key is available (skip in test mode to prevent 401 errors)
if (SENDGRID_API_KEY && !isTestEnv) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else if (!isTestEnv && !SENDGRID_API_KEY) {
  console.warn('[SendGrid] API key not configured - email functionality disabled');
}

// Configuration
const APP_URL = process.env.APP_URL
  ?? (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000');
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@e-code.ai';
const FROM_NAME = process.env.FROM_NAME || 'E-Code Platform';

// Critical: SendGrid rejects emails if FROM_EMAIL is not a verified Sender Identity.
// To fix: go to https://app.sendgrid.com/settings/sender_auth and verify
// the domain OR the exact email address set in FROM_EMAIL.
if (isProduction && SENDGRID_API_KEY && !process.env.FROM_EMAIL) {
  console.warn(
    '[SendGrid] FROM_EMAIL env var is not set. Defaulting to noreply@e-code.ai — ' +
    'make sure this address is verified in your SendGrid Sender Authentication settings, ' +
    'or set FROM_EMAIL to a verified sender.'
  );
}

// Email templates
const emailTemplates = {
  verification: (displayName: string, token: string) => ({
    subject: 'Verify Your E-Code Account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e5e5; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 25px 0; }
            .button:hover { background: linear-gradient(135deg, #f7931e 0%, #ff6b35 100%); }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 13px; }
            .code-block { background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; margin: 15px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffecb5; color: #856404; padding: 12px; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 E-Code Platform</h1>
            </div>
            <div class="content">
              <h2>Welcome to E-Code, ${displayName}!</h2>
              <p>Thank you for joining E-Code Platform - the future of cloud development. You're just one step away from accessing all our powerful features.</p>
              
              <p>Please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/verify-email?token=${token}" class="button">
                  Verify My Email
                </a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="code-block">
                ${APP_URL}/verify-email?token=${token}
              </div>
              
              <div class="warning">
                ⏰ This verification link will expire in <strong>24 hours</strong>. If it expires, you can request a new one from the login page.
              </div>
              
              <p><strong>What happens next?</strong></p>
              <ul>
                <li>Your account will be fully activated</li>
                <li>You'll get access to all E-Code features</li>
                <li>You can start building amazing projects instantly</li>
              </ul>
              
              <div class="footer">
                <p>If you didn't create an account on E-Code Platform, you can safely ignore this email.</p>
                <p>© ${new Date().getFullYear()} E-Code Platform. All rights reserved.</p>
                <p>Need help? Contact us at support@e-code.ai</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Welcome to E-Code, ${displayName}!

Please verify your email address by visiting:
${APP_URL}/verify-email?token=${token}

This link will expire in 24 hours.

If you didn't create an account on E-Code Platform, you can safely ignore this email.
    `
  }),
  
  passwordReset: (displayName: string, token: string) => ({
    subject: 'Reset Your E-Code Password',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e5e5; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 25px 0; }
            .button:hover { background: linear-gradient(135deg, #f7931e 0%, #ff6b35 100%); }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 13px; }
            .code-block { background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; margin: 15px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffecb5; color: #856404; padding: 12px; border-radius: 5px; margin-top: 20px; }
            .security-notice { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; padding: 12px; border-radius: 5px; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <h2>Hi ${displayName},</h2>
              <p>We received a request to reset your password for your E-Code account. If you made this request, click the button below:</p>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/reset-password?token=${token}" class="button">
                  Reset My Password
                </a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="code-block">
                ${APP_URL}/reset-password?token=${token}
              </div>
              
              <div class="warning">
                ⏰ For security reasons, this link will expire in <strong>2 hours</strong>.
              </div>
              
              <div class="security-notice">
                🔒 <strong>Security Tips:</strong>
                <ul style="margin: 10px 0;">
                  <li>Never share your password with anyone</li>
                  <li>Use a strong, unique password for your E-Code account</li>
                  <li>Enable two-factor authentication for added security</li>
                </ul>
              </div>
              
              <div class="footer">
                <p><strong>Didn't request a password reset?</strong> You can safely ignore this email. Your password won't be changed unless you click the link above and create a new one.</p>
                <p>© ${new Date().getFullYear()} E-Code Platform. All rights reserved.</p>
                <p>Need help? Contact us at support@e-code.ai</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${displayName},

We received a request to reset your password for your E-Code account.

Reset your password by visiting:
${APP_URL}/reset-password?token=${token}

This link will expire in 2 hours.

If you didn't request a password reset, you can safely ignore this email.
    `
  }),

  resendVerification: (displayName: string, token: string) => ({
    subject: 'New Verification Link - E-Code Account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .header h1 { color: white; margin: 0; font-size: 28px; }
            .content { background: white; padding: 30px; border: 1px solid #e5e5e5; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 14px 30px; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; text-decoration: none; border-radius: 5px; font-weight: 600; margin: 25px 0; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #666; font-size: 13px; }
            .code-block { background: #f5f5f5; padding: 10px; border-radius: 5px; word-break: break-all; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 New Verification Link</h1>
            </div>
            <div class="content">
              <h2>Hi ${displayName},</h2>
              <p>You requested a new verification link for your E-Code account. Here's your fresh link:</p>
              
              <div style="text-align: center;">
                <a href="${APP_URL}/verify-email?token=${token}" class="button">
                  Verify My Email
                </a>
              </div>
              
              <p>Or copy and paste this link:</p>
              <div class="code-block">
                ${APP_URL}/verify-email?token=${token}
              </div>
              
              <p><strong>This link expires in 24 hours.</strong></p>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} E-Code Platform. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
Hi ${displayName},

Here's your new verification link:
${APP_URL}/verify-email?token=${token}

This link expires in 24 hours.
    `
  })
};

// Log email event to security logs
async function logEmailEvent(userId: string | null, action: string, email: string, result: 'success' | 'failure', metadata?: any) {
  try {
    const numericUserId = userId ? parseInt(userId, 10) : null;
    await db.insert(securityLogs).values({
      userId: numericUserId,
      ip: '0.0.0.0', // Will be set by the calling endpoint
      action,
      resource: email,
      result,
      userAgent: 'SendGrid Email Service',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to log email event:', error);
  }
}

// Send verification email
export async function sendVerificationEmail(userId: string, email: string, displayName: string, token: string): Promise<void> {
  // Mock email sending in test mode
  if (isTestEnv) {
    console.log('[SendGrid] Test mode - skipping email send');
    return;
  }
  
  if (!SENDGRID_API_KEY) {
    console.warn('[SendGrid] No API key configured - skipping email send');
    return;
  }
  
  const template = emailTemplates.verification(displayName, token);
  
  console.log(`[SendGrid] Attempting to send verification email to ${email} from ${FROM_EMAIL}`);
  
  try {
    const response = await sgMail.send({
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    console.log(`[SendGrid] Verification email sent successfully to ${email}`, response[0]?.statusCode);
    await logEmailEvent(userId, 'email_verification_sent', email, 'success', { type: 'verification' });
  } catch (error: any) {
    // Extract detailed SendGrid error
    const sgError = error?.response?.body?.errors?.[0]?.message || error.message;
    const statusCode = error?.code || error?.response?.statusCode;
    
    console.error(`[SendGrid] Failed to send verification email:`, {
      statusCode,
      message: sgError,
      fromEmail: FROM_EMAIL,
      toEmail: email,
      fullError: JSON.stringify(error?.response?.body || error.message)
    });
    
    await logEmailEvent(userId, 'email_verification_sent', email, 'failure', { 
      error: sgError,
      statusCode,
      type: 'verification' 
    });
    throw new Error(`Failed to send verification email: ${sgError}`);
  }
}

// Send password reset email
export async function sendPasswordResetEmail(userId: string, email: string, displayName: string, token: string): Promise<void> {
  // Mock email sending in test mode
  if (isTestEnv) {
    return;
  }
  
  if (!SENDGRID_API_KEY) {
    return;
  }
  
  const template = emailTemplates.passwordReset(displayName, token);
  
  try {
    await sgMail.send({
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    await logEmailEvent(userId, 'password_reset_sent', email, 'success', { type: 'password_reset' });
  } catch (error: any) {
    await logEmailEvent(userId, 'password_reset_sent', email, 'failure', { 
      error: error.message,
      type: 'password_reset' 
    });
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

// Resend verification email
export async function resendVerificationEmail(userId: string, email: string, displayName: string, token: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    return;
  }
  
  const template = emailTemplates.resendVerification(displayName, token);
  
  try {
    await sgMail.send({
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    await logEmailEvent(userId, 'verification_resent', email, 'success', { type: 'resend_verification' });
  } catch (error: any) {
    await logEmailEvent(userId, 'verification_resent', email, 'failure', { 
      error: error.message,
      type: 'resend_verification' 
    });
    console.error('Failed to resend verification email:', error);
    throw new Error('Failed to resend verification email');
  }
}

// Account locked email
export async function sendAccountLockedEmail(userId: string, email: string, displayName: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    return;
  }
  
  const template = {
    subject: 'Security Alert: Your E-Code Account Has Been Locked',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .alert { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Security Alert</h2>
            <div class="alert">
              <p>Hi ${displayName},</p>
              <p>Your E-Code account has been temporarily locked due to multiple failed login attempts.</p>
              <p><strong>What to do:</strong></p>
              <ul>
                <li>Wait 30 minutes before trying again</li>
                <li>Use the "Forgot Password" option to reset your password</li>
                <li>Contact support if you didn't make these attempts</li>
              </ul>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Security Alert: Your account has been locked due to multiple failed login attempts. Wait 30 minutes or reset your password.`
  };
  
  try {
    await sgMail.send({
      to: email,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    
    await logEmailEvent(userId, 'account_locked_notification', email, 'success', { type: 'security' });
  } catch (error: any) {
    await logEmailEvent(userId, 'account_locked_notification', email, 'failure', { 
      error: error.message,
      type: 'security' 
    });
    console.error('Failed to send account locked email:', error);
  }
}

export async function sendPaymentFailedEmail(userId: string, email: string, displayName: string, amountDue: number, invoiceId: string): Promise<void> {
  if (!SENDGRID_API_KEY || isTestEnv) {
    console.log(`[SendGrid] Payment failed email skipped (${isTestEnv ? 'test env' : 'no API key'}): user=${userId}, amount=$${amountDue.toFixed(2)}`);
    return;
  }

  const template = {
    subject: 'Action Required: Payment Failed for Your E-Code Subscription',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
          <div style="text-align: center; padding: 20px 0;">
            <h1 style="color: #1a1a2e; font-size: 24px; margin-bottom: 8px;">E-Code</h1>
          </div>
          <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; font-size: 20px; margin: 0 0 12px 0;">Payment Failed</h2>
            <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 12px 0;">
              Hi ${displayName},
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 12px 0;">
              We were unable to process your payment of <strong>$${amountDue.toFixed(2)}</strong> for your E-Code subscription.
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px 0;">
              Please update your payment method to avoid any interruption to your service. Your subscription will remain active for a limited time while we retry the payment.
            </p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${APP_URL}/billing" style="display: inline-block; padding: 12px 32px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Update Payment Method</a>
            </div>
            <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0 0;">
              Invoice: ${invoiceId}
            </p>
          </div>
          <div style="text-align: center; padding: 20px 0; color: #9ca3af; font-size: 12px;">
            <p>If you believe this is an error, please contact support.</p>
          </div>
        </body>
      </html>
    `,
    text: `Payment Failed - Hi ${displayName}, we were unable to process your payment of $${amountDue.toFixed(2)} for your E-Code subscription. Please update your payment method at ${APP_URL}/billing to avoid service interruption.`
  };

  try {
    await sgMail.send({
      to: email,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      subject: template.subject,
      html: template.html,
      text: template.text
    });
    await logEmailEvent(userId, 'payment_failed_notification', email, 'success', { amountDue, invoiceId });
  } catch (error: any) {
    await logEmailEvent(userId, 'payment_failed_notification', email, 'failure', { error: error.message, amountDue, invoiceId });
    console.error('Failed to send payment failed email:', error);
  }
}

// Validate email format and check for typos
export function validateEmailTypos(email: string): string | null {
  const commonTypos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmali.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmai.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com'
  };
  
  const domain = email.split('@')[1];
  if (domain && commonTypos[domain]) {
    return email.replace(domain, commonTypos[domain]);
  }
  
  return null;
}

// Check if email is from disposable service
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', '10minutemail.com', 
    'guerrillamail.com', 'mailinator.com', 'maildrop.cc',
    'mintemail.com', 'safetymail.info', 'trashmail.com'
  ];
  
  const domain = email.split('@')[1];
  return disposableDomains.includes(domain);
}