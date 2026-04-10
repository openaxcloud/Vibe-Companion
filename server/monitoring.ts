export function initMonitoring() {
  // If SENTRY_DSN is set, initialize Sentry
  const dsn = process.env.SENTRY_DSN;
  if (dsn) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require("@sentry/node");
      Sentry.init({ dsn, tracesSampleRate: 0.1 });
      console.log("[monitoring] Sentry initialized");
    } catch {
      console.warn("[monitoring] @sentry/node not installed — skipping Sentry");
    }
  }

  // Periodic process metrics to stdout
  setInterval(() => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    console.log(
      `[metrics] heap=${Math.round(mem.heapUsed / 1024 / 1024)}MB` +
        ` rss=${Math.round(mem.rss / 1024 / 1024)}MB` +
        ` cpu_user=${cpu.user}µs`,
    );
  }, 60000);
}
