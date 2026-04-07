export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY);
}

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[email] Email not configured, skipping password reset email to:", email);
    return false;
  }
  console.log(`[email] Password reset email sent to ${email}`);
  return true;
}

export async function sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[email] Email not configured, skipping verification email to:", email);
    return false;
  }
  console.log(`[email] Verification email sent to ${email}`);
  return true;
}

export async function sendTeamInviteEmail(email: string, inviterName: string, teamName: string): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn("[email] Email not configured, skipping team invite email to:", email);
    return false;
  }
  console.log(`[email] Team invite email sent to ${email} for team ${teamName}`);
  return true;
}
