import nodemailer, { Transporter } from "nodemailer";

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  fromDefault?: string;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

let transporter: Transporter | null = null;
let defaultFromAddress: string | undefined;

const isTestOrDevEnv = (): boolean => {
  const env = process.env.NODE_ENV;
  return env === "test" || env === "development" || !env;
};

export const initMailTransporter = (config?: Partial<MailConfig>): void => {
  if (isTestOrDevEnv() && !process.env.SMTP_HOST) {
    transporter = null;
    defaultFromAddress = config?.fromDefault || process.env.MAIL_FROM_DEFAULT;
    return;
  }

  const host = config?.host || process.env.SMTP_HOST;
  const port = config?.port || Number(process.env.SMTP_PORT || 587);
  const secure =
    typeof config?.secure === "boolean"
      ? config.secure
      : process.env.SMTP_SECURE === "true" || port === 465;

  const user = config?.auth?.user || process.env.SMTP_USER;
  const pass = config?.auth?.pass || process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP configuration. Ensure SMTP_HOST, SMTP_USER, and SMTP_PASS are set.");
  }

  defaultFromAddress =
    config?.fromDefault ||
    process.env.MAIL_FROM_DEFAULT ||
    `"No Reply" <undefined>`;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
};

export const sendMail = async (options: MailOptions): Promise<void> => {
  const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;

  if (!transporter) {
    // Fallback: log to console in test/dev or if transporter is not configured
    // This keeps the function non-throwing in non-production by default
    // while still providing visibility into email attempts.
    // In production, you should configure SMTP to avoid silent fallback.
    console.log("[MAIL:FALLBACK] Email not sent (no transporter configured):", {
      to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      from: options.from || defaultFromAddress,
    });
    return;
  }

  const mailOptions = {
    from: options.from || defaultFromAddress,
    to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("[MAIL:ERROR] Failed to send email:", {
      error,
      to,
      subject: options.subject,
    });
    throw error;
  }
};

// Auto-initialize based on environment variables when the module is loaded.
// This allows simple usage without explicit init in many setups.
try {
  initMailTransporter();
} catch (error) {
  console.error("[MAIL:INIT_ERROR] Failed to initialize mail transporter:", error);
}