// @ts-ignore
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@e-code.ai";
const APP_URL = process.env.APP_URL || `https://${process.env.APP_DOMAIN || 'e-code.ai'}`;

const smtpConfigured = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: nodemailer.Transporter | null = null;

if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function log(msg: string) {
  const ts = new Date().toLocaleTimeString();
  console.log(`${ts} [email] ${msg}`);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (transporter) {
    try {
      await transporter.sendMail({ from: EMAIL_FROM, to, subject, html });
      log(`Sent "${subject}" to ${to}`);
      return true;
    } catch (err: any) {
      log(`Failed to send "${subject}" to ${to}: ${err.message}`);
      return false;
    }
  }
  log(`Email delivery not configured (SMTP_HOST, SMTP_USER, SMTP_PASS required). Cannot send "${subject}" to ${to}`);
  return false;
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  log(`Password reset link for ${email}: ${resetUrl}`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #F26522; border-radius: 8px; margin-bottom: 12px;"></div>
        <h1 style="font-size: 20px; color: #1a1a1a; margin: 0;">E-Code</h1>
      </div>
      <h2 style="font-size: 18px; color: #1a1a1a;">Reset Your Password</h2>
      <p style="color: #555; line-height: 1.6;">We received a request to reset your password. Click the button below to set a new password. This link expires in 1 hour.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #0079F2; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset Password</a>
      </div>
      <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px; text-align: center;">E-Code &mdash; Build, run, and deploy code from anywhere</p>
    </div>
  `;

  return sendEmail(email, "Reset your E-Code password", html);
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  log(`Verification link for ${email}: ${verifyUrl}`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #F26522; border-radius: 8px; margin-bottom: 12px;"></div>
        <h1 style="font-size: 20px; color: #1a1a1a; margin: 0;">E-Code</h1>
      </div>
      <h2 style="font-size: 18px; color: #1a1a1a;">Verify Your Email</h2>
      <p style="color: #555; line-height: 1.6;">Please verify your email address to unlock all features. Click the button below to confirm your email. This link expires in 24 hours.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: #0CCE6B; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Verify Email</a>
      </div>
      <p style="color: #888; font-size: 13px;">If you didn't create this account, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px; text-align: center;">E-Code &mdash; Build, run, and deploy code from anywhere</p>
    </div>
  `;

  return sendEmail(email, "Verify your E-Code email", html);
}

export async function sendTeamInviteEmail(email: string, teamName: string, inviterName: string, token: string): Promise<boolean> {
  const inviteUrl = `${APP_URL}/teams?invite=${token}`;
  log(`Team invite link for ${email}: ${inviteUrl}`);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; width: 40px; height: 40px; background: #F26522; border-radius: 8px; margin-bottom: 12px;"></div>
        <h1 style="font-size: 20px; color: #1a1a1a; margin: 0;">E-Code</h1>
      </div>
      <h2 style="font-size: 18px; color: #1a1a1a;">You're Invited!</h2>
      <p style="color: #555; line-height: 1.6;"><strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on E-Code.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}" style="display: inline-block; padding: 12px 32px; background: #7C65CB; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Accept Invitation</a>
      </div>
      <p style="color: #888; font-size: 13px;">This invitation will expire in 7 days.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #aaa; font-size: 12px; text-align: center;">E-Code &mdash; Build, run, and deploy code from anywhere</p>
    </div>
  `;

  return sendEmail(email, `Join ${teamName} on E-Code`, html);
}

export function isEmailConfigured(): boolean {
  return smtpConfigured;
}
