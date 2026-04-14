import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
})

export interface EmailTemplate {
  to: string
  subject: string
  html: string
}

export const sendEmail = async ({ to, subject, html }: EmailTemplate) => {
  try {
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject,
      html,
    })
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

export const emailTemplates = {
  welcome: (name: string) => ({
    subject: `Welcome to ${process.env.APP_NAME}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3b82f6;">Welcome to ${process.env.APP_NAME}!</h1>
        <p>Hi ${name},</p>
        <p>Thank you for signing up! We're excited to have you on board.</p>
        <p>Here's what you can do next:</p>
        <ul>
          <li>Complete your profile setup</li>
          <li>Explore our features</li>
          <li>Invite team members</li>
          <li>Set up your first project</li>
        </ul>
        <a href="${process.env.NEXTAUTH_URL}/dashboard" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Get Started
        </a>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Best regards,<br>The ${process.env.APP_NAME} Team</p>
      </div>
    `,
  }),

  teamInvitation: (teamName: string, inviterName: string, inviteLink: string) => ({
    subject: `You've been invited to join ${teamName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3b82f6;">Team Invitation</h1>
        <p>${inviterName} has invited you to join the team "${teamName}" on ${process.env.APP_NAME}.</p>
        <a href="${inviteLink}" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Accept Invitation
        </a>
        <p>This invitation will expire in 7 days.</p>
        <p>If you don't want to join this team, you can safely ignore this email.</p>
      </div>
    `,
  }),

  subscriptionConfirmation: (planName: string, amount: number) => ({
    subject: 'Subscription Confirmed',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3b82f6;">Subscription Confirmed</h1>
        <p>Thank you for subscribing to the ${planName} plan!</p>
        <p>Amount: $${amount}/month</p>
        <p>Your subscription is now active and you have full access to all ${planName} features.</p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/billing" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Manage Subscription
        </a>
      </div>
    `,
  }),

  usageAlert: (feature: string, usage: number, limit: number) => ({
    subject: 'Usage Alert - Approaching Limit',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Usage Alert</h1>
        <p>You're approaching your ${feature} limit.</p>
        <p>Current usage: ${usage} / ${limit}</p>
        <p>Consider upgrading your plan to avoid service interruption.</p>
        <a href="${process.env.NEXTAUTH_URL}/dashboard/billing" 
           style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">
          Upgrade Plan
        </a>
      </div>
    `,
  }),
}