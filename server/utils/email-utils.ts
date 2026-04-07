import sgMail from "@sendgrid/mail";

// Initialize SendGrid if API key is available
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@e-code.dev";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Send email using SendGrid or log to console
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.log("📧 Email (SendGrid not configured):");
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Text: ${options.text}`);
    console.log("---");
    return true;
  }

  try {
    const msg = {
      to: options.to,
      from: FROM_EMAIL,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };
    
    await sgMail.send(msg);
    console.log(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

// Send email verification email
export async function sendVerificationEmail(email: string, username: string, token: string): Promise<boolean> {
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;
  
  const subject = "Verify your E-Code account";
  const text = `Hi ${username},\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.\n\nBest regards,\nThe E-Code Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to E-Code!</h2>
      <p>Hi ${username},</p>
      <p>Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">Best regards,<br>The E-Code Team</p>
    </div>
  `;
  
  return await sendEmail({ to: email, subject, text, html });
}

// Send password reset email
export async function sendPasswordResetEmail(email: string, username: string, token: string): Promise<boolean> {
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;
  
  const subject = "Reset your E-Code password";
  const text = `Hi ${username},\n\nWe received a request to reset your password. Click the link below to reset it:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, please ignore this email. Your password won't be changed.\n\nBest regards,\nThe E-Code Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>Hi ${username},</p>
      <p>We received a request to reset your password. Click the button below to reset it:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background-color: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666;">${resetUrl}</p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request a password reset, please ignore this email. Your password won't be changed.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">Best regards,<br>The E-Code Team</p>
    </div>
  `;
  
  return await sendEmail({ to: email, subject, text, html });
}

// Send account locked notification
export async function sendAccountLockedEmail(email: string, username: string, unlockTime: Date): Promise<boolean> {
  const subject = "Your E-Code account has been temporarily locked";
  const text = `Hi ${username},\n\nYour account has been temporarily locked due to multiple failed login attempts.\n\nYour account will be automatically unlocked at: ${unlockTime.toLocaleString()}\n\nIf this wasn't you, please contact support immediately.\n\nBest regards,\nThe E-Code Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Account Security Alert</h2>
      <p>Hi ${username},</p>
      <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
      <p><strong>Your account will be automatically unlocked at:</strong><br>${unlockTime.toLocaleString()}</p>
      <p>If this wasn't you, please contact our support team immediately.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      <p style="color: #666; font-size: 14px;">Best regards,<br>The E-Code Team</p>
    </div>
  `;
  
  return await sendEmail({ to: email, subject, text, html });
}