/**
 * Centralized logger for the server.
 *
 * Why this wrapper instead of pino/winston directly:
 *   - The codebase already uses `viteLog` everywhere via `createLogger(...)`.
 *     Migrating ~100 files to a new library carries more risk than reward.
 *   - This wrapper now adds the two missing production-grade behaviours that
 *     were called out in the audit: secret redaction and console silencing
 *     in production. If/when we outgrow `viteLog`, swap the inner `log()`
 *     for pino transport without touching call sites.
 */

import { log as viteLog } from '../vite';

type LogLevel = 'info' | 'warn' | 'error';

const isProduction = process.env.NODE_ENV === 'production';

// Field names that, if seen anywhere in a logged object, should be replaced.
const REDACT_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'csrftoken',
  'apikey',
  'api_key',
  'session',
  'sessionid',
  'sid',
  'accesstoken',
  'refreshtoken',
  'privatekey',
  'private_key',
  'encryptedvalue',
  'stripe_secret',
  'stripe_webhook_secret',
]);

// Patterns that look like secrets in free-form strings.
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // Bearer tokens & generic Authorization headers
  [/(Authorization|Bearer)\s*[:=]?\s*[A-Za-z0-9._\-+/=]{16,}/gi, '$1 [REDACTED]'],
  // sk-/pk-/api- style keys (OpenAI/Anthropic/Stripe)
  [/\b(sk|pk|rk|api|ant)-[A-Za-z0-9_\-]{16,}\b/g, '[REDACTED_KEY]'],
  // postgres URLs with credentials
  [/(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@/g, '$1$2:***@'],
  // generic credit-card-ish digits (16-19 digits, may be hyphenated)
  [/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_CC]'],
];

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limit]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let s = value;
    for (const [re, repl] of SECRET_PATTERNS) s = s.replace(re, repl);
    return s;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(v => redactValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactValue(v, depth + 1);
    }
  }
  return out;
}

function format(message: unknown, ...rest: unknown[]): string {
  const parts: string[] = [];
  const head = typeof message === 'string' ? message : JSON.stringify(redactValue(message));
  parts.push(redactValue(head) as string);
  for (const r of rest) {
    if (typeof r === 'string') {
      parts.push(redactValue(r) as string);
    } else {
      try {
        parts.push(JSON.stringify(redactValue(r)));
      } catch {
        parts.push('[unserializable]');
      }
    }
  }
  return parts.join(' ');
}

export function log(message: unknown, source: string, level: LogLevel = 'info', ...rest: unknown[]): void {
  const text = format(message, ...rest);
  const formatted =
    level === 'info' ? text :
    level === 'warn' ? `WARNING: ${text}` :
    `ERROR: ${text}`;
  viteLog(formatted, source);
}

export function createLogger(defaultSource: string) {
  return {
    debug: (message: unknown, ...args: unknown[]) => {
      if (!isProduction) log(message, defaultSource, 'info', ...args);
    },
    info: (message: unknown, ...args: unknown[]) => log(message, defaultSource, 'info', ...args),
    warn: (message: unknown, ...args: unknown[]) => log(message, defaultSource, 'warn', ...args),
    error: (message: unknown, ...args: unknown[]) => log(message, defaultSource, 'error', ...args),
  };
}

/**
 * Silence raw `console.*` in production so unstructured prints (left over in
 * legacy code, or coming from third-party libs) can't leak secrets.
 *
 * Errors and warnings are kept on stderr so deployment platforms still notice
 * problems, but their output is run through the same redactor.
 *
 * Idempotent — safe to call multiple times. No-op outside of production.
 */
export function silenceConsoleInProduction(): void {
  if (!isProduction) return;
  if ((globalThis as any).__consoleSilenced) return;
  (globalThis as any).__consoleSilenced = true;

  const noop = () => {};
  const stderr = (level: 'WARN' | 'ERROR') => (...args: unknown[]) => {
    process.stderr.write(`[${level}] ${format(args[0], ...args.slice(1))}\n`);
  };

  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
  console.warn = stderr('WARN');
  console.error = stderr('ERROR');
}
