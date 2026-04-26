/**
 * Client-side Sentry bootstrap.
 *
 * Sentry loads only when both conditions hold:
 *   1. `import.meta.env.VITE_SENTRY_DSN` is set at build time
 *   2. `@sentry/react` is installed
 *
 * If either is missing, this is a no-op so the app keeps shipping without
 * forcing the dependency on every contributor.
 *
 * To enable in production:
 *   1. `npm install @sentry/react @sentry/browser`
 *   2. Set `VITE_SENTRY_DSN` in your build env (Vite exposes only VITE_*).
 */

export async function initClientSentry(): Promise<void> {
  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  try {
    // @ts-ignore — soft dep
    const Sentry = await import('@sentry/react');
    const sampleRate = parseFloat(
      (import.meta as any).env?.VITE_SENTRY_TRACES_SAMPLE_RATE ?? '0.1'
    );
    Sentry.init({
      dsn,
      environment: (import.meta as any).env?.VITE_SENTRY_ENVIRONMENT ?? (import.meta as any).env?.MODE,
      tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : 0.1,
      release: (import.meta as any).env?.VITE_APP_VERSION,
    });
    console.log('[sentry] client initialized');
  } catch {
    console.warn('[sentry] VITE_SENTRY_DSN is set but @sentry/react is not installed — run `npm install @sentry/react @sentry/browser`');
  }
}
