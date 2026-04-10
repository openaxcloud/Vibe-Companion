export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    try {
      const Sentry = require('@sentry/node');
      Sentry.init({ dsn, tracesSampleRate: 0.1, environment: process.env.NODE_ENV || 'development' });
      console.log('[monitoring] Sentry initialized');
      process.on('uncaughtException', (err) => { Sentry.captureException(err); console.error('[fatal]', err); });
      process.on('unhandledRejection', (reason) => { Sentry.captureException(reason); console.error('[unhandled]', reason); });
    } catch { console.warn('[monitoring] @sentry/node not installed, skipping'); }
  }

  setInterval(() => {
    const mem = process.memoryUsage();
    console.log(`[metrics] heap=${Math.round(mem.heapUsed/1024/1024)}MB rss=${Math.round(mem.rss/1024/1024)}MB uptime=${Math.round(process.uptime())}s`);
  }, 60000);
}
