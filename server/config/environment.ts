// Dotenv is loaded by server/index.ts in development
// No import needed here - environment variables are already available

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  environment: process.env.NODE_ENV || 'development',
  release: process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
  cdn: {
    enabled: parseBoolean(process.env.CDN_ENABLED ?? (process.env.NODE_ENV === 'production' ? 'true' : 'false'), false),
    assetBaseUrl: process.env.CDN_BASE_URL || process.env.ASSET_BASE_URL || '',
    staticCacheSeconds: parseNumber(process.env.CDN_STATIC_CACHE_SECONDS, 60 * 60 * 24 * 365),
    dynamicCacheSeconds: parseNumber(process.env.CDN_DYNAMIC_CACHE_SECONDS, 60 * 60),
    htmlBrowserCacheSeconds: parseNumber(process.env.CDN_HTML_BROWSER_CACHE_SECONDS, 60 * 60),
    htmlCdnCacheSeconds: parseNumber(process.env.CDN_HTML_CDN_CACHE_SECONDS, 60 * 60 * 24),
    apiCacheControl: process.env.CDN_API_CACHE_CONTROL || 'no-cache, no-store, must-revalidate',
  },
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    sentrySampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.2'),
    analyticsEnabled: parseBoolean(process.env.ANALYTICS_ENABLED, true),
    logAggregationEnabled: parseBoolean(process.env.LOG_AGGREGATION_ENABLED, true),
  },
  redis: {
    // Disabled by default in development to prevent SSL connection errors
    // Set REDIS_ENABLED=true in development to enable Redis if needed
    enabled: parseBoolean(process.env.REDIS_ENABLED, process.env.NODE_ENV === 'production'),
    defaultTtlSeconds: parseNumber(process.env.REDIS_DEFAULT_TTL, 3600),
  },
  database: {
    slowQueryThresholdMs: parseNumber(process.env.DB_SLOW_QUERY_THRESHOLD_MS, 750),
    recommendationWindowMinutes: parseNumber(process.env.DB_OPTIMIZER_WINDOW_MINUTES, 60),
  },
};

export type AppConfig = typeof config;
