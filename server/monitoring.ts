/**
 * Server-side monitoring bootstrap.
 *
 * Sentry is wired in conditionally: it only loads when SENTRY_DSN is present
 * AND the @sentry/node package is installed. This lets us ship the code
 * without forcing the dependency on every install — Henri can opt in by:
 *   1. `npm install @sentry/node`
 *   2. Setting SENTRY_DSN in env
 *
 * If either is missing, Sentry is silently skipped and a one-line breadcrumb
 * is printed at startup.
 */

export async function initMonitoring(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    try {
      // Dynamic import keeps @sentry/node a soft dep (works in ESM unlike require()).
      // @ts-ignore — module may not be installed; the catch handles it.
      const Sentry = await import('@sentry/node');
      const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1');
      Sentry.init({
        dsn,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
        release: process.env.APP_VERSION,
      });
      console.log('[monitoring] Sentry server initialized');
      process.on('uncaughtException', (err) => {
        try { Sentry.captureException(err); } catch {}
        console.error('[fatal]', err);
      });
      process.on('unhandledRejection', (reason) => {
        try { Sentry.captureException(reason); } catch {}
        console.error('[unhandled]', reason);
      });
    } catch {
      console.warn('[monitoring] SENTRY_DSN is set but @sentry/node is not installed — run `npm install @sentry/node` to enable error tracking');
    }
  } else {
    // TODO: enable Sentry by setting SENTRY_DSN and installing @sentry/node
    console.log('[monitoring] Sentry disabled (SENTRY_DSN not set)');
  }

  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[metrics] heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB uptime=${Math.round(process.uptime())}s`);
  }, 60000);
}
