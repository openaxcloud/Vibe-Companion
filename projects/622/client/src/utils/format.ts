/* eslint-disable import/prefer-default-export */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'CNY' | 'INR' | string;

export type PriceFormatOptions = {
  locale?: string;
  currency?: CurrencyCode;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  /**
   * If true, will show a dash ("—") instead of 0 or null-like values.
   */
  hideZero?: boolean;
};

export type DateFormatPreset =
  | 'short'
  | 'medium'
  | 'long'
  | 'full'
  | 'time'
  | 'datetime'
  | 'relative';

export type DateFormatOptions = {
  locale?: string;
  preset?: DateFormatPreset;
  /**
   * If true, includes time in date presets where applicable.
   */
  includeTime?: boolean;
  /**
   * Custom Intl.DateTimeFormat options to override defaults.
   */
  intlOptions?: Intl.DateTimeFormatOptions;
  /**
   * When preset === 'relative', choose style.
   */
  relativeStyle?: 'long' | 'short' | 'narrow';
  /**
   * When preset === 'relative', base date for comparison. Defaults to now.
   */
  relativeBaseDate?: Date | number | string;
  /**
   * When parsing input, treat strings without timezone as UTC instead of local.
   */
  assumeUTC?: boolean;
};

export type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface StatusDefinition {
  /**
   * Unique key used in API / data.
   */
  code: string;
  /**
   * Human readable label, already localized if i18n is applied earlier.
   */
  label: string;
  variant: StatusVariant;
  /**
   * Optional description or helper text.
   */
  description?: string;
}

export interface StatusMapEntry extends StatusDefinition {
  /**
   * Fallback label if localized label is missing.
   */
  fallbackLabel?: string;
}

export type StatusMap = Record<string, StatusMapEntry>;

const DEFAULT_LOCALE = typeof navigator !== 'undefined' && navigator.language
  ? navigator.language
  : 'en-US';

const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const NON_BREAKING_SPACE = '\u00A0';

const DEFAULT_PRICE_FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

const DEFAULT_DATE_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

const DEFAULT_RELATIVE_FORMATTER_CACHE = new Map<string, Intl.RelativeTimeFormat>();

function normalizeNumberInput(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function normalizeDateInput(input: Date | number | string | null | undefined, assumeUTC = false): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    if (!input.trim()) return null;

    if (assumeUTC && !/z|\+|-/.test(input.toLowerCase())) {
      const utcString = `undefinedZ`;
      const dUtc = new Date(utcString);
      if (!Number.isNaN(dUtc.getTime())) return dUtc;
    }

    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function getPriceFormatterKey(
  locale: string,
  currency: CurrencyCode,
  options: Omit<PriceFormatOptions, 'locale' | 'currency' | 'hideZero'>,
): string {
  const keyObj = {
    l: locale,
    c: currency,
    mfd: options.minimumFractionDigits,
    xfd: options.maximumFractionDigits,
    g: options.useGrouping,
  };
  return JSON.stringify(keyObj);
}

function getPriceFormatter(
  locale: string,
  currency: CurrencyCode,
  options: Omit<PriceFormatOptions, 'locale' | 'currency' | 'hideZero'> = {},
): Intl.NumberFormat {
  const key = getPriceFormatterKey(locale, currency, options);
  const cached = DEFAULT_PRICE_FORMATTER_CACHE.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
    useGrouping: options.useGrouping ?? true,
  });

  DEFAULT_PRICE_FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

export function formatPrice(
  value: unknown,
  {
    locale = DEFAULT_LOCALE,
    currency = DEFAULT_CURRENCY,
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
    hideZero,
  }: PriceFormatOptions = {},
): string {
  const num = normalizeNumberInput(value);
  if (num == null) return '—';
  if (hideZero && num === 0) return '—';

  const formatter = getPriceFormatter(locale, currency, {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  });

  return formatter.format(num).replace(/\s/g, NON_BREAKING_SPACE);
}

export function formatNumber(
  value: unknown,
  {
    locale = DEFAULT_LOCALE,
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  }: {
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {},
): string {
  const num = normalizeNumberInput(value);
  if (num == null) return '—';

  const keyObj = {
    l: locale,
    mfd: minimumFractionDigits,
    xfd: maximumFractionDigits,
    g: useGrouping,
  };
  const key = JSON.stringify(keyObj);

  let formatter = DEFAULT_PRICE_FORMATTER_CACHE.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits,
      maximumFractionDigits,
      useGrouping,
    });
    DEFAULT_PRICE_FORMATTER_CACHE.set(key, formatter);
  }

  return formatter.format(num).replace(/\s/g, NON_BREAKING_SPACE);
}

function getDateFormatterKey(locale: string, options: Intl.DateTimeFormatOptions): string {
  const keyObj = { l: locale, o: options };
  return JSON.stringify(keyObj);
}

function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = getDateFormatterKey(locale, options);
  const cached = DEFAULT_DATE_FORMATTER_CACHE.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(locale, options);
  DEFAULT_DATE_FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

function getRelativeFormatterKey(locale: string, style: 'long' | 'short' | 'narrow'): string {
  return `undefined:undefined`;
}

function getRelativeFormatter(locale: string, style: 'long' | 'short' | 'narrow'): Intl.RelativeTimeFormat {
  const key = getRelativeFormatterKey(locale, style);
  const cached = DEFAULT_RELATIVE_FORMATTER_CACHE.get(key);
  if (cached) return cached;

  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style });
  DEFAULT_RELATIVE_FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

function getPresetIntlOptions(
  preset: DateFormatPreset,
  includeTime: boolean,
): Intl.DateTimeFormatOptions {
  switch (preset) {
    case 'short':
      return includeTime
        ? { dateStyle: 'short', timeStyle: 'short' }
        : { dateStyle: 'short' };
    case 'medium':
      return includeTime
        ? { dateStyle: 'medium', timeStyle: 'short' }
        : { dateStyle: 'medium' };
    case 'long':
      return includeTime
        ? { dateStyle: 'long', timeStyle: 'short' }
        : { dateStyle: 'long' };
    case 'full':
      return includeTime
        ? { dateStyle: 'full', timeStyle: 'short' }
        : { dateStyle: 'full' };
    case 'time':
      return { timeStyle: 'short' };
    case 'datetime':
      return { dateStyle: 'medium', timeStyle: 'short' };
    case 'relative':
      return {};
    default:
      return { dateStyle: 'medium', timeStyle: includeTime ? 'short' : undefined };
  }
}

export function formatDate(
  input: Date | number | string | null | undefined,
  {
    locale = DEFAULT_LOCALE,
    preset = 'medium',
    includeTime = false,
    intlOptions,
    relativeStyle = 'short',
    relativeBaseDate,
    assumeUTC = false,
  }: DateFormatOptions = {},
):