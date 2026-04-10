// @ts-nocheck
import nodemailer from 'nodemailer';
import { z } from 'zod';

// Email configuration - requires explicit SMTP config in production
const emailConfig = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

// Validate SMTP config availability
const isEmailConfigured = !!(
  process.env.SMTP_HOST && 
  process.env.SMTP_USER && 
  process.env.SMTP_PASS
);

// Create transporter only if properly configured
const transporter = isEmailConfigured ? nodemailer.createTransport(emailConfig) : null;

if (!isEmailConfigured && process.env.NODE_ENV === 'production') {
  console.warn('[Email] SMTP not configured - email sending disabled. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
}

// Email templates
const emailTemplates = {
  verification: (token: string) => ({
    subject: 'Verify your E-Code account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ff6b35;">Welcome to E-Code!</h1>
        <p>Thanks for signing up. Please verify your email address by clicking the link below:</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/verify-email?token=${token}" 
           style="display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${process.env.APP_URL || 'http://localhost:5000'}/verify-email?token=${token}</p>
        <p>This link will expire in 24 hours.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">If you didn't create an account on E-Code, you can safely ignore this email.</p>
      </div>
    `
  }),
  
  passwordReset: (token: string) => ({
    subject: 'Reset your E-Code password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ff6b35;">Password Reset Request</h1>
        <p>We received a request to reset your password. Click the link below to set a new password:</p>
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}" 
           style="display: inline-block; padding: 12px 24px; background-color: #ff6b35; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all;">${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${token}</p>
        <p>This link will expire in 1 hour.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `
  }),
  
  accountLocked: () => ({
    subject: 'Your E-Code account has been locked',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #ff6b35;">Account Security Alert</h1>
        <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
        <p>To unlock your account, please:</p>
        <ol>
          <li>Wait 30 minutes before trying to log in again</li>
          <li>Or reset your password using the "Forgot Password" link</li>
        </ol>
        <p>If you didn't attempt to log in, please contact our support team immediately.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px;">This is an automated security message from E-Code.</p>
      </div>
    `
  })
};

// Send verification email
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  if (!transporter) {
    return;
  }
  
  const template = emailTemplates.verification(token);
  await transporter.sendMail({
    from: `"E-Code" <${emailConfig.auth.user}>`,
    to: email,
    subject: template.subject,
    html: template.html
  });
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, token: string): Promise<void> {
  if (!transporter) {
    return;
  }
  
  const template = emailTemplates.passwordReset(token);
  await transporter.sendMail({
    from: `"E-Code" <${emailConfig.auth.user}>`,
    to: email,
    subject: template.subject,
    html: template.html
  });
}

// Send account locked email
export async function sendAccountLockedEmail(email: string): Promise<void> {
  if (!transporter) {
    return;
  }
  
  const template = emailTemplates.accountLocked();
  await transporter.sendMail({
    from: `"E-Code" <${emailConfig.auth.user}>`,
    to: email,
    subject: template.subject,
    html: template.html
  });
}

// Validate email for common typos
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

// Check if email is from a disposable email service
export function isDisposableEmail(email: string): boolean {
  const disposableDomains = [
    'tempmail.com', 'throwaway.email', '10minutemail.com', 
    'guerrillamail.com', 'mailinator.com', 'maildrop.cc',
    'mintemail.com', 'safetymail.info', 'trashmail.com'
  ];
  
  const domain = email.split('@')[1];
  return disposableDomains.includes(domain);
}