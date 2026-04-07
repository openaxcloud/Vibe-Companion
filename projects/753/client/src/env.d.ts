/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_ENV: 'development' | 'staging' | 'production' | 'test'
  readonly VITE_APP_VERSION: string
  readonly VITE_ENABLE_MOCKS?: 'true' | 'false'
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: string
  readonly VITE_SENTRY_RELEASE?: string
  readonly VITE_FEATURE_FLAGS?: string
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error'
  readonly VITE_ENABLE_ANALYTICS?: 'true' | 'false'
  readonly VITE_ANALYTICS_WRITE_KEY?: string
  readonly VITE_BUILD_TIME?: string
  readonly VITE_DEFAULT_LOCALE?: string
  readonly VITE_SUPPORTED_LOCALES?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}