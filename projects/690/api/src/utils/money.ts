/* eslint-disable @typescript-eslint/no-explicit-any */

export type Cents = number;
export type Dollars = number;

export interface MoneyFormatOptions {
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export interface TaxCalculationInput {
  subtotalCents: Cents;
  taxRate: number; // e.g. 0.1 for 10%
}

export interface TaxCalculationResult {
  taxCents: Cents;
  totalWithTaxCents: Cents;
}

export interface ShippingCalculationInput {
  subtotalCents: Cents;
  shippingFlatRateCents?: Cents;
}

export interface ShippingCalculationResult {
  shippingCents: Cents;
  totalWithShippingCents: Cents;
}

/**
 * Normalize a number to integer cents with proper rounding
 */
export const toCents = (value: number | string | null | undefined): Cents => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 0;
  }

  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) {
    return 0;
  }

  // Round to nearest cent to avoid floating point issues
  return Math.round(num * 100);
};

/**
 * Convert cents to dollars as floating point
 */
export const toDollars = (cents: Cents | null | undefined): Dollars => {
  if (cents === null || cents === undefined || Number.isNaN(Number(cents))) {
    return 0;
  }
  return cents / 100;
};

/**
 * Safely add multiple cent amounts
 */
export const addCents = (...values: Array<Cents | null | undefined>): Cents => {
  return values.reduce<Cents>((sum, v) => {
    if (v === null || v === undefined || Number.isNaN(Number(v))) {
      return sum;
    }
    return sum + v;
  }, 0);
};

/**
 * Safely subtract cents (a - b). Negative results allowed.
 */
export const subtractCents = (a: Cents, b: Cents): Cents => {
  if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
    return 0;
  }
  return a - b;
};

/**
 * Multiply cents by a factor with correct rounding
 */
export const multiplyCents = (cents: Cents, factor: number): Cents => {
  if (Number.isNaN(Number(cents)) || Number.isNaN(Number(factor))) {
    return 0;
  }
  return Math.round(cents * factor);
};

/**
 * Divide cents by a divisor with correct rounding
 */
export const divideCents = (cents: Cents, divisor: number): Cents => {
  if (divisor === 0 || Number.isNaN(Number(cents)) || Number.isNaN(Number(divisor))) {
    return 0;
  }
  return Math.round(cents / divisor);
};

/**
 * Clamp cents to a minimum of 0 (no negative amounts)
 */
export const clampCentsToZero = (cents: Cents): Cents => {
  if (Number.isNaN(Number(cents))) {
    return 0;
  }
  return cents < 0 ? 0 : cents;
};

/**
 * Format cents to localized currency string
 */
export const formatCents = (
  cents: Cents,
  options: MoneyFormatOptions = {}
): string => {
  const {
    currency = "USD",
    locale = "en-US",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  const dollars = toDollars(cents);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(dollars);
  } catch {
    // Fallback simple formatting
    return `undefined undefined`;
  }
};

/**
 * Format a dollars value to currency string
 */
export const formatDollars = (
  dollars: Dollars,
  options: MoneyFormatOptions = {}
): string => {
  return formatCents(toCents(dollars), options);
};

/**
 * Parse a formatted currency or numeric string to cents.
 * Accepts values like "12.34", "$12.34", "1,234.56", etc.
 */
export const parseToCents = (value: string | number): Cents => {
  if (typeof value === "number") {
    return toCents(value);
  }

  if (!value) {
    return 0;
  }

  const cleaned = value
    .toString()
    .replace(/[^\d.,-]/g, "") // Remove currency symbols and text
    .replace(/,/g, ""); // Remove thousands separators

  const parsed = parseFloat(cleaned);
  if (Number.isNaN(parsed)) {
    return 0;
  }

  return toCents(parsed);
};

/**
 * Calculate tax based on a subtotal and tax rate.
 * Placeholder implementation using simple rate; can be replaced with
 * region-specific or rules-based tax engine.
 */
export const calculateTax = ({
  subtotalCents,
  taxRate,
}: TaxCalculationInput): TaxCalculationResult => {
  const safeSubtotal = clampCentsToZero(subtotalCents);
  const safeRate = Number.isFinite(taxRate) ? taxRate : 0;

  const taxCents = multiplyCents(safeSubtotal, safeRate);
  const totalWithTaxCents = addCents(safeSubtotal, taxCents);

  return {
    taxCents,
    totalWithTaxCents,
  };
};

/**
 * Calculate shipping based on a subtotal.
 * Placeholder implementation using a flat rate; can be replaced with
 * weight/zone/carrier-based calculation.
 */
export const calculateShipping = ({
  subtotalCents,
  shippingFlatRateCents = 0,
}: ShippingCalculationInput): ShippingCalculationResult => {
  const safeSubtotal = clampCentsToZero(subtotalCents);
  const safeFlatRate = clampCentsToZero(shippingFlatRateCents);

  const shippingCents = safeSubtotal > 0 ? safeFlatRate : 0;
  const totalWithShippingCents = addCents(safeSubtotal, shippingCents);

  return {
    shippingCents,
    totalWithShippingCents,
  };
};

/**
 * Calculate final order totals using subtotal, tax, and shipping.
 * This is a simple composition utility.
 */
export interface OrderTotalsInput {
  subtotalCents: Cents;
  taxRate: number;
  shippingFlatRateCents?: Cents;
}

export interface OrderTotalsResult {
  subtotalCents: Cents;
  taxCents: Cents;
  shippingCents: Cents;
  grandTotalCents: Cents;
}

export const calculateOrderTotals = ({
  subtotalCents,
  taxRate,
  shippingFlatRateCents = 0,
}: OrderTotalsInput): OrderTotalsResult => {
  const safeSubtotal = clampCentsToZero(subtotalCents);

  const { taxCents, totalWithTaxCents } = calculateTax({
    subtotalCents: safeSubtotal,
    taxRate,
  });

  const { shippingCents, totalWithShippingCents } = calculateShipping({
    subtotalCents: totalWithTaxCents,
    shippingFlatRateCents,
  });

  return {
    subtotalCents: safeSubtotal,
    taxCents,
    shippingCents,
    grandTotalCents: totalWithShippingCents,
  };
};

/**
 * Compare two cent values for equality
 */
export const centsEqual = (a: Cents, b: Cents): boolean => {
  if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
    return false;
  }
  return a === b;
};

/**
 * Check if a cents amount is greater than another
 */
export const centsGreaterThan = (a: Cents, b: Cents): boolean => {
  if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
    return false;
  }
  return a > b;
};

/**
 * Check if a cents amount is greater than or equal to another
 */
export const centsGreaterThanOrEqual = (a: Cents, b: Cents): boolean => {
  if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
    return false;
  }
  return a >= b;
};

/**
 * Check if a cents amount is less than another
 */
export const centsLessThan = (a: Cents, b: Cents): boolean => {
  if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
    return false;
  }
  return a < b;
};

/**
 * Check if a cents amount is less than or equal to another
 */
export const centsLessThanOrEqual = (a: Cents, b: Cents): boolean => {
  if (Number.isNaN(Number(a)) || Number.isNaN(Number(b))) {
    return false;
  }
  return a <= b;
};

/**
 * Safely normalize an arbitrary input (string | number) to cents.
 */
export const normalizeToCents = (value: unknown): Cents => {
  if (typeof value ===