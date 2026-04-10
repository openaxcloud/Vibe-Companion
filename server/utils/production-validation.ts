/**
 * Production Environment Validation Module
 * 
 * Runs at startup to ensure all critical dependencies and environment 
 * variables are correctly configured before the server starts accepting traffic.
 * 
 * In production: Fails fast with a descriptive list of missing/invalid variables.
 * In development: Logs warnings but allows the server to start.
 */

import { createCentralizedLogger } from '../logging/centralized-logger';

const logger = createCentralizedLogger('env-validation');

const REQUIRED_IN_PRODUCTION: Array<{ key: string; description: string; validate?: (v: string) => string | null }> = [
  { key: 'DATABASE_URL', description: 'PostgreSQL connection string' },
  { key: 'SESSION_SECRET', description: 'Express session encryption key', validate: (v) => v.length < 32 ? 'Must be at least 32 characters' : null },
  { key: 'JWT_SECRET', description: 'JWT signing secret' },
  { key: 'ENCRYPTION_KEY', description: 'Data encryption key' },
  { key: 'REDIS_URL', description: 'Redis connection URL (required when REDIS_ENABLED=true)', validate: () => {
    if (process.env.REDIS_ENABLED === 'true' && !process.env.REDIS_URL) return 'REDIS_ENABLED=true but REDIS_URL is missing';
    return null;
  }},
];

const RECOMMENDED_IN_PRODUCTION: Array<{ key: string; description: string }> = [
  { key: 'JWT_REFRESH_SECRET', description: 'JWT refresh token secret' },
  { key: 'SENTRY_DSN', description: 'Sentry error tracking DSN' },
  { key: 'STRIPE_SECRET_KEY', description: 'Stripe payments API key' },
  { key: 'SENDGRID_API_KEY', description: 'SendGrid email API key' },
  {
    key: 'FROM_EMAIL',
    description: 'Verified sender address for transactional emails (SendGrid Sender Authentication). ' +
      'Defaults to noreply@e-code.ai — verify this domain at https://app.sendgrid.com/settings/sender_auth ' +
      'or set FROM_EMAIL to an already-verified address, otherwise all emails will be rejected.'
  },
  { key: 'ALLOWED_ORIGINS', description: 'CORS allowed origins' },
  { key: 'APP_URL', description: 'Public application URL' },
  { key: 'RUNNER_JWT_SECRET', description: 'Shared secret for runner microservice auth' },
];

export function validateProductionEnvironment(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const isReplit = !!(process.env.REPL_ID || process.env.REPL_SLUG);
  const errors: string[] = [];
  const warnings: string[] = [];

  logger.info(`Starting environment validation (mode: ${process.env.NODE_ENV || 'development'})`);

  // Map RUNNER_URL alias early so subsequent checks see it
  if (process.env.RUNNER_URL && !process.env.RUNNER_BASE_URL) {
    process.env.RUNNER_BASE_URL = process.env.RUNNER_URL;
    logger.info('RUNNER_URL mapped to RUNNER_BASE_URL');
  }

  if (!process.env.NODE_ENV) {
    warnings.push('NODE_ENV is not set. Defaulting to development.');
  }

  // Validate all required production variables
  for (const { key, description, validate } of REQUIRED_IN_PRODUCTION) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      // Special case: REDIS_URL is only required when REDIS_ENABLED=true
      if (key === 'REDIS_URL' && process.env.REDIS_ENABLED !== 'true') continue;

      if (isProduction && !isReplit) {
        errors.push(`${key} is missing — ${description}`);
      } else if (isProduction && isReplit) {
        warnings.push(`${key} is missing — ${description} (auto-generated fallback on Replit)`);
      } else {
        warnings.push(`${key} is missing — ${description}`);
      }
    } else if (validate) {
      const validationError = validate(value);
      if (validationError) {
        if (isProduction) {
          errors.push(`${key}: ${validationError}`);
        } else {
          warnings.push(`${key}: ${validationError}`);
        }
      }
    }
  }

  // Warn about recommended-but-missing variables
  for (const { key, description } of RECOMMENDED_IN_PRODUCTION) {
    if (!process.env[key]) {
      warnings.push(`${key} is not set — ${description}. Related features may be disabled.`);
    }
  }

  // Validate AI API keys (at least one should be present)
  const aiKeys = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY'];
  const configuredAiKeys = aiKeys.filter(key => process.env[key]);
  if (configuredAiKeys.length === 0) {
    warnings.push('No AI API keys configured. AI features will be disabled.');
  }

  if (isProduction && !process.env.ALLOWED_ORIGINS) {
    warnings.push(
      'ALLOWED_ORIGINS is not set. CORS will rely on auto-detected Replit domains or APP_URL/FRONTEND_URL. ' +
      'Set ALLOWED_ORIGINS explicitly for strict cross-origin control (comma-separated HTTPS origins).'
    );
  }

  // Security guards
  // ALLOW_INSECURE_LOCAL_PTY is permitted in Replit production because Replit
  // manages its own VM-level sandboxing. Block it only outside Replit (Docker, VPS, K8s).
  const isReplitEnv = !!(process.env.REPL_ID || process.env.REPL_SLUG);
  if (isProduction && process.env.ALLOW_INSECURE_LOCAL_PTY === 'true' && !isReplitEnv) {
    errors.push(
      'FATAL SECURITY: ALLOW_INSECURE_LOCAL_PTY=true is forbidden in production. ' +
      'This flag allows un-sandboxed host terminal access.'
    );
  }

  if (isProduction && process.env.TESTING_STRIPE_SECRET_KEY) {
    warnings.push(
      'TESTING_STRIPE_SECRET_KEY is set in production. ' +
      'Ensure STRIPE_SECRET_KEY (live key) is used for all real payment processing.'
    );
  }

  // Runner connectivity: if RUNNER_BASE_URL is configured, RUNNER_JWT_SECRET is required
  if (process.env.RUNNER_BASE_URL && !process.env.RUNNER_JWT_SECRET) {
    if (isProduction) {
      errors.push('RUNNER_JWT_SECRET is missing — RUNNER_BASE_URL is set but runner auth requires this secret');
    } else {
      warnings.push('RUNNER_BASE_URL is set but RUNNER_JWT_SECRET is missing — runner auth will fail.');
    }
  }

  // Report
  if (warnings.length > 0) {
    logger.warn(`Environment validation warnings (${warnings.length}):`);
    warnings.forEach(warn => logger.warn(`  ⚠ ${warn}`));
  }

  if (errors.length > 0) {
    logger.error(`Environment validation FAILED — ${errors.length} critical error(s):`);
    errors.forEach(err => logger.error(`  ✖ ${err}`));
    
    if (isProduction) {
      logger.error('FATAL: Server cannot start in production with missing/invalid configuration.');
      logger.error('Fix the variables listed above and restart.');
      process.exit(1);
    }
  } else {
    logger.info(`Environment validation successful (${warnings.length} warning(s)).`);
  }
}
