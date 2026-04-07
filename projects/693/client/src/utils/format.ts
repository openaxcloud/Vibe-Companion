/* eslint-disable @typescript-eslint/no-explicit-any */

export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'CHF'
  | 'CNY'
  | 'INR'
  | (string & {});

export interface FormatCurrencyOptions {
  currency?: CurrencyCode;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /**
   * If true, return a plain value string without any currency symbol
   * but still respect locale grouping and decimal separators.
   */
  valueOnly?: boolean;
  /**
   * Optional fallback if Intl.NumberFormat fails for some reason
   */
  fallback?: string;
}

export interface PriceDiscountResult {
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  hasDiscount: boolean;
}

export interface PriceFromDiscountResult {
  discountPercent: number;
  discountedPrice: number;
  originalPrice: number;
}

export interface SafeParseNumberOptions {
  /**
   * Default value if parsing fails
   */
  defaultValue?: number;
  /**
   * Allow Infinity and -Infinity as valid values
   */
  allowInfinity?: boolean;
  /**
   * If true, will attempt to normalize common localized formats
   * like "1.234,56" or "1,234.56"
   */
  tryLocaleParsing?: boolean;
}

const DEFAULT_LOCALE = typeof navigator !== 'undefined' && navigator.language
  ? navigator.language
  : 'en-US';

const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeNumericString = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) return '';

  // Early return if clean parse works
  if (!Number.isNaN(Number(trimmed))) {
    return trimmed;
  }

  // Detect separators
  const hasComma = trimmed.includes(',');
  const hasDot = trimmed.includes('.');

  if (!hasComma && !hasDot) {
    // Non-standard characters, strip everything but digits, - and .
    return trimmed.replace(/[^0-9.-]/g, '');
  }

  // Heuristic for European vs US style:
  // - If both comma and dot: last separator is decimal separator
  // - If only comma and len after comma <= 2: treat as decimal
  // - If only dot and len after dot <= 2: treat as decimal
  let normalized = trimmed;
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');

  if (hasComma && hasDot) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';

    normalized = trimmed.replace(new RegExp(`\\undefined`, 'g'), '');
    normalized = normalized.replace(decimalSeparator, '.');
    return normalized;
  }

  if (hasComma && !hasDot) {
    const decimalCandidateLength = trimmed.length - lastComma - 1;
    if (decimalCandidateLength > 0 && decimalCandidateLength <= 2) {
      // "1.234,56" or "123,45" => decimal is comma, remove other non-digits
      normalized = trimmed.replace(/\./g, '');
      normalized = normalized.replace(',', '.');
    } else {
      // Likely thousands separator
      normalized = trimmed.replace(/,/g, '');
    }
    return normalized;
  }

  if (hasDot && !hasComma) {
    const decimalCandidateLength = trimmed.length - lastDot - 1;
    if (decimalCandidateLength > 0 && decimalCandidateLength <= 2) {
      // standard decimal
      normalized = trimmed;
    } else {
      // thousands separator
      normalized = trimmed.replace(/\./g, '');
    }
    return normalized;
  }

  return trimmed.replace(/[^0-9.-]/g, '');
};

export const formatCurrency = (
  value: number | string | null | undefined,
  {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    minimumFractionDigits,
    maximumFractionDigits,
    valueOnly = false,
    fallback
  }: FormatCurrencyOptions = {}
): string => {
  if (value === null || value === undefined || value === '') {
    return fallback ?? '';
  }

  const numericValue =
    typeof value === 'number' ? value : Number(normalizeNumericString(String(value)));

  if (!isFiniteNumber(numericValue)) {
    return fallback ?? '';
  }

  try {
    const hasFraction = String(Math.abs(numericValue)).includes('.');
    const minDigits =
      typeof minimumFractionDigits === 'number'
        ? minimumFractionDigits
        : hasFraction
          ? 2
          : 0;

    const maxDigits =
      typeof maximumFractionDigits === 'number'
        ? maximumFractionDigits
        : 2;

    if (valueOnly) {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: minDigits,
        maximumFractionDigits: maxDigits
      }).format(numericValue);
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits
    }).format(numericValue);
  } catch {
    // Basic fallback if Intl.NumberFormat is not available / fails
    const fixedValue =
      typeof maximumFractionDigits === 'number'
        ? numericValue.toFixed(maximumFractionDigits)
        : numericValue.toFixed(2);

    if (valueOnly) {
      return fixedValue;
    }

    return `undefined undefined`;
  }
};

export const formatPercent = (
  value: number | string | null | undefined,
  fractionDigits = 0
): string => {
  if (value === null || value === undefined || value === '') return '';

  const numericRaw = typeof value === 'number' ? value : Number(normalizeNumericString(String(value)));
  if (!isFiniteNumber(numericRaw)) return '';

  const numeric = numericRaw * 100;
  return `undefined%`;
};

export const calculatePriceWithDiscount = (
  originalPrice: number | string,
  discountPercent: number | string
): PriceDiscountResult => {
  const price =
    typeof originalPrice === 'number'
      ? originalPrice
      : Number(normalizeNumericString(String(originalPrice)));

  const discount =
    typeof discountPercent === 'number'
      ? discountPercent
      : Number(normalizeNumericString(String(discountPercent)));

  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  const safeDiscount = Number.isFinite(discount) ? discount : 0;

  const normalizedDiscount = Math.min(Math.max(safeDiscount, 0), 100);
  const discountAmount = (safePrice * normalizedDiscount) / 100;
  const finalPrice = safePrice - discountAmount;

  return {
    originalPrice: safePrice,
    discountPercent: normalizedDiscount,
    discountAmount,
    finalPrice,
    hasDiscount: normalizedDiscount > 0 && discountAmount > 0
  };
};

export const calculateOriginalPriceFromDiscount = (
  discountedPrice: number | string,
  discountPercent: number | string
): PriceFromDiscountResult | null => {
  const discount =
    typeof discountPercent === 'number'
      ? discountPercent
      : Number(normalizeNumericString(String(discountPercent)));

  const price =
    typeof discountedPrice === 'number'
      ? discountedPrice
      : Number(normalizeNumericString(String(discountedPrice)));

  if (!Number.isFinite(price) || price <= 0) return null;
  if (!Number.isFinite(discount) || discount <= 0 || discount >= 100) {
    return {
      discountPercent: 0,
      discountedPrice: price,
      originalPrice: price
    };
  }

  const originalPrice = price / (1 - discount / 100);

  return {
    discountPercent: discount,
    discountedPrice: price,
    originalPrice
  };
};

export const safeParseNumber = (
  value: unknown,
  options: SafeParseNumberOptions = {}
): number => {
  const {
    defaultValue = 0,
    allowInfinity = false,
    tryLocaleParsing = true
  } = options;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return allowInfinity && (value === Infinity || value === -Infinity)
        ? value
        : defaultValue;
    }
    return value;
  }

  if (value === null || value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (typeof value === 'bigint') {
    const num = Number(value);
    return Number.isFinite(num) ? num : defaultValue;
  }

  const str = String(value).trim();
  if (!str) return defaultValue;

  // Try direct parse
  let num = Number(str);
  if (!Number.isNaN(num)) {
    if (!Number.isFinite(num)) {
      return allowInfinity && (num === Infinity || num === -Infinity)
        ? num